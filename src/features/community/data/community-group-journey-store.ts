import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

export type CommunityGroupJourneySession = {
  groupId: string | null;
  groupName: string | null;
  routeId: string | null;
  routeName: string;
  shareToken: string | null;
  startedAt: number | null;
};

const COMMUNITY_GROUP_JOURNEY_STORAGE_KEY = "community-group-journey-sessions";
const journeySessionsByShareToken = new Map<string, CommunityGroupJourneySession>();
const journeySessionsByGroupId = new Map<string, CommunityGroupJourneySession>();

function normalizeValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeJourneySession(
  session: CommunityGroupJourneySession,
): CommunityGroupJourneySession {
  return {
    ...session,
    groupId: normalizeValue(session.groupId),
    groupName: normalizeValue(session.groupName),
    routeId: normalizeValue(session.routeId),
    routeName: normalizeValue(session.routeName) ?? "Hành trình nhóm",
    shareToken: normalizeValue(session.shareToken),
    startedAt:
      typeof session.startedAt === "number" && Number.isFinite(session.startedAt)
        ? session.startedAt
        : null,
  };
}

function getStoredJourneySessions() {
  const storedSessions = readStoredJson<CommunityGroupJourneySession[]>(
    COMMUNITY_GROUP_JOURNEY_STORAGE_KEY,
    [],
  );

  return Array.isArray(storedSessions)
    ? storedSessions
        .filter(
          (value): value is CommunityGroupJourneySession =>
            Boolean(value) && typeof value === "object",
        )
        .map(normalizeJourneySession)
    : [];
}

function writeJourneySessionsToStorage() {
  const persistedSessions = Array.from(
    new Map(
      [
        ...Array.from(journeySessionsByShareToken.values()),
        ...Array.from(journeySessionsByGroupId.values()),
      ].map((session) => [`${session.shareToken ?? ""}:${session.groupId ?? ""}`, session]),
    ).values(),
  );

  writeStoredJson(COMMUNITY_GROUP_JOURNEY_STORAGE_KEY, persistedSessions);
}

function hydrateJourneySessionsFromStorage() {
  const storedSessions = getStoredJourneySessions();

  for (const session of storedSessions) {
    if (session.shareToken) {
      journeySessionsByShareToken.set(session.shareToken, session);
    }

    if (session.groupId) {
      journeySessionsByGroupId.set(session.groupId, session);
    }
  }
}

hydrateJourneySessionsFromStorage();

export function cacheCommunityGroupJourneySession(
  session: CommunityGroupJourneySession,
) {
  const cachedSession = normalizeJourneySession(session);

  if (cachedSession.shareToken) {
    journeySessionsByShareToken.set(cachedSession.shareToken, cachedSession);
  }

  if (cachedSession.groupId) {
    journeySessionsByGroupId.set(cachedSession.groupId, cachedSession);
  }

  writeJourneySessionsToStorage();
  return cachedSession;
}

export function getCachedCommunityGroupJourneySession(routeKey?: string | null) {
  const normalizedRouteKey = normalizeValue(routeKey);

  if (!normalizedRouteKey) {
    return null;
  }

  return (
    journeySessionsByShareToken.get(normalizedRouteKey) ??
    journeySessionsByGroupId.get(normalizedRouteKey) ??
    null
  );
}

export function removeCachedCommunityGroupJourneySession(
  routeKey?: string | null,
) {
  const cachedSession = getCachedCommunityGroupJourneySession(routeKey);

  if (!cachedSession) {
    return false;
  }

  if (cachedSession.shareToken) {
    journeySessionsByShareToken.delete(cachedSession.shareToken);
  }

  if (cachedSession.groupId) {
    journeySessionsByGroupId.delete(cachedSession.groupId);
  }

  writeJourneySessionsToStorage();
  return true;
}
