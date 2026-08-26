import type { ImageSourcePropType } from "react-native";

import type { CommunityFeedPost } from "./community-post-cache";
import type { CommunityExplorerProfile } from "./community-demo";

type CachedCommunityExplorerProfileEntry = {
  posts: CommunityFeedPost[];
  profile: CommunityExplorerProfile;
  updatedAt: number;
};

const cachedExplorerProfilesById = new Map<
  string,
  CachedCommunityExplorerProfileEntry
>();

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function dedupeTextValues(values: readonly string[]) {
  return Array.from(new Set(values));
}

function readRemoteImageUri(source?: ImageSourcePropType | null): string | null {
  if (!source) {
    return null;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const uri = readRemoteImageUri(item);

      if (uri) {
        return uri;
      }
    }

    return null;
  }

  if (typeof source === "number") {
    return null;
  }

  if ("uri" in source && typeof source.uri === "string") {
    const trimmedUri = source.uri.trim();
    return trimmedUri ? trimmedUri : null;
  }

  return null;
}

function buildFallbackUsername(post: CommunityFeedPost) {
  const normalizedRole = readMeaningfulText(post.role);

  if (normalizedRole?.startsWith("@")) {
    return normalizedRole;
  }

  const normalizedAuthorId = readMeaningfulText(post.authorId)?.replace(
    /[^a-zA-Z0-9._-]/g,
    "",
  );

  if (normalizedAuthorId) {
    return `@${normalizedAuthorId}`;
  }

  return "@explorer";
}

function buildFallbackExplorerProfile(
  post: CommunityFeedPost,
): CommunityExplorerProfile {
  const authorId = readMeaningfulText(post.authorId) ?? post.id;
  const authorName = readMeaningfulText(post.author) ?? "Explorer";
  const locationLabel =
    readMeaningfulText(post.location) ?? "Cộng đồng Culture Quest";
  const interestTags = dedupeTextValues(
    post.tags
      .map((tag) => readMeaningfulText(tag))
      .filter((tag): tag is string => Boolean(tag)),
  ).slice(0, 4);
  const badges = dedupeTextValues(
    [
      readMeaningfulText(post.badge),
      ...interestTags,
    ].filter((value): value is string => Boolean(value)),
  ).slice(0, 4);
  const coverUri = readRemoteImageUri(post.image);
  const hotspotCount = Math.max(
    0,
    (post.hotspotIds ?? []).filter(
      (hotspotId) => Number.isInteger(hotspotId) && hotspotId > 0,
    ).length,
  );

  return {
    id: authorId,
    name: authorName,
    username: buildFallbackUsername(post),
    role: readMeaningfulText(post.role) ?? "Explorer community",
    headline:
      readMeaningfulText(post.mood) ?? `Đang hoạt động tại ${locationLabel}.`,
    bio:
      readMeaningfulText(post.caption) ??
      `Explorer này vừa chia sẻ một hoạt động tại ${locationLabel}.`,
    birthDate: "Chưa cập nhật",
    city: locationLabel,
    level: 1,
    checkIns: hotspotCount,
    followers: 0,
    following: 0,
    routesCompleted: hotspotCount,
    streakDays: 0,
    badgeCount: badges.length,
    responseTime: "Thường phản hồi trên cộng đồng",
    isPremium: false,
    avatar: undefined,
    cover: coverUri ?? "",
    initials: readMeaningfulText(post.initials) ?? authorName.slice(0, 2).toUpperCase(),
    avatarColors: post.avatarColors,
    interests: interestTags,
    badges,
    routeIds: [],
    favoriteRouteIds: [],
  };
}

function preferLongerText(currentValue: string, nextValue: string) {
  return nextValue.length > currentValue.length ? nextValue : currentValue;
}

function mergeCachedExplorerProfile(
  currentProfile: CommunityExplorerProfile,
  nextProfile: CommunityExplorerProfile,
): CommunityExplorerProfile {
  const interests = dedupeTextValues([
    ...currentProfile.interests,
    ...nextProfile.interests,
  ]).slice(0, 4);
  const badges = dedupeTextValues([
    ...currentProfile.badges,
    ...nextProfile.badges,
  ]).slice(0, 4);

  return {
    ...currentProfile,
    avatar: currentProfile.avatar || nextProfile.avatar,
    badgeCount: Math.max(currentProfile.badgeCount, nextProfile.badgeCount, badges.length),
    badges,
    bio: preferLongerText(currentProfile.bio, nextProfile.bio),
    city:
      currentProfile.city === "Cộng đồng Culture Quest"
        ? nextProfile.city
        : currentProfile.city,
    cover: currentProfile.cover || nextProfile.cover,
    followers: Math.max(currentProfile.followers, nextProfile.followers),
    following: Math.max(currentProfile.following, nextProfile.following),
    headline: preferLongerText(currentProfile.headline, nextProfile.headline),
    interests,
    isPremium: currentProfile.isPremium || nextProfile.isPremium,
    level: Math.max(currentProfile.level, nextProfile.level),
    routeIds: currentProfile.routeIds.length ? currentProfile.routeIds : nextProfile.routeIds,
    routesCompleted: Math.max(currentProfile.routesCompleted, nextProfile.routesCompleted),
    streakDays: Math.max(currentProfile.streakDays, nextProfile.streakDays),
  };
}

function upsertExplorerPosts(posts: CommunityFeedPost[], nextPost: CommunityFeedPost) {
  const existingIndex = posts.findIndex((post) => post.id === nextPost.id);

  if (existingIndex === -1) {
    return [nextPost, ...posts];
  }

  const nextPosts = [...posts];
  nextPosts[existingIndex] = nextPost;
  return nextPosts;
}

export function cacheCommunityExplorerProfile(post: CommunityFeedPost) {
  const explorerId = readMeaningfulText(post.authorId);

  if (!explorerId) {
    return null;
  }

  const nextProfile = buildFallbackExplorerProfile(post);
  const currentEntry = cachedExplorerProfilesById.get(explorerId);
  const cachedEntry: CachedCommunityExplorerProfileEntry = {
    posts: upsertExplorerPosts(currentEntry?.posts ?? [], post),
    profile: currentEntry
      ? mergeCachedExplorerProfile(currentEntry.profile, nextProfile)
      : nextProfile,
    updatedAt: Date.now(),
  };

  cachedExplorerProfilesById.set(explorerId, cachedEntry);
  return cachedEntry;
}

export function getCachedCommunityExplorerProfile(explorerId: string) {
  const normalizedExplorerId = readMeaningfulText(explorerId);

  if (!normalizedExplorerId) {
    return null;
  }

  return cachedExplorerProfilesById.get(normalizedExplorerId) ?? null;
}
