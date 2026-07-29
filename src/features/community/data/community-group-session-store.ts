import type { CommunityGroupPayload } from "../api/group-api";
import {
  buildCommunityInviteAppUrl,
  buildCommunityInviteWebUrl,
} from "../lib/community-group-invite-links";

export type CommunityGroupSession = CommunityGroupPayload & {
  groupName: string | null;
  inviteAppUrl: string;
  inviteWebUrl: string;
  lastUpdatedAt: number;
  source: "created" | "joined" | "listed";
};

const communityGroupsByShareToken = new Map<string, CommunityGroupSession>();

function normalizeShareToken(shareToken?: string | null) {
  if (typeof shareToken !== "string") {
    return null;
  }

  const trimmedShareToken = shareToken.trim();
  return trimmedShareToken ? trimmedShareToken : null;
}

export function cacheCommunityGroupSession(
  session: CommunityGroupPayload & {
    groupName?: string | null;
    source: "created" | "joined" | "listed";
  },
) {
  const normalizedShareToken = normalizeShareToken(session.shareToken);

  if (!normalizedShareToken) {
    return null;
  }

  const cachedSession: CommunityGroupSession = {
    ...session,
    groupName:
      typeof session.groupName === "string" && session.groupName.trim()
        ? session.groupName.trim()
        : null,
    inviteAppUrl: buildCommunityInviteAppUrl(normalizedShareToken),
    inviteWebUrl: buildCommunityInviteWebUrl(normalizedShareToken),
    lastUpdatedAt: Date.now(),
    shareToken: normalizedShareToken,
  };

  communityGroupsByShareToken.set(normalizedShareToken, cachedSession);
  return cachedSession;
}

export function getCachedCommunityGroupSession(shareToken?: string | null) {
  const normalizedShareToken = normalizeShareToken(shareToken);

  if (!normalizedShareToken) {
    return null;
  }

  return communityGroupsByShareToken.get(normalizedShareToken) ?? null;
}

export function removeCachedCommunityGroupSession(shareToken?: string | null) {
  const normalizedShareToken = normalizeShareToken(shareToken);

  if (!normalizedShareToken) {
    return false;
  }

  return communityGroupsByShareToken.delete(normalizedShareToken);
}
