import { useCallback, useEffect, useRef, useState } from "react";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getRouteById,
  getRouteCoverUrl,
  getUserRouteProgressList,
  type ProgressStatus,
  type UserRouteProgressDto,
} from "@/features/route/api/route-api";

export type ProfileRouteParticipant = UserRouteProgressDto & {
  address: string | null;
  cover: string | null;
  description: string;
  estimateTime: number | null;
  rating: number | null;
  tagNames: string[];
  totalDistance: number | null;
  totalReviews: number | null;
  xp: number | null;
};

type UseRouteParticipantsResult = {
  error: Error | null;
  isLoading: boolean;
  participants: ProfileRouteParticipant[];
  reload: () => Promise<void>;
};

const PAGE_SIZE = 20;
const MAX_PAGES = 20;
const ROUTE_PROGRESS_STATUSES: readonly ProgressStatus[] = [
  "IN_PROGRESS",
  "COMPLETED",
];

async function fetchParticipantsByStatus({
  accessToken,
  status,
  tokenType,
}: {
  accessToken: string;
  status: ProgressStatus;
  tokenType?: string | null;
}) {
  const participants: UserRouteProgressDto[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await getUserRouteProgressList({
      accessToken,
      page,
      size: PAGE_SIZE,
      sortBy: "startedAt",
      sortDirection: "DESC",
      status,
      tokenType,
    });

    participants.push(...response.content);

    if (
      response.content.length === 0 ||
      response.content.length < (response.size || PAGE_SIZE) ||
      page >= response.totalPages - 1
    ) {
      break;
    }
  }

  return participants;
}

async function fetchRouteParticipants({
  accessToken,
  tokenType,
}: {
  accessToken: string;
  tokenType?: string | null;
}) {
  const participantGroups = await Promise.all(
    ROUTE_PROGRESS_STATUSES.map((status) =>
      fetchParticipantsByStatus({
        accessToken,
        status,
        tokenType,
      }),
    ),
  );

  return participantGroups.flat();
}

// API route-participants chỉ trả tên tuyến, phải gọi thêm route detail để có
// ảnh bìa, địa chỉ và metadata để render card kiểu row ở profile.
async function enrichWithRouteDetail({
  accessToken,
  participants,
  tokenType,
}: {
  accessToken: string;
  participants: UserRouteProgressDto[];
  tokenType?: string | null;
}): Promise<ProfileRouteParticipant[]> {
  const uniqueRouteIds = Array.from(
    new Set(participants.map((participant) => participant.routeId)),
  );
  const results = await Promise.allSettled(
    uniqueRouteIds.map((routeId) =>
      getRouteById({ accessToken, routeId, tokenType }),
    ),
  );
  const routeById = new Map(
    results
      .filter((result) => result.status === "fulfilled")
      .map((result) => [result.value.routeId, result.value] as const),
  );

  return participants.map((participant) => {
    const route = routeById.get(participant.routeId) ?? null;

    return {
      ...participant,
      address: route?.hotspots.find((hotspot) => hotspot.address?.trim())?.address?.trim() ?? null,
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
      routeName: participant.routeName ?? route?.routeName ?? null,
      tagNames: (route?.tags ?? [])
        .map((tag) => tag.tagName?.trim() ?? "")
        .filter(Boolean),
      totalDistance: route?.totalDistance ?? null,
      totalReviews:
        typeof route?.totalReviews === "number" &&
        Number.isFinite(route.totalReviews)
          ? Math.max(0, Math.round(route.totalReviews))
          : null,
      xp: route?.xp ?? null,
    };
  });
}

function readStartedAtTimestamp(participant: UserRouteProgressDto) {
  const timestamp = Date.parse(participant.startedAt ?? "");

  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function useRouteParticipants(): UseRouteParticipantsResult {
  const authSession = useAuthSession();
  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const [participants, setParticipants] = useState<ProfileRouteParticipant[]>(
    [],
  );
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
      setParticipants([]);
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

      const routeParticipants = await fetchRouteParticipants({
        accessToken,
        tokenType: authSession.tokenType,
      });

      const mergedById = new Map(
        routeParticipants.map(
          (participant) =>
            [participant.userRouteProgressId, participant] as const,
        ),
      );
      const sortedParticipants = Array.from(mergedById.values()).sort(
        (left, right) =>
          readStartedAtTimestamp(right) - readStartedAtTimestamp(left),
      );

      const enrichedParticipants = await enrichWithRouteDetail({
        accessToken,
        participants: sortedParticipants,
        tokenType: authSession.tokenType,
      });

      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      setParticipants(enrichedParticipants);
    } catch (nextError) {
      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      console.warn("[profile] route participants unavailable", nextError);
      setParticipants([]);
      setError(
        nextError instanceof Error
          ? nextError
          : new Error("Không thể tải tuyến đường của bạn."),
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

  return { error, isLoading, participants, reload };
}
