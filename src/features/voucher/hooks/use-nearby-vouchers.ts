import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { getNearbyHotspots } from "@/features/home/api/get-nearby-hotspots";
import {
  ensureForegroundLocationPermission,
  getDeviceCoordinate,
  getDevelopmentLocationOverride,
  getDistanceMeters,
  type AppCoordinate,
} from "@/lib/location";
import {
  filterRedeemableVouchers,
  getNearbyVouchers,
  type Voucher,
} from "../api/voucher-api";

/** Mốc neo để backend tính "gần": một tuyến, một/nhiều hotspot, hoặc vị trí hiện tại. */
export type NearbyVoucherAnchor =
  | { kind: "route"; routeId: number }
  | { kind: "hotspots"; hotspotIds: number[] }
  | { kind: "current-location" };

export type NearbyVoucherHotspot = {
  hotspotId: number;
  hotspotName: string;
  /** Khoảng cách từ người dùng tới hotspot (mét); null khi không neo theo vị trí. */
  distanceMeters: number | null;
};

type UseNearbyVouchersOptions = {
  anchor: NearbyVoucherAnchor;
  /** Bán kính tìm quán quanh mỗi mốc (mét). */
  radiusMeters: number;
  enabled?: boolean;
  size?: number;
};

export type UseNearbyVouchersResult = {
  vouchers: Voucher[];
  /** Các hotspot được dùng làm mốc — để hiển thị "quanh <tên địa điểm>". */
  anchorHotspots: NearbyVoucherHotspot[];
  coordinate: AppCoordinate | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  /** Lý do không lấy được vị trí (tắt GPS, chưa cấp quyền...). */
  locationNotice: string | null;
  reload: (refresh?: boolean) => Promise<void>;
};

async function resolveCurrentCoordinate(): Promise<{
  coordinate: AppCoordinate | null;
  notice: string | null;
}> {
  const developmentLocation = getDevelopmentLocationOverride();

  if (developmentLocation) {
    return { coordinate: developmentLocation, notice: null };
  }

  if (!(await Location.hasServicesEnabledAsync())) {
    return { coordinate: null, notice: "Bật GPS để xem ưu đãi quanh bạn." };
  }

  const permission = await Location.getForegroundPermissionsAsync();
  const permissionResponse =
    permission.granted || !permission.canAskAgain
      ? permission
      : await ensureForegroundLocationPermission();

  if (permissionResponse.status !== "granted") {
    return {
      coordinate: null,
      notice: "Cho phép truy cập vị trí để xem ưu đãi quanh bạn.",
    };
  }

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // Thiết bị đã có provider đang chạy — bỏ qua.
    }
  }

  const coordinate = await getDeviceCoordinate({
    accuracy: Location.Accuracy.Balanced,
    maxAge: 60_000,
    mayShowUserSettingsDialog: Platform.OS === "android",
    requiredAccuracy: 150,
  });

  return coordinate
    ? { coordinate, notice: null }
    : { coordinate: null, notice: "Không xác định được vị trí hiện tại." };
}

/**
 * Voucher của các quán nằm quanh một tuyến / các hotspot / vị trí hiện tại.
 *
 * Với `anchor.kind === "current-location"`, hook tự tìm hotspot gần người dùng
 * qua `/api/v1/hotspots/nearby` rồi mới hỏi voucher theo `hotspotIds`. Lý do là
 * `/api/vouchers/filter` đang bỏ qua `latitude`/`longitude` do lỗi điều kiện
 * đảo dấu ở `VoucherServiceImpl#getByFilter` — xem ghi chú `NearbyVoucherParams`.
 * Hệ quả cần biết: quán chỉ hiện khi có ít nhất một hotspot trong bán kính.
 */
export function useNearbyVouchers({
  anchor,
  radiusMeters,
  enabled = true,
  size = 20,
}: UseNearbyVouchersOptions): UseNearbyVouchersResult {
  const authSession = useAuthSession();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [anchorHotspots, setAnchorHotspots] = useState<NearbyVoucherHotspot[]>([]);
  const [coordinate, setCoordinate] = useState<AppCoordinate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const anchorKey = useMemo(() => {
    if (anchor.kind === "route") return `route:${anchor.routeId}`;
    if (anchor.kind === "hotspots") {
      return `hotspots:${[...anchor.hotspotIds].sort((a, b) => a - b).join(",")}`;
    }
    return "current-location";
  }, [anchor]);

  const reload = useCallback(
    async (refresh = false) => {
      if (!enabled) return;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const isStale = () => requestIdRef.current !== requestId;

      refresh ? setIsRefreshing(true) : setIsLoading(true);
      setError(null);
      setLocationNotice(null);

      try {
        // `GET /api/vouchers/**` là public — token chỉ đính kèm khi đã đăng nhập.
        const token = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        let routeId: number | null = null;
        let hotspotIds: number[] = [];
        let hotspots: NearbyVoucherHotspot[] = [];
        let userCoordinate: AppCoordinate | null = null;

        if (anchor.kind === "route") {
          routeId = anchor.routeId;
        } else if (anchor.kind === "hotspots") {
          hotspotIds = anchor.hotspotIds;
        } else {
          const located = await resolveCurrentCoordinate();
          if (isStale()) return;

          userCoordinate = located.coordinate;
          setCoordinate(located.coordinate);

          if (!located.coordinate) {
            setLocationNotice(located.notice);
            setVouchers([]);
            setAnchorHotspots([]);
            return;
          }

          const nearbyHotspots = await getNearbyHotspots({
            accessToken: token,
            distance: radiusMeters,
            latitude: located.coordinate.latitude,
            longitude: located.coordinate.longitude,
          });
          if (isStale()) return;

          hotspots = nearbyHotspots
            .map((hotspot) => ({
              hotspotId: hotspot.hotspotId,
              hotspotName: hotspot.hotspotName,
              distanceMeters: getDistanceMeters(located.coordinate!, {
                latitude: hotspot.latitude,
                longitude: hotspot.longitude,
              }),
            }))
            .sort((left, right) => left.distanceMeters - right.distanceMeters);
          hotspotIds = hotspots.map((hotspot) => hotspot.hotspotId);

          if (hotspotIds.length === 0) {
            setLocationNotice(
              "Chưa có địa điểm nào của Culture Quest trong bán kính này.",
            );
            setVouchers([]);
            setAnchorHotspots([]);
            return;
          }
        }

        const page = await getNearbyVouchers(
          { routeId, hotspotIds, distanceMeters: radiusMeters, size },
          token,
        );
        if (isStale()) return;

        setVouchers(filterRedeemableVouchers(page.content ?? []));
        setAnchorHotspots(hotspots);
        setCoordinate(userCoordinate);
      } catch (caught) {
        if (isStale()) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Không tải được ưu đãi gần đây.",
        );
        setVouchers([]);
      } finally {
        if (!isStale()) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [anchor, authSession.isAuthenticated, enabled, radiusMeters, size],
  );

  useEffect(() => {
    if (!enabled) return;
    void reload();
    // `anchorKey` thay cho `anchor` để không chạy lại khi caller tạo object mới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, authSession.isAuthenticated, enabled, radiusMeters, size]);

  return {
    vouchers,
    anchorHotspots,
    coordinate,
    isLoading,
    isRefreshing,
    error,
    locationNotice,
    reload,
  };
}
