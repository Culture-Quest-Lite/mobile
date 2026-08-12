import { useCallback, useEffect, useRef, useState } from "react";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getRouteById,
  getRouteCoverUrl,
  getSavedRoutes,
  type RouteDto,
  type SavedRouteDto,
} from "@/features/route/api/route-api";

export type ProfileSavedRoute = SavedRouteDto & {
  address: string | null;
  cover: string | null;
  description: string;
  estimateTime: number | null;
  rating: number | null;
  route: RouteDto | null;
  routeName: string;
  tagNames: string[];
  totalDistance: number | null;
  totalReviews: number | null;
  totalStops: number;
  xp: number | null;
};

type UseSavedRoutesResult = {
  error: Error | null;
  isLoading: boolean;
  reload: () => Promise<void>;
  routes: ProfileSavedRoute[];
};

function isTimestampWithTimezone(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function parseApiTimestamp(value?: string | null) {
  const normalizedValue = typeof value === "string"
    ? value.trim().replace(" ", "T")
    : "";

  if (!normalizedValue) {
    return null;
  }

  const resolvedValue = isTimestampWithTimezone(normalizedValue)
    ? normalizedValue
    : `${normalizedValue}Z`;
  const parsedDate = new Date(resolvedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function resolveSavedAtTimestamp(route: SavedRouteDto) {
  return parseApiTimestamp(route.savedAt)?.getTime() ?? 0;
}

function enrichSavedRoutes({
  routeById,
  savedRoutes,
}: {
  routeById: Map<number, RouteDto>;
  savedRoutes: SavedRouteDto[];
}) {
  return savedRoutes
    .map((savedRoute) => {
      const route = routeById.get(savedRoute.routeId) ?? savedRoute.route ?? null;

      return {
        ...savedRoute,
        address:
          route?.hotspots
            .find((hotspot) => hotspot.address?.trim())
            ?.address?.trim() ?? null,
        cover: route ? getRouteCoverUrl(route) : null,
        description: route?.description.trim() ?? "",
        estimateTime: route?.estimateTime ?? null,
        rating:
          typeof route?.averageRating === "number" &&
          Number.isFinite(route.averageRating)
            ? route.averageRating
            : typeof route?.point === "number" && Number.isFinite(route.point)
              ? route.point
              : null,
        route,
        routeName:
          route?.routeName?.trim() || `Tuyến đường #${savedRoute.routeId}`,
        tagNames: (route?.tags ?? [])
          .map((tag) => tag.tagName?.trim() ?? "")
          .filter(Boolean),
        totalDistance: route?.totalDistance ?? null,
        totalReviews:
          typeof route?.totalReviews === "number" &&
          Number.isFinite(route.totalReviews)
            ? Math.max(0, Math.round(route.totalReviews))
            : null,
        totalStops: Array.isArray(route?.hotspots) ? route.hotspots.length : 0,
        xp: route?.xp ?? null,
      } satisfies ProfileSavedRoute;
    })
    .sort((left, right) => {
      const timestampDelta =
        resolveSavedAtTimestamp(right) - resolveSavedAtTimestamp(left);

      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return right.savedRouteId - left.savedRouteId;
    });
}

export function useSavedRoutes(): UseSavedRoutesResult {
  const authSession = useAuthSession();
  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const [routes, setRoutes] = useState<ProfileSavedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(authSession.isAuthenticated);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!authSession.isAuthenticated) {
      setError(null);
      setRoutes([]);
      setIsLoading(false);
      return;
    }

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
      }

      const savedRoutes = await getSavedRoutes({
        accessToken,
        tokenType: authSession.tokenType,
      });
      const missingRouteIds = Array.from(
        new Set(
          savedRoutes
            .filter((savedRoute) => savedRoute.route?.routeId == null)
            .map((savedRoute) => savedRoute.routeId)
            .filter((routeId) => Number.isInteger(routeId) && routeId > 0),
        ),
      );
      const routeResults = await Promise.allSettled(
        missingRouteIds.map((routeId) =>
          getRouteById({
            accessToken,
            routeId,
            tokenType: authSession.tokenType,
          }),
        ),
      );
      const routeById = new Map<number, RouteDto>();

      routeResults.forEach((result) => {
        if (result.status === "fulfilled") {
          routeById.set(result.value.routeId, result.value);
        } else {
          console.warn("[profile] load saved route detail failed", result.reason);
        }
      });

      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      setRoutes(
        enrichSavedRoutes({
          routeById,
          savedRoutes,
        }),
      );
    } catch (nextError) {
      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      console.warn("[profile] saved routes unavailable", nextError);
      setRoutes([]);
      setError(
        nextError instanceof Error
          ? nextError
          : new Error("Không thể tải tuyến đường đã lưu."),
      );
    } finally {
      if (isMountedRef.current && requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [authSession.isAuthenticated, authSession.tokenType]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void reload();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [reload]);

  return { error, isLoading, reload, routes };
}
