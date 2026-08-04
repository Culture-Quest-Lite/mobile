const COMMUNITY_GROUP_INVITE_WEB_ORIGIN = "https://culturequest.app";
const COMMUNITY_GROUP_INVITE_APP_SCHEME = "culturequest";

export function buildCommunityInviteWebUrl(shareToken: string) {
  return `${COMMUNITY_GROUP_INVITE_WEB_ORIGIN}/join/${encodeURIComponent(shareToken)}`;
}

export function buildCommunityInviteAppUrl(shareToken: string) {
  return `${COMMUNITY_GROUP_INVITE_APP_SCHEME}://join/${encodeURIComponent(shareToken)}`;
}

export function buildCommunityInviteShareMessage({
  appInviteUrl,
  groupName,
  webInviteUrl,
}: {
  appInviteUrl: string;
  groupName?: string | null;
  webInviteUrl: string;
}) {
  const normalizedGroupName =
    typeof groupName === "string" && groupName.trim() ? groupName.trim() : null;
  const titlePrefix = normalizedGroupName
    ? `Tham gia nhom "${normalizedGroupName}" tren Culture Quest Lite`
    : "Tham gia nhom tren Culture Quest Lite";

  return `${titlePrefix}\n${webInviteUrl}\nHoac mo truc tiep trong app: ${appInviteUrl}`;
}
