import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

import {
  ensureForegroundLocationPermission,
  getDevelopmentLocationOverride,
  getDistanceMeters,
  type AppCoordinate,
} from "@/lib/location";

export type CheckInZoneStatus =
  | "loading"
  | "ready"
  | "too-far"
  | "permission-denied"
  | "error";

/** Khớp với CheckInPolicy.MAX_GPS_ACCURACY_TOLERANCE_METERS ở backend. */
const MAX_GPS_ACCURACY_TOLERANCE_METERS = 100;
const DEFAULT_CHECK_IN_RADIUS_METERS = 50;

type Coordinate = { latitude: number; longitude: number };

type UseCheckInZoneOptions = {
  hotspotCoordinate: Coordinate | null;
  checkInRadius?: number | null;
  boundaryGeoJson?: string | null;
  /** Hotspot demo luôn ở trạng thái sẵn sàng, bỏ qua GPS. */
  alwaysReady?: boolean;
  enabled: boolean;
};

export type UseCheckInZoneResult = {
  status: CheckInZoneStatus;
  distanceMeters: number | null;
  requiredMeters: number;
  currentCoordinate: AppCoordinate | null;
  retry: () => void;
};

export function parseBoundaryVertices(raw: string | null | undefined): Coordinate[] {
  if (!raw || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      coordinates?: number[][][];
      geometry?: { type?: string; coordinates?: number[][][] };
    };
    const geometry = parsed.coordinates ? parsed : parsed.geometry;
    const ring = geometry?.coordinates?.[0];

    if (!Array.isArray(ring)) {
      return [];
    }

    // GeoJSON là [longitude, latitude] — đảo lại cho khớp react-native-maps.
    return ring
      .filter(
        (position) =>
          Array.isArray(position) &&
          position.length >= 2 &&
          Number.isFinite(position[0]) &&
          Number.isFinite(position[1]),
      )
      .map((position) => ({ latitude: position[1], longitude: position[0] }));
  } catch {
    return [];
  }
}

function isPointInPolygon(point: Coordinate, vertices: Coordinate[]) {
  if (vertices.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const vertexI = vertices[i];
    const vertexJ = vertices[j];

    const straddlesRay =
      vertexI.latitude > point.latitude !== vertexJ.latitude > point.latitude;
    if (!straddlesRay) {
      continue;
    }

    const intersectLongitude =
      ((vertexJ.longitude - vertexI.longitude) * (point.latitude - vertexI.latitude)) /
        (vertexJ.latitude - vertexI.latitude) +
      vertexI.longitude;

    if (point.longitude < intersectLongitude) {
      inside = !inside;
    }
  }

  return inside;
}

/** Khoảng cách tới cạnh gần nhất, để hiện "còn bao xa" khi đứng ngoài polygon. */
function distanceToPolygon(point: Coordinate, vertices: Coordinate[]) {
  let nearest = Number.POSITIVE_INFINITY;

  for (let i = 0; i < vertices.length; i += 1) {
    const distance = getDistanceMeters(point, vertices[i]);
    if (distance < nearest) {
      nearest = distance;
    }
  }

  return Number.isFinite(nearest) ? nearest : 0;
}

/**
 * Theo dõi vị trí liên tục và tự bật/tắt trạng thái "đã đến nơi" giống Google Maps.
 *
 * Đánh giá chạy ngay trên máy bằng bán kính/ranh giới đã tải kèm hotspot, nên
 * không tốn request và vẫn mượt khi sóng yếu — khu du lịch thường sóng kém.
 * Server vẫn kiểm tra lại lúc bấm check-in nên không gian lận được.
 */
export function useCheckInZone({
  hotspotCoordinate,
  checkInRadius,
  boundaryGeoJson,
  alwaysReady = false,
  enabled,
}: UseCheckInZoneOptions): UseCheckInZoneResult {
  const [status, setStatus] = useState<CheckInZoneStatus>("loading");
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [currentCoordinate, setCurrentCoordinate] = useState<AppCoordinate | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const boundaryVertices = useMemo(
    () => parseBoundaryVertices(boundaryGeoJson),
    [boundaryGeoJson],
  );

  const effectiveRadius = useMemo(() => {
    return typeof checkInRadius === "number" && Number.isFinite(checkInRadius)
      ? checkInRadius
      : DEFAULT_CHECK_IN_RADIUS_METERS;
  }, [checkInRadius]);

  const [requiredMeters, setRequiredMeters] = useState(effectiveRadius);

  const evaluate = useCallback(
    (coordinate: AppCoordinate) => {
      if (!hotspotCoordinate) {
        return;
      }

      const tolerance = Math.min(
        Math.max(coordinate.accuracy ?? 0, 0),
        MAX_GPS_ACCURACY_TOLERANCE_METERS,
      );

      setCurrentCoordinate(coordinate);

      if (boundaryVertices.length >= 3) {
        const inside = isPointInPolygon(coordinate, boundaryVertices);
        const edgeDistance = inside ? 0 : distanceToPolygon(coordinate, boundaryVertices);

        setDistanceMeters(edgeDistance);
        setRequiredMeters(tolerance);
        setStatus(inside || edgeDistance <= tolerance ? "ready" : "too-far");
        return;
      }

      const distance = getDistanceMeters(coordinate, hotspotCoordinate);
      const required = effectiveRadius + tolerance;

      setDistanceMeters(distance);
      setRequiredMeters(required);
      setStatus(distance <= required ? "ready" : "too-far");
    },
    [hotspotCoordinate, boundaryVertices, effectiveRadius],
  );

  useEffect(() => {
    if (!enabled || !hotspotCoordinate) {
      return;
    }

    let isCancelled = false;

    async function startWatching() {
      if (alwaysReady) {
        setCurrentCoordinate({
          ...hotspotCoordinate!,
          accuracy: 0,
          source: "dev-override",
        });
        setDistanceMeters(0);
        setRequiredMeters(effectiveRadius);
        setStatus("ready");
        return;
      }

      const developmentLocation = getDevelopmentLocationOverride();
      if (developmentLocation) {
        evaluate(developmentLocation);
        return;
      }

      try {
        setStatus("loading");

        const permission = await ensureForegroundLocationPermission();
        if (isCancelled) {
          return;
        }

        if (permission.status !== "granted") {
          setStatus("permission-denied");
          return;
        }

        if (Platform.OS === "android") {
          try {
            await Location.enableNetworkProviderAsync();
          } catch {
            // Người dùng từ chối bật dịch vụ vị trí; watcher bên dưới sẽ báo lỗi.
          }
        }

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 3000,
          },
          (position) => {
            if (isCancelled) {
              return;
            }
            evaluate({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy ?? null,
              source: "device",
            });
          },
        );

        if (isCancelled) {
          subscription.remove();
          return;
        }

        subscriptionRef.current = subscription;
      } catch {
        if (!isCancelled) {
          setStatus("error");
        }
      }
    }

    void startWatching();

    return () => {
      isCancelled = true;
      // Bắt buộc gỡ watcher, nếu không sẽ rò rỉ và hao pin sau khi đóng overlay.
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [enabled, hotspotCoordinate, alwaysReady, effectiveRadius, evaluate, retryToken]);

  const retry = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setStatus("loading");
    setRetryToken((token) => token + 1);
  }, []);

  return { status, distanceMeters, requiredMeters, currentCoordinate, retry };
}
