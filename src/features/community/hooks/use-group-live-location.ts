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

function resolveGroupWebSocketUrl() {
  const envUrl = normalizeValue(PublicEnv.groupWsUrl);
  return envUrl ?? defaultGroupWebSocketUrl;
}

function parseLocationMessage(message: IMessage): GroupLiveLocationMessage | null {
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
      readFiniteNumber(
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
      return null;
    }

    return {
      latitude,
      longitude,
      timestamp,
      userId,
      username: normalizeValue(
        typeof rawPayload.username === "string"
          ? rawPayload.username
          : typeof rawPayload.userName === "string"
            ? rawPayload.userName
            : typeof rawPayload.senderName === "string"
              ? rawPayload.senderName
              : null,
      ),
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
        await currentClient.deactivate();
      } catch (error) {
        console.warn("[group-live-location] deactivate stomp failed", {
          error,
        });
      }
    }

    setConnectionState("disconnected");
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
    if (listenOnly) {
      return;
    }

    const normalizedGroupId = normalizeValue(groupId);
    const normalizedUsername = normalizeValue(username);
    const normalizedUserId = normalizeValue(myUserId);
    const timestamp = Date.now();

    if (
      !normalizedGroupId ||
      !normalizedUserId ||
      !clientRef.current?.connected
    ) {
      return;
    }

    clientRef.current.publish({
      body: JSON.stringify({
        latitude,
        longitude,
        timestamp,
        userId: normalizedUserId,
        username: normalizedUsername,
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

    if (!permission.granted) {
      setLastError("Bạn chưa cấp quyền vị trí để chia sẻ hành trình nhóm.");
      return;
    }

    const devCoordinate = getDevelopmentLocationOverride();

    if (devCoordinate && myUserId) {
      const publishDevCoordinate = () => {
        const nextMessage = buildLocalLocationMessage(
          devCoordinate.latitude,
          devCoordinate.longitude,
        );

        if (nextMessage) {
          handleIncomingLocation(nextMessage);
          void publishLocation(nextMessage.latitude, nextMessage.longitude);
        }
      };

      publishDevCoordinate();
      devIntervalRef.current = setInterval(publishDevCoordinate, 5000);
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
        const nextMessage = buildLocalLocationMessage(
          position.coords.latitude,
          position.coords.longitude,
        );

        if (nextMessage) {
          handleIncomingLocation(nextMessage);
        }

        void publishLocation(
          position.coords.latitude,
          position.coords.longitude,
        );
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
      return;
    }

    if (!listenOnly && !myUserId) {
      return;
    }

    if (clientRef.current?.connected || clientRef.current?.active) {
      await startLocationWatcher();
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      setLastError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setLastError(null);
    setConnectionState("connecting");

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
        setConnectionState("connected");
        setLastError(null);

        const handleLocationTopicMessage = (incomingMessage: IMessage) => {
          const parsedMessage = parseLocationMessage(incomingMessage);

          if (!parsedMessage) {
            return;
          }

          handleIncomingLocation(parsedMessage);
        };
        const locationTopics = [
          `/topic/group/${normalizedGroupId}`,
          `/topic/group/${normalizedGroupId}/location`,
        ];
        locationTopicSubscriptionRef.current = locationTopics.map((topic) => ({
          key: topic,
          subscription: nextClient.subscribe(topic, handleLocationTopicMessage),
        }));

        const handleCommandTopicMessage = (incomingMessage: IMessage) => {
          const action = parseCommandAction(incomingMessage);

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
        commandSubscriptionRef.current = commandTopics.map((topic) => ({
          key: topic,
          subscription: nextClient.subscribe(topic, handleCommandTopicMessage),
        }));

        if (!listenOnly) {
          void startLocationWatcher();
        }
      },
      onDisconnect: () => {
        setConnectionState("disconnected");
      },
      onStompError: (frame) => {
        setLastError(
          normalizeValue(frame.headers.message) ??
            "Kết nối live location gặp lỗi.",
        );
      },
      onWebSocketClose: () => {
        setConnectionState("disconnected");
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
