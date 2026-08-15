import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import * as Location from "expo-location";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
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
  | "connecting"
  | "connected"
  | "disconnected";

type StopMode = "group_forced_stop" | "paused" | "route_stopped";
type TopicSubscriptionEntry = {
  key: string;
  subscription: StompSubscription;
};

type UseGroupLiveLocationParams = {
  enabled: boolean;
  groupId: string | null;
  isLeader: boolean;
  listenOnly?: boolean;
  myUserId: string | null;
  showForcedStopAlert?: boolean;
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
const groupLiveLocationDebugEnabled = __DEV__;
const initialLocationMaxAgeInMs = 60_000;
const initialLocationRequiredAccuracyInMeters = 200;
const liveLocationDistanceIntervalInMeters = 5;
const liveLocationTimeIntervalInMs = 5_000;

function normalizeValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

/**
 * `LocationMessage.timestamp` của backend là `LocalDateTime`, và converter của
 * STOMP broker (MappingJackson2MessageConverter) bật WRITE_DATES_AS_TIMESTAMPS
 * nên nó ra mảng `[2026,8,15,10,11,12,nano]` chứ không phải chuỗi ISO. Nếu chỉ
 * đọc số thì mọi mốc thời gian đều hỏng, khiến "cập nhật lúc" và mốc 15s coi
 * thành viên là offline bị sai. Chấp nhận cả 3 dạng: số epoch, chuỗi ISO, mảng.
 */
function readTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value.map(
      (part) => readFiniteNumber(part) ?? 0,
    );

    if (!year || !month || !day) {
      return null;
    }

    // LocalDateTime không kèm timezone; server và thiết bị cùng múi giờ VN nên
    // dựng theo giờ local là sát nhất với ý nghĩa gốc.
    const parsedDate = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    const parsedDate = new Date(value.trim());
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
  }

  return null;
}

