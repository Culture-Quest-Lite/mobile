import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { PublicEnv } from "@/constants/env";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { ensureForegroundLocationPermission, getDevelopmentLocationOverride } from "@/lib/location";
import { appAlert } from "@/components/ui/app-dialog";

export type GroupLiveLocationMessage = {
  latitude: number;
  longitude: number;
  timestamp: number;
  userId: string;
  username: string | null;
};

export type GroupLiveShareMode =
  | "sharing"
  | "paused"
  | "route_stopped"
  | "group_forced_stop";

export type GroupLiveConnectionState =
  /** Chưa bắt đầu kết nối lần nào — KHÁC với "disconnected" (đã nối rồi mất). */
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

type StopMode = "group_forced_stop" | "paused" | "route_stopped";

type UseGroupLiveLocationParams = {
  enabled: boolean;
  groupId: string | null;
  isLeader: boolean;
  myUserId: string | null;
  username: string | null;
};

type UseGroupLiveLocationResult = {
  connectionState: GroupLiveConnectionState;
  forceStopGroup: () => void;
  isPermissionGranted: boolean;
  lastError: string | null;
  locationsByUserId: Record<string, GroupLiveLocationMessage>;
  pauseSharing: () => void;
  resumeSharing: () => void;
  shareMode: GroupLiveShareMode;
  stopRouteSharing: () => void;
};

const defaultGroupWebSocketUrl = "wss://www.culturequestlite.com/ws/websocket";
// Phai nho hon nguong 15 giay ma buildJourneyMembers dung de danh dau offline.
const LOCATION_HEARTBEAT_INTERVAL_MS = 5000;
const groupLiveLocationDebugEnabled = __DEV__;
/** Ngưỡng chấp nhận vị trí đã lưu sẵn trong máy cho lần phát đầu tiên. */
const initialLocationMaxAgeInMs = 60_000;
const initialLocationRequiredAccuracyInMeters = 200;

/**
 * `connectRealtime` có nhiều cổng chặn và tất cả đều `return` im lặng. Không có
 * log ở đó thì lúc không kết nối được sẽ không có cách nào biết cổng nào chặn —
 * đúng tình trạng sau khi commit `2a07975` xoá hệ thống log này.
 */
function logGroupLiveLocation(event: string, details?: Record<string, unknown>) {
  if (!groupLiveLocationDebugEnabled) {
    return;
  }

  if (details) {
    console.info(`[group-live-location] ${event}`, details);
    return;
  }

  console.info(`[group-live-location] ${event}`);
}

function normalizeValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function resolveGroupWebSocketUrl() {
  const envUrl = normalizeValue(PublicEnv.groupWsUrl);
  return envUrl ?? defaultGroupWebSocketUrl;
}

function readPayloadText(value: unknown) {
  return normalizeValue(typeof value === "string" ? value : null);
}