function resolveGroupWebSocketUrl() {
  const envUrl = normalizeValue(PublicEnv.groupWsUrl);
  const rawUrl = envUrl ?? defaultGroupWebSocketUrl;

  try {
    const parsedUrl = new URL(rawUrl);

    if (/\/ws\/?$/i.test(parsedUrl.pathname)) {
      parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/g, "")}/websocket`;
    }

    return parsedUrl.toString();
  } catch {
    if (/\/ws\/?$/i.test(rawUrl)) {
      return `${rawUrl.replace(/\/+$/g, "")}/websocket`;
    }

    return rawUrl;
  }
}

function summarizeMessageBody(body: string, maxLength = 240) {
  const normalizedBody = body.replace(/\s+/g, " ").trim();
  return normalizedBody.length <= maxLength
    ? normalizedBody
    : `${normalizedBody.slice(0, maxLength)}...`;
}

function readMessageTopic(message: IMessage) {
  return (
    normalizeValue(message.headers.destination) ??
    normalizeValue(message.headers.subscription) ??
    "unknown"
  );
}

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

function parseLocationMessage(
  message: IMessage,
  sourceTopic?: string,
): GroupLiveLocationMessage | null {
  try {
    const rawPayload = JSON.parse(message.body) as Record<string, unknown>;
    const coordinatePayload =
      typeof rawPayload.coordinate === "object" && rawPayload.coordinate !== null
        ? (rawPayload.coordinate as Record<string, unknown>)
        : null;
    const latitude =
      readFiniteNumber(
        rawPayload.latitude ??
          rawPayload.lat ??
          rawPayload.userLatitude ??
          coordinatePayload?.latitude ??
          coordinatePayload?.lat,
      ) ?? null;
    const longitude =
      readFiniteNumber(
        rawPayload.longitude ??
          rawPayload.lng ??
          rawPayload.lon ??
          rawPayload.userLongitude ??
          coordinatePayload?.longitude ??
          coordinatePayload?.lng ??
          coordinatePayload?.lon,
      ) ?? null;
    const timestamp =
      readTimestamp(
        rawPayload.timestamp ??
          rawPayload.sentAt ??
          rawPayload.createdAt ??
          rawPayload.updatedAt,
      ) ?? Date.now();
    const rawUserId =
      rawPayload.userId ??
      rawPayload.user_id ??
      rawPayload.memberId ??
      rawPayload.member_id ??
      rawPayload.senderId ??
      rawPayload.sender_id;
    const userId =
      typeof rawUserId === "number" && Number.isFinite(rawUserId)
        ? `${Math.trunc(rawUserId)}`
        : normalizeValue(typeof rawUserId === "string" ? rawUserId : null);

    if (!userId || latitude === null || longitude === null) {
      logGroupLiveLocation("location payload ignored", {
        body: summarizeMessageBody(message.body),
        latitude,
        longitude,
        sourceTopic: sourceTopic ?? readMessageTopic(message),
        timestamp,
        userId,
      });
      return null;
    }

    const parsedMessage = {
      latitude,
      longitude,
      timestamp,
      userId,
      // Backend broadcast field tên là `displayName` (LocationMessage), phải
      // đọc trước mấy tên cũ nếu không tên thành viên luôn rỗng.
      username: normalizeValue(
        typeof rawPayload.displayName === "string"
          ? rawPayload.displayName
          : typeof rawPayload.username === "string"
            ? rawPayload.username
            : typeof rawPayload.userName === "string"
              ? rawPayload.userName
              : typeof rawPayload.senderName === "string"
                ? rawPayload.senderName
                : null,
      ),
    } satisfies GroupLiveLocationMessage;

    logGroupLiveLocation("location payload parsed", {
      latitude: parsedMessage.latitude,
      longitude: parsedMessage.longitude,
      sourceTopic: sourceTopic ?? readMessageTopic(message),
      timestamp: parsedMessage.timestamp,
      userId: parsedMessage.userId,
      username: parsedMessage.username,
    });

    return parsedMessage;
  } catch (error) {
    console.warn("[group-live-location] parse location payload failed", {
      error,
      body: message.body,
      sourceTopic: sourceTopic ?? readMessageTopic(message),
    });
    return null;
  }
}

function parseCommandAction(message: IMessage, sourceTopic?: string) {
  try {
    const rawPayload = JSON.parse(message.body) as Record<string, unknown>;
    const action = normalizeValue(
      typeof rawPayload.action === "string" ? rawPayload.action : null,
    );

    logGroupLiveLocation("command payload received", {
      action,
      body: summarizeMessageBody(message.body),
      sourceTopic: sourceTopic ?? readMessageTopic(message),
    });

    return action;
  } catch (error) {
    console.warn("[group-live-location] parse command payload failed", {
      error,
      body: message.body,
      sourceTopic: sourceTopic ?? readMessageTopic(message),
    });
    return null;
  }
}

export function useGroupLiveLocation({
  enabled,
  groupId,
  isLeader,
  listenOnly = false,
  myUserId,
  showForcedStopAlert = true,
  username,
}: UseGroupLiveLocationParams): UseGroupLiveLocationResult {
  const authSession = useAuthSession();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const clientRef = useRef<Client | null>(null);
  const commandSubscriptionRef = useRef<TopicSubscriptionEntry[]>([]);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const locationTopicSubscriptionRef = useRef<TopicSubscriptionEntry[]>([]);
  const devIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldMaintainSessionRef = useRef(false);
  const shareModeRef = useRef<GroupLiveShareMode>("sharing");
  const [connectionState, setConnectionState] =
    useState<GroupLiveConnectionState>("disconnected");
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

  function clearTopicSubscriptions(
    subscriptionRef: MutableRefObject<TopicSubscriptionEntry[]>,
  ) {
    subscriptionRef.current.forEach((entry) => {
      try {
        entry.subscription.unsubscribe();
        logGroupLiveLocation("unsubscribe topic", {
          topic: entry.key,
        });
      } catch (error) {
        console.warn("[group-live-location] unsubscribe topic failed", {
          error,
          topic: entry.key,
        });
      }
    });
    subscriptionRef.current = [];
  }

  function clearGpsWatcher() {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;

    if (devIntervalRef.current) {
      clearInterval(devIntervalRef.current);
      devIntervalRef.current = null;
    }
  }

  async function disconnectClient() {
    clearTopicSubscriptions(commandSubscriptionRef);
    clearTopicSubscriptions(locationTopicSubscriptionRef);

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
    // thái vô điều kiện thì lần "disconnected" muộn này ghi đè lên
    // "connected" của client mới và banner kẹt ở "Mất kết nối" dù đang online.
    if (clientRef.current === null) {
      setConnectionState("disconnected");
    }
  }

  async function pauseRealtime(stopMode: StopMode) {
    clearGpsWatcher();
    shouldMaintainSessionRef.current = false;
    syncShareMode(stopMode);
    logGroupLiveLocation("pause realtime", {
      stopMode,
    });
    await disconnectClient();
  }

  async function pauseForBackground() {
    clearGpsWatcher();
    logGroupLiveLocation("pause for background");
    await disconnectClient();
  }

  function handleIncomingLocation(message: GroupLiveLocationMessage) {
    logGroupLiveLocation("apply incoming location", {
      latitude: message.latitude,
      longitude: message.longitude,
      timestamp: message.timestamp,
      userId: message.userId,
      username: message.username,
    });
    setLocationsByUserId((currentLocations) => ({
      ...currentLocations,
      [message.userId]: message,
    }));
  }

  async function emitLocalLocation(latitude: number, longitude: number) {
    const nextMessage = buildLocalLocationMessage(latitude, longitude);

    if (nextMessage) {
      handleIncomingLocation(nextMessage);
    }

    await publishLocation(latitude, longitude);
  }

  async function publishInitialLocationSnapshot() {
    if (listenOnly || !myUserId) {
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
          latitude: lastKnownPosition.coords.latitude,
          longitude: lastKnownPosition.coords.longitude,
          userId: myUserId,
        });
        await emitLocalLocation(
          lastKnownPosition.coords.latitude,
          lastKnownPosition.coords.longitude,
        );
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      logGroupLiveLocation("use current position snapshot", {
        accuracy: currentPosition.coords.accuracy ?? null,
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        userId: myUserId,
      });
      await emitLocalLocation(
        currentPosition.coords.latitude,
        currentPosition.coords.longitude,
      );
    } catch (error) {
      console.warn("[group-live-location] initial position snapshot failed", {
        error,
        userId: myUserId,
      });
    }
  }

  async function publishLocation(latitude: number, longitude: number) {
    if (listenOnly) {
      return;
    }

    const normalizedGroupId = normalizeValue(groupId);
    const normalizedUsername = normalizeValue(username);
    const normalizedUserId = normalizeValue(myUserId);

    if (
      !normalizedGroupId ||
      !normalizedUserId ||
      !clientRef.current?.connected
    ) {
      logGroupLiveLocation("skip publish location", {
        connected: Boolean(clientRef.current?.connected),
        groupId: normalizedGroupId,
        hasUserId: Boolean(normalizedUserId),
        latitude,
        longitude,
      });
      return;
    }

    logGroupLiveLocation("publish location", {
      destination: `/app/group/${normalizedGroupId}/location`,
      displayName: normalizedUsername,
      latitude,
      longitude,
      userId: normalizedUserId,
    });
    /**
     * Body phải khớp đúng `LocationMessage` của backend:
     * `{ userId: Long, displayName: String, latitude: Double, longitude: Double,
     *    timestamp: LocalDateTime }`.
     *
     * KHÔNG gửi `timestamp`: trước đây client gửi `Date.now()` (số epoch ms),
     * Jackson không đổi số thành `LocalDateTime` được ("raw timestamp not
     * allowed for java.time.LocalDateTime") nên message bị từ chối ngay ở bước
     * convert — handler @MessageMapping không bao giờ chạy, không ai được
     * broadcast vị trí, và STOMP session bị đóng kèm ERROR frame (chính là lỗi
     * "mất kết nối" ngay khi bắt đầu chia sẻ). Server tự set
     * `LocalDateTime.now()` nên bỏ hẳn field này là đúng nhất.
     *
     * `username` cũng không tồn tại trong DTO — tên đúng là `displayName`.
     */
    clientRef.current.publish({
      body: JSON.stringify({
        displayName: normalizedUsername,
        latitude,
        longitude,
        userId: normalizedUserId,
      }),
      destination: `/app/group/${normalizedGroupId}/location`,
    });
  }

  function buildLocalLocationMessage(latitude: number, longitude: number) {
    const normalizedUserId = normalizeValue(myUserId);

    if (!normalizedUserId) {
      return null;
    }

    return {
      latitude,
      longitude,
      timestamp: Date.now(),
      userId: normalizedUserId,
      username: normalizeValue(username),
    } satisfies GroupLiveLocationMessage;
  }

  async function startLocationWatcher() {
    if (listenOnly) {
      return;
    }

    if (locationSubscriptionRef.current || devIntervalRef.current) {
      return;
    }

    const permission = await ensureForegroundLocationPermission();
    setIsPermissionGranted(permission.granted);
    logGroupLiveLocation("location permission resolved", {
      granted: permission.granted,
    });

    if (!permission.granted) {
      setLastError("Bạn chưa cấp quyền vị trí để chia sẻ hành trình nhóm.");
      return;
    }

    const devCoordinate = getDevelopmentLocationOverride();

    if (devCoordinate && myUserId) {
      logGroupLiveLocation("use development location override", {
        latitude: devCoordinate.latitude,
        longitude: devCoordinate.longitude,
      });
      const publishDevCoordinate = () => {
        const nextMessage = buildLocalLocationMessage(
          devCoordinate.latitude,
          devCoordinate.longitude,
        );

        if (!nextMessage) {
          return;
        }

        logGroupLiveLocation("dev coordinate tick", {
          latitude: nextMessage.latitude,
          longitude: nextMessage.longitude,
          userId: nextMessage.userId,
        });
        void emitLocalLocation(nextMessage.latitude, nextMessage.longitude);
      };

      publishDevCoordinate();
      devIntervalRef.current = setInterval(publishDevCoordinate, 5000);
      return;
    }

    void publishInitialLocationSnapshot();

    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: liveLocationDistanceIntervalInMeters,
        mayShowUserSettingsDialog: true,
        timeInterval: liveLocationTimeIntervalInMs,
      },
      (position) => {
        const nextMessage = buildLocalLocationMessage(
          position.coords.latitude,
          position.coords.longitude,
        );

        if (!nextMessage) {
          return;
        }

        logGroupLiveLocation("gps position update", {
          accuracy: position.coords.accuracy ?? null,
          latitude: nextMessage.latitude,
          longitude: nextMessage.longitude,
          userId: nextMessage.userId,
        });

        void emitLocalLocation(
          position.coords.latitude,
          position.coords.longitude,
        );
      },
      (reason) => {
        setLastError(reason);
        console.warn("[group-live-location] watch position failed", {
          reason,
          userId: myUserId,
        });
      },
    );
  }

  async function connectRealtime() {
    const normalizedGroupId = normalizeValue(groupId);

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

    if (!listenOnly && !myUserId) {
      logGroupLiveLocation("skip connect realtime: missing user id", {
        groupId: normalizedGroupId,
        listenOnly,
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
      listenOnly,
      userId: normalizeValue(myUserId),
      username: normalizeValue(username),
      wsUrl: resolveGroupWebSocketUrl(),
    });

    /**
     * Client cũ vẫn bắn onDisconnect/onWebSocketClose sau khi bị thay thế. Mọi
     * callback vì thế phải tự kiểm tra mình còn là client đang dùng hay không,
     * nếu không trạng thái kết nối của client mới sẽ bị client cũ ghi đè.
     */
    const isCurrentClient = () => clientRef.current === nextClient;
    const nextClient = new Client({
      appendMissingNULLonIncoming: true,
      brokerURL: resolveGroupWebSocketUrl(),
      connectHeaders: {
        Authorization: `${authSession.tokenType ?? "Bearer"} ${accessToken}`,
      },
      debug:
        __DEV__
          ? (message) => {
              console.info("[group-live-location]", message);
            }
          : undefined,
      forceBinaryWSFrames: true,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        if (!isCurrentClient()) {
          logGroupLiveLocation("ignore stale stomp connect", {
            groupId: normalizedGroupId,
          });
          return;
        }

        setConnectionState("connected");
        setLastError(null);
        logGroupLiveLocation("stomp connected", {
          groupId: normalizedGroupId,
        });

        const handleLocationTopicMessage = (
          topic: string,
          incomingMessage: IMessage,
        ) => {
          logGroupLiveLocation("location topic message", {
            body: summarizeMessageBody(incomingMessage.body),
            topic,
          });

          const parsedMessage = parseLocationMessage(incomingMessage, topic);

          if (!parsedMessage) {
            return;
          }

          handleIncomingLocation(parsedMessage);
        };
        const locationTopics = [
          `/topic/group/${normalizedGroupId}`,
          `/topic/group/${normalizedGroupId}/location`,
        ];
        locationTopicSubscriptionRef.current = locationTopics.map((topic) => {
          logGroupLiveLocation("subscribe location topic", { topic });
          return {
            key: topic,
            subscription: nextClient.subscribe(topic, (incomingMessage) => {
              handleLocationTopicMessage(topic, incomingMessage);
            }),
          };
        });

        const handleCommandTopicMessage = (
          topic: string,
          incomingMessage: IMessage,
        ) => {
          const action = parseCommandAction(incomingMessage, topic);

          if (action !== "STOP_LOCATION") {
            return;
          }

          void pauseRealtime("group_forced_stop");

          if (showForcedStopAlert) {
            appAlert.alert(
              "Thông báo",
              "Trưởng nhóm đã kết thúc phiên chia sẻ vị trí.",
            );
          }
        };
        const commandTopics = [
          `/topic/group/${normalizedGroupId}/commands`,
          `/topic/group/${normalizedGroupId}/command`,
        ];
        commandSubscriptionRef.current = commandTopics.map((topic) => {
          logGroupLiveLocation("subscribe command topic", { topic });
          return {
            key: topic,
            subscription: nextClient.subscribe(topic, (incomingMessage) => {
              handleCommandTopicMessage(topic, incomingMessage);
            }),
          };
        });

        if (!listenOnly) {
          void startLocationWatcher();
        }
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
    if (
      !enabled ||
      !groupId ||
      (!listenOnly && !myUserId)
    ) {
      shouldMaintainSessionRef.current = false;
      clearGpsWatcher();
      const timeoutId = setTimeout(() => {
        void disconnectClient();
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    }

    shouldMaintainSessionRef.current = shareModeRef.current === "sharing";

    if (shouldMaintainSessionRef.current) {
      // Bám GPS ngay, không chờ STOMP connect. Vị trí của chính mình được đẩy
      // vào state cục bộ (emitLocalLocation), nên tách khỏi socket thì user
      // vẫn thấy chấm của mình trên bản đồ lúc đang kết nối lại — trước đây
      // watcher chỉ khởi động trong onConnect nên socket lỗi là bản đồ trống.
      // publishLocation tự bỏ qua khi chưa connected.
      void startLocationWatcher();
      void connectRealtime();
    }

    return () => {
      shouldMaintainSessionRef.current = false;
      clearGpsWatcher();
      void disconnectClient();
    };
  }, [enabled, groupId, listenOnly, myUserId, username]);

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
  }, [enabled, groupId, listenOnly, myUserId, username]);

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