function getMessageText(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

function parseLocationMessage(message: IMessage): GroupLiveLocationMessage | null {
  try {
    const rawPayload = JSON.parse(message.body) as Record<string, unknown>;
    const latitude =
      typeof rawPayload.latitude === "number" && Number.isFinite(rawPayload.latitude)
        ? rawPayload.latitude
        : null;
    const longitude =
      typeof rawPayload.longitude === "number" && Number.isFinite(rawPayload.longitude)
        ? rawPayload.longitude
        : null;
    const timestamp =
      typeof rawPayload.timestamp === "number" && Number.isFinite(rawPayload.timestamp)
        ? rawPayload.timestamp
        : Date.now();
    const rawUserId = rawPayload.userId;
    const userId =
      typeof rawUserId === "number" && Number.isFinite(rawUserId)
        ? `${Math.trunc(rawUserId)}`
        : normalizeValue(typeof rawUserId === "string" ? rawUserId : null);

    if (!userId || latitude === null || longitude === null) {
      return null;
    }

    return {
      latitude,
      longitude,
      timestamp,
      userId,
      // LocationMessage serialize ra field `displayName`; `@JsonAlias` chi
      // anh huong chieu deserialize nen broadcast khong bao gio co `username`.
      username:
        readPayloadText(rawPayload.displayName) ??
        readPayloadText(rawPayload.username),
    };
  } catch (error) {
    console.warn("[group-live-location] parse location payload failed", {
      error,
      body: message.body,
    });
    return null;
  }
}

function parseCommandAction(message: IMessage) {
  try {
    const rawPayload = JSON.parse(message.body) as Record<string, unknown>;
    return normalizeValue(
      typeof rawPayload.action === "string" ? rawPayload.action : null,
    );
  } catch (error) {
    console.warn("[group-live-location] parse command payload failed", {
      error,
      body: message.body,
    });
    return null;
  }
}

export function useGroupLiveLocation({
  enabled,
  groupId,
  isLeader,
  myUserId,
  username,
}: UseGroupLiveLocationParams): UseGroupLiveLocationResult {
  const authSession = useAuthSession();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const clientRef = useRef<Client | null>(null);
  const commandSubscriptionRef = useRef<StompSubscription | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const locationTopicSubscriptionRef = useRef<StompSubscription | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoordinateRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const shouldMaintainSessionRef = useRef(false);
  const shareModeRef = useRef<GroupLiveShareMode>("sharing");
  // "idle" chứ không phải "disconnected": lúc mới mở màn chưa hề thử kết nối,
  // báo "Mất kết nối" ngay khi vào là sai và làm người dùng tưởng tính năng hỏng.
  const [connectionState, setConnectionState] =
    useState<GroupLiveConnectionState>("idle");
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [locationsByUserId, setLocationsByUserId] = useState<
    Record<string, GroupLiveLocationMessage>
  >({});
  const [shareMode, setShareMode] = useState<GroupLiveShareMode>("sharing");

  function syncShareMode(nextShareMode: GroupLiveShareMode) {
    shareModeRef.current = nextShareMode;
    setShareMode(nextShareMode);
  }

  function clearGpsWatcher() {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    lastCoordinateRef.current = null;

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }

  async function disconnectClient() {
    commandSubscriptionRef.current?.unsubscribe();
    commandSubscriptionRef.current = null;
    locationTopicSubscriptionRef.current?.unsubscribe();
    locationTopicSubscriptionRef.current = null;

    const currentClient = clientRef.current;
    clientRef.current = null;

    if (currentClient) {
      try {
        logGroupLiveLocation("disconnect stomp client");
        await currentClient.deactivate();
      } catch (error) {
        console.warn("[group-live-location] deactivate stomp failed", {
          error,
        });
      }
    }

    // `deactivate()` chờ socket đóng hẳn nên có thể mất vài giây. Trong lúc đó
    // effect thường đã dựng client mới (màn hành trình gọi setStatus("loading")
    // mỗi lần focus nên vòng ngắt-nối này xảy ra liên tục). Nếu cứ hạ trạng
    // thái vô điều kiện thì lần "disconnected" muộn này ghi đè lên "connected"
    // của client mới và banner kẹt ở "Mất kết nối" dù đang online.
    if (clientRef.current === null) {
      setConnectionState("disconnected");
    }
  }

  async function pauseRealtime(stopMode: StopMode) {
    clearGpsWatcher();
    shouldMaintainSessionRef.current = false;
    syncShareMode(stopMode);
    await disconnectClient();
  }

  async function pauseForBackground() {
    clearGpsWatcher();
    await disconnectClient();
  }

  function handleIncomingLocation(message: GroupLiveLocationMessage) {
    setLocationsByUserId((currentLocations) => ({
      ...currentLocations,
      [message.userId]: message,
    }));
  }

  async function publishLocation(latitude: number, longitude: number) {
    const normalizedGroupId = normalizeValue(groupId);
    const normalizedUsername = normalizeValue(username);
    const normalizedUserId = normalizeValue(myUserId);
    // LocationWebSocketController chi ghi de userId khi doc duoc claim
    // `internal_id` tu JWT. Claim do chua co trong access token, nen khong gui
    // kem userId thi server broadcast ra `"userId": null` va moi client deu
    // drop goi tin o parseLocationMessage. Khi backend resolve duoc principal,
    // gia tri nay se bi server ghi de nen van an toan.
    const numericUserId =
      normalizedUserId && /^\d+$/.test(normalizedUserId)
        ? Number(normalizedUserId)
        : null;

    if (!normalizedGroupId || !clientRef.current?.connected) {
      return;
    }

    clientRef.current.publish({
      body: JSON.stringify({
        latitude,
        longitude,
        ...(normalizedUsername === null
          ? null
          : { username: normalizedUsername }),
        ...(numericUserId === null ? null : { userId: numericUserId }),
      }),
      destination: `/app/group/${normalizedGroupId}/location`,
    });
  }

  function publishCurrentCoordinate(coordinate: {
    latitude: number;
    longitude: number;
  }) {
    lastCoordinateRef.current = coordinate;

    if (myUserId) {
      handleIncomingLocation({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        timestamp: Date.now(),
        userId: myUserId,
        username: normalizeValue(username),
      });
    }

    void publishLocation(coordinate.latitude, coordinate.longitude);
  }

  /**
   * Phát ngay một vị trí lúc vừa vào, không chờ `watchPositionAsync`.
   *
   * `watchPositionAsync` chỉ bắn callback đầu tiên khi có fix GPS mới, trong
   * nhà hoặc khu nhiều nhà cao tầng có thể mất vài chục giây. Không có bước này
   * thì `lastCoordinateRef` còn null nên heartbeat cũng không có gì để gửi, và
   * cả nhóm không nhìn thấy bạn suốt quãng đó.
   *
   * Ưu tiên vị trí đã lưu trong máy (còn mới dưới 60 giây và sai số dưới 200m);
   * không có thì mới đo trực tiếp một lần.
   */
  async function publishInitialLocationSnapshot() {
    if (!myUserId) {
      return;
    }

    try {
      const lastKnownPosition = await Location.getLastKnownPositionAsync({
        maxAge: initialLocationMaxAgeInMs,
        requiredAccuracy: initialLocationRequiredAccuracyInMeters,
      });

      if (lastKnownPosition) {
        logGroupLiveLocation("use last known position snapshot", {
          accuracy: lastKnownPosition.coords.accuracy ?? null,
          userId: myUserId,
        });
        publishCurrentCoordinate({
          latitude: lastKnownPosition.coords.latitude,
          longitude: lastKnownPosition.coords.longitude,
        });
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      logGroupLiveLocation("use current position snapshot", {
        accuracy: currentPosition.coords.accuracy ?? null,
        userId: myUserId,
      });
      publishCurrentCoordinate({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
    } catch (error) {
      console.warn("[group-live-location] initial position snapshot failed", {
        error,
        userId: myUserId,
      });
    }
  }

  async function startLocationWatcher() {
    if (locationSubscriptionRef.current || heartbeatIntervalRef.current) {
      return;
    }

    const permission = await ensureForegroundLocationPermission();
    setIsPermissionGranted(permission.granted);

    if (!permission.granted) {
      setLastError("Bạn chưa cấp quyền vị trí để chia sẻ hành trình nhóm.");
      return;
    }

    // KHÔNG await: `getCurrentPositionAsync` có thể treo hàng chục giây khi ở
    // trong nhà, và `mayShowUserSettingsDialog` còn dựng hộp thoại hệ thống chờ
    // người dùng bấm. Chờ nó xong mới dựng heartbeat và watcher thì suốt quãng
    // đó không có toạ độ nào được phát, cả nhóm coi như bạn offline.
    void publishInitialLocationSnapshot();

    // watchPositionAsync chi ban callback khi thiet bi di chuyen du
    // distanceInterval; timeInterval la Android-only nen tren iOS dung yen la
    // khong co update nao. Khong co nhip phat lai dinh ky thi nguoi dung dung
    // yen se bi ca nhom coi la "offline" sau 15 giay, va nguoi mo man hinh sau
    // khong thay ai cho den khi co nguoi di chuyen du 15 met.
    heartbeatIntervalRef.current = setInterval(() => {
      const lastCoordinate = lastCoordinateRef.current;

      if (lastCoordinate) {
        publishCurrentCoordinate(lastCoordinate);
      }
    }, LOCATION_HEARTBEAT_INTERVAL_MS);

    const devCoordinate = getDevelopmentLocationOverride();

    if (devCoordinate) {
      publishCurrentCoordinate(devCoordinate);
      return;
    }

    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 15,
        mayShowUserSettingsDialog: true,
        timeInterval: 5000,
      },
      (position) => {
        publishCurrentCoordinate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
    );
  }

  async function connectRealtime() {
    const normalizedGroupId = normalizeValue(groupId);

    // username chi la ten hien thi du phong (profile tu REST moi la nguon
    // chinh), nen khong dung no lam dieu kien ket noi: user khong co name lan
    // username se bi tat hoan toan tinh nang chia se vi tri.
    if (
      !enabled ||
      !normalizedGroupId ||
      shareModeRef.current !== "sharing" ||
      appStateRef.current !== "active"
    ) {
      logGroupLiveLocation("skip connect realtime", {
        appState: appStateRef.current,
        enabled,
        groupId: normalizedGroupId,
        shareMode: shareModeRef.current,
      });
      return;
    }

    if (clientRef.current?.connected || clientRef.current?.active) {
      logGroupLiveLocation("reuse active stomp client", {
        connected: Boolean(clientRef.current?.connected),
        groupId: normalizedGroupId,
      });
      await startLocationWatcher();
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      setLastError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      logGroupLiveLocation("skip connect realtime: missing access token", {
        groupId: normalizedGroupId,
      });
      return;
    }

    setLastError(null);
    setConnectionState("connecting");
    logGroupLiveLocation("connect realtime", {
      groupId: normalizedGroupId,
      userId: normalizeValue(myUserId),
      username: normalizeValue(username),
      wsUrl: resolveGroupWebSocketUrl(),
    });

    /**
     * Client cũ vẫn bắn `onDisconnect`/`onWebSocketClose` SAU khi đã bị thay
     * thế — `reconnectDelay` tự dựng client mới, hoặc effect chạy lại khi đổi
     * nhóm. Mọi callback vì thế phải tự kiểm tra mình còn là client đang dùng
     * hay không.
     *
     * Thiếu bước này thì client cũ ghi đè `connectionState` của client mới về
     * "disconnected" ngay sau khi nó vừa kết nối xong, và màn hình báo mất kết
     * nối vĩnh viễn dù WebSocket vẫn sống. Đây chính là thứ commit `2a07975`
     * xoá mất.
     */
    const isCurrentClient = () => clientRef.current === nextClient;
    const nextClient = new Client({
      appendMissingNULLonIncoming: true,
      brokerURL: resolveGroupWebSocketUrl(),
      connectHeaders: {
        Authorization: `${authSession.tokenType ?? "Bearer"} ${accessToken}`,
      },
      /**
       * PHẢI luôn truyền một hàm — tuyệt đối không `undefined`.
       *
       * `Client` đặt mặc định `this.debug = noOp` rồi mới `Object.assign(this,
       * conf)` trong `configure()`. `Object.assign` chép cả thuộc tính có giá
       * trị `undefined`, nên `debug: undefined` GHI ĐÈ noOp thành undefined.
       * Sau đó 10 chỗ trong thư viện gọi `this.debug(...)` — trong đó có
       * `activate()` — và ném `TypeError: this.debug is not a function`.
       *
       * Vì điều kiện là `__DEV__`, bản debug truyền hàm thật nên chạy bình
       * thường, còn bản release truyền undefined nên chết ngay lúc activate.
       * Đây là lý do group chạy với `expo run:android` nhưng hỏng với
       * `--variant release`.
       */
      debug: (message: string) => {
        logGroupLiveLocation(message);
      },
      forceBinaryWSFrames: true,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        if (!isCurrentClient()) {
          return;
        }

        setConnectionState("connected");
        setLastError(null);
        logGroupLiveLocation("stomp connected", {
          groupId: normalizedGroupId,
        });

        locationTopicSubscriptionRef.current = nextClient.subscribe(
          `/topic/group/${normalizedGroupId}`,
          (incomingMessage) => {
            const parsedMessage = parseLocationMessage(incomingMessage);

            if (!parsedMessage) {
              return;
            }

            handleIncomingLocation(parsedMessage);
          },
        );

        commandSubscriptionRef.current = nextClient.subscribe(
          `/topic/group/${normalizedGroupId}/commands`,
          (incomingMessage) => {
            const action = parseCommandAction(incomingMessage);

            if (action !== "STOP_LOCATION") {
              return;
            }

            void pauseRealtime("group_forced_stop");
            appAlert.alert(
              "Thông báo",
              "Trưởng nhóm đã kết thúc phiên chia sẻ vị trí.",
            );
          },
        );

        void startLocationWatcher();
      },
      onDisconnect: () => {
        if (!isCurrentClient()) {
          return;
        }

        setConnectionState("disconnected");
        logGroupLiveLocation("stomp disconnected", {
          groupId: normalizedGroupId,
        });
      },
      onStompError: (frame) => {
        console.warn("[group-live-location] stomp error", {
          body: frame.body,
          headers: frame.headers,
        });

        if (!isCurrentClient()) {
          return;
        }

        setLastError(
          normalizeValue(frame.headers.message) ??
            "Kết nối live location gặp lỗi.",
        );
      },
      onWebSocketClose: () => {
        if (!isCurrentClient()) {
          return;
        }

        setConnectionState("disconnected");
        logGroupLiveLocation("websocket closed", {
          groupId: normalizedGroupId,
        });
      },
      reconnectDelay: 5000,
    });

    clientRef.current = nextClient;
    nextClient.activate();
  }

  function pauseSharing() {
    void pauseRealtime("paused");
  }

  function resumeSharing() {
    shouldMaintainSessionRef.current = true;
    syncShareMode("sharing");
    setLastError(null);
    void connectRealtime();
  }

  function stopRouteSharing() {
    void pauseRealtime("route_stopped");
  }

  function forceStopGroup() {
    if (!isLeader || !clientRef.current?.connected || !groupId) {
      return;
    }

    clientRef.current.publish({
      body: JSON.stringify({ action: "STOP_LOCATION" }),
      destination: `/app/group/${groupId}/command`,
    });
  }

  useEffect(() => {
    if (!enabled || !groupId || !myUserId) {
      shouldMaintainSessionRef.current = false;
      // Màn hình còn đang tải (`enabled` false) hoặc chưa có userId thì đây là
      // trạng thái CHƯA bắt đầu, không phải mất kết nối.
      setConnectionState("idle");
      logGroupLiveLocation("live location not started yet", {
        enabled,
        groupId,
        hasUserId: Boolean(myUserId),
      });
      return;
    }

    shouldMaintainSessionRef.current = shareModeRef.current === "sharing";

    if (shouldMaintainSessionRef.current) {
      void connectRealtime();
    }

    return () => {
      shouldMaintainSessionRef.current = false;
      clearGpsWatcher();
      void disconnectClient();
    };
  }, [enabled, groupId, myUserId, username]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "active") {
        if (
          previousState !== "active" &&
          shouldMaintainSessionRef.current &&
          shareModeRef.current === "sharing"
        ) {
          void connectRealtime();
        }
        return;
      }

      if (previousState === "active") {
        void pauseForBackground();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, groupId, username, myUserId]);

  return {
    connectionState,
    forceStopGroup,
    isPermissionGranted,
    lastError,
    locationsByUserId,
    pauseSharing,
    resumeSharing,
    shareMode,
    stopRouteSharing,
  };
}
