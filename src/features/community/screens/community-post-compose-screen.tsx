import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  createPost,
  type CreatedPostResponse,
  type PostVisibility,
} from "@/features/home/api/create-post";
import { type NearbyHotspotDto } from "@/features/home/api/get-nearby-hotspots";
import { getActiveTags, type ActiveTagDto } from "@/features/home/api/get-tags";
import {
  getHotspots,
  searchHotspots,
} from "@/features/home/api/search-hotspots";
import {
  ReviewMediaViewer,
  type ReviewMediaViewerItem,
} from "@/features/home/components/review-media-viewer";
import {
  getCreatedPostRewardText,
  isCreatedPostPending,
} from "@/features/home/lib/created-post-feedback";
import { getMyProfile } from "@/features/profile/api/get-me";
import { cacheProfilePost } from "@/features/profile/data/profile-post-cache";
import { mapCreatedPostToProfilePost } from "@/features/profile/lib/map-created-post-to-profile-post";
import {
  getRouteCoverUrl,
  searchRoutes,
  type RouteDto,
  type RouteHotspotDto,
} from "@/features/route/api/route-api";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { getPostVisibilityLabel } from "@/lib/post-visibility";
import {
  CommunityPostSuccessOverlay,
  type CommunityPostSuccessVariant,
} from "../components/community-post-success-overlay";
import { cacheCommunityExplorerProfile } from "../data/community-explorer-profile-cache";
import {
  cacheCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";
import { getCommunityPostVisibility } from "../data/community-post-visibility-store";

type ComposerIdentity = {
  accountKey: string | null;
  avatarUri: string | null;
  displayName: string;
  username: string | null;
};

type ComposerMediaItem = {
  assetId?: string | null;
  fileName: string;
  mimeType: string;
  type: "image" | "video";
  uri: string;
};

type ComposerHotspotOption = {
  address: string;
  distanceLabel: string | null;
  hotspotId: number;
  hotspotName: string;
  imageUri: string;
  tagNames: string[];
};

type ComposerRouteOption = {
  coverUri: string;
  description: string;
  hotspots: ComposerHotspotOption[];
  metaLabel: string;
  routeId: number;
  routeName: string;
  tagNames: string[];
};

type SelectionSheet = "hotspot" | "route" | "tag" | null;

type PostSuccessState = {
  rewardText: string | null;
  variant: CommunityPostSuccessVariant;
};

type RoutePickerSheetProps = {
  errorMessage: string | null;
  isLoading: boolean;
  onChangeQuery: (value: string) => void;
  onClearSelection: () => void;
  onClose: () => void;
  onSelectRoute: (route: ComposerRouteOption) => void;
  query: string;
  routes: ComposerRouteOption[];
  selectedRouteId: number | null;
  visible: boolean;
};

type HotspotPickerSheetProps = {
  errorMessage: string | null;
  hotspots: ComposerHotspotOption[];
  isLoading: boolean;
  isSearching: boolean;
  isShowingSearchResults: boolean;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onToggleHotspot: (hotspotId: number) => void;
  query: string;
  selectedHotspotIds: number[];
  visible: boolean;
};

type TagPickerSheetProps = {
  draft: string;
  onAddTag: () => void;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onRemoveTag: (tagName: string) => void;
  onSelectSuggestedTag: (tagName: string) => void;
  selectedTags: string[];
  suggestedTags: string[];
  visible: boolean;
};

const maxPostLength = 2000;
const maxMediaCount = 6;
const maxSelectableTags = 6;
const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const avatarFallbackColors = ["#EB489B", "#F58752"] as const;
const chipBorderColor = "#E7E5EA";
const footerActionHeight = 44;
const pageHorizontalPadding = 16;
const defaultImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";
const footerShadowStyle = {
  elevation: 14,
  shadowColor: "rgba(24, 24, 27, 0.12)",
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 1,
  shadowRadius: 16,
} as const;
const sheetShadowStyle = {
  elevation: 20,
  shadowColor: "rgba(17, 24, 39, 0.16)",
  shadowOffset: { width: 0, height: -10 },
  shadowOpacity: 1,
  shadowRadius: 24,
} as const;
const avatarPalettes = [
  ["#EB489B", "#F58752"],
  ["#F58752", "#FFC93C"],
  ["#4F46E5", "#38BDF8"],
  ["#10B981", "#2DD4BF"],
  ["#9333EA", "#EC4899"],
] as const;

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return ["string", "null", "undefined"].includes(trimmedValue.toLowerCase())
    ? null
    : trimmedValue;
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getNameInitials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return "CQ";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ""}${tokens.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function getAvatarPalette(seed: string) {
  const paletteIndex =
    Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0) %
    avatarPalettes.length;

  return avatarPalettes[paletteIndex] as readonly [string, string];
}

function formatCompactCount(value?: number | null) {
  const resolvedValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : 0;

  if (resolvedValue < 1000) {
    return `${resolvedValue}`;
  }

  const formattedValue = resolvedValue / 1000;

  return `${formattedValue >= 10 ? formattedValue.toFixed(0) : formattedValue.toFixed(1)}k`;
}

function getNearbyHotspotImageUri(hotspot: NearbyHotspotDto) {
  const medias = [...hotspot.medias]
    .filter((media) => readMeaningfulText(media.fileUrl))
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder;
    });

  return medias[0]?.fileUrl.trim() ?? defaultImageUri;
}

function getRouteHotspotImageUri(hotspot: RouteHotspotDto) {
  const imageMedia =
    hotspot.medias?.find((item) => {
      const kind =
        `${item.mediaType ?? ""} ${item.mimeType ?? ""}`.toLowerCase();
      return (
        kind.includes("image") && Boolean(readMeaningfulText(item.fileUrl))
      );
    }) ?? hotspot.medias?.[0];

  return readMeaningfulText(imageMedia?.fileUrl) ?? defaultImageUri;
}

function dedupeStringList(values: string[]) {
  const seenKeys = new Set<string>();

  return values.flatMap((value) => {
    const normalizedValue = value.trim().replace(/^#/, "");
    const lookupKey = normalizeLookupText(normalizedValue);

    if (!normalizedValue || seenKeys.has(lookupKey)) {
      return [];
    }

    seenKeys.add(lookupKey);
    return [normalizedValue];
  });
}

function dedupeHotspots(values: ComposerHotspotOption[]) {
  const hotspotsById = new Map<number, ComposerHotspotOption>();

  values.forEach((value) => {
    if (
      Number.isInteger(value.hotspotId) &&
      value.hotspotId > 0 &&
      !hotspotsById.has(value.hotspotId)
    ) {
      hotspotsById.set(value.hotspotId, value);
    }
  });

  return Array.from(hotspotsById.values());
}

function matchesHotspotSearchQuery(
  hotspot: Pick<ComposerHotspotOption, "address" | "hotspotName" | "tagNames">,
  query: string,
) {
  const tokens = normalizeLookupText(query).split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const searchableText = normalizeLookupText(
    `${hotspot.hotspotName} ${hotspot.address} ${hotspot.tagNames.join(" ")}`,
  );

  return tokens.every((token) => searchableText.includes(token));
}

function getHotspotSearchRank(
  hotspot: Pick<ComposerHotspotOption, "address" | "hotspotName" | "tagNames">,
  query: string,
) {
  const normalizedQuery = normalizeLookupText(query);
  const normalizedName = normalizeLookupText(hotspot.hotspotName);
  const normalizedAddress = normalizeLookupText(hotspot.address);
  const normalizedTags = normalizeLookupText(hotspot.tagNames.join(" "));

  if (normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 1;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 2;
  }

  if (normalizedAddress.includes(normalizedQuery)) {
    return 3;
  }

  if (normalizedTags.includes(normalizedQuery)) {
    return 4;
  }

  return 5;
}

function sortHotspotsForSearch(
  hotspots: ComposerHotspotOption[],
  query: string,
) {
  return [...hotspots].sort((left, right) => {
    const leftRank = getHotspotSearchRank(left, query);
    const rightRank = getHotspotSearchRank(right, query);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.hotspotName.localeCompare(right.hotspotName, "vi");
  });
}

function buildHashtagLabel(tagName: string) {
  return `#${tagName.trim().replace(/^#/, "").replace(/\s+/g, "_")}`;
}

function buildTaggedPostContent(content: string, tagNames: string[]) {
  const normalizedContent = content.trim();
  const hashtags = dedupeStringList(tagNames).map(buildHashtagLabel).join(" ");

  if (!hashtags) {
    return normalizedContent;
  }

  if (!normalizedContent) {
    return hashtags;
  }

  return `${normalizedContent}\n\n${hashtags}`;
}

function buildComposerIdentityFromSession(
  isAuthenticated: boolean,
  displayName: string,
  username: string | null,
): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(displayName);
  const normalizedUsername =
    readMeaningfulText(username)?.replace(/^@/, "") ?? null;
  const accountKey =
    normalizedUsername ??
    normalizedDisplayName ??
    (isAuthenticated ? "authenticated-user" : null);

  return {
    accountKey,
    avatarUri: null,
    displayName: isAuthenticated
      ? (normalizedDisplayName ?? normalizedUsername ?? "Bạn")
      : "Khách",
    username: normalizedUsername,
  };
}

function buildComposerIdentityFromProfile(
  response: Awaited<ReturnType<typeof getMyProfile>>,
  fallbackIdentity: ComposerIdentity,
): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(response.name);
  const normalizedUsername =
    readMeaningfulText(response.username)?.replace(/^@/, "") ?? null;

  return {
    accountKey: fallbackIdentity.accountKey,
    avatarUri: readMeaningfulText(response.avatar),
    displayName:
      normalizedDisplayName ??
      normalizedUsername ??
      fallbackIdentity.displayName,
    username: normalizedUsername ?? fallbackIdentity.username,
  };
}

function getFallbackMediaExtension(
  type: "image" | "video",
  mimeType?: string | null,
) {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";

  if (normalizedMimeType.includes("png")) {
    return "png";
  }

  if (normalizedMimeType.includes("webp")) {
    return "webp";
  }

  if (normalizedMimeType.includes("heic")) {
    return "heic";
  }

  if (normalizedMimeType.includes("mov")) {
    return "mov";
  }

  if (normalizedMimeType.includes("webm")) {
    return "webm";
  }

  if (normalizedMimeType.includes("mp4")) {
    return "mp4";
  }

  return type === "video" ? "mp4" : "jpg";
}

function buildFallbackFileName(
  type: "image" | "video",
  mimeType?: string | null,
  order = 1,
) {
  const extension = getFallbackMediaExtension(type, mimeType);

  return `community-post-${Date.now()}-${order}.${extension}`;
}

function dedupeComposerMediaItems(values: ComposerMediaItem[]) {
  const seenKeys = new Set<string>();

  return values.flatMap((value) => {
    const assetId = readMeaningfulText(value.assetId);
    const uri = readMeaningfulText(value.uri);
    const lookupKey =
      assetId !== null
        ? `asset:${assetId}`
        : uri !== null
          ? `uri:${uri}`
          : null;

    if (lookupKey === null || seenKeys.has(lookupKey)) {
      return [];
    }

    seenKeys.add(lookupKey);
    return [value];
  });
}

function mapRouteHotspotToComposerHotspot(
  hotspot: RouteHotspotDto,
): ComposerHotspotOption | null {
  if (!Number.isInteger(hotspot.hotspotId) || hotspot.hotspotId <= 0) {
    return null;
  }

  return {
    address: readMeaningfulText(hotspot.address) ?? "Đang cập nhật địa chỉ",
    distanceLabel: null,
    hotspotId: hotspot.hotspotId,
    hotspotName:
      readMeaningfulText(hotspot.hotspotName) ??
      `Hotspot #${hotspot.hotspotId}`,
    imageUri: getRouteHotspotImageUri(hotspot),
    tagNames: [],
  };
}

function mapNearbyHotspotToComposerHotspot(
  hotspot: NearbyHotspotDto,
): ComposerHotspotOption {
  return {
    address:
      readMeaningfulText(hotspot.address) ??
      readMeaningfulText(hotspot.description) ??
      "Đang cập nhật địa chỉ",
    distanceLabel: null,
    hotspotId: hotspot.hotspotId,
    hotspotName:
      readMeaningfulText(hotspot.hotspotName) ??
      `Địa điểm #${hotspot.hotspotId}`,
    imageUri: getNearbyHotspotImageUri(hotspot),
    tagNames: hotspot.tags
      .map((tag) => readMeaningfulText(tag.tagName))
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, 4),
  };
}

function buildRouteMetaLabel(route: RouteDto) {
  const segments = [
    route.hotspots.length > 0 ? `${route.hotspots.length} điểm dừng` : null,
    route.totalDistance > 0 ? `${route.totalDistance} km` : null,
    route.estimateTime > 0 ? `${route.estimateTime} phút` : null,
  ].filter((segment): segment is string => Boolean(segment));

  return segments.join(" · ") || "Tuyến đường văn hóa";
}

function mapRouteToComposerRoute(route: RouteDto): ComposerRouteOption | null {
  if (!Number.isInteger(route.routeId) || route.routeId <= 0) {
    return null;
  }

  const mappedHotspots = dedupeHotspots(
    route.hotspots
      .map(mapRouteHotspotToComposerHotspot)
      .filter((hotspot): hotspot is ComposerHotspotOption => hotspot !== null),
  );

  return {
    coverUri: readMeaningfulText(getRouteCoverUrl(route)) ?? defaultImageUri,
    description:
      readMeaningfulText(route.description) ??
      "Tuyến khám phá từ Culture Quest.",
    hotspots: mappedHotspots,
    metaLabel: buildRouteMetaLabel(route),
    routeId: route.routeId,
    routeName:
      readMeaningfulText(route.routeName) ?? `Tuyến đường #${route.routeId}`,
    tagNames: route.tags
      .map((tag) => readMeaningfulText(tag.tagName))
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, 4),
  };
}

function sortHotspotsByProminence(
  left: NearbyHotspotDto,
  right: NearbyHotspotDto,
) {
  const leftScore = Math.max(left.xp ?? 0, left.point ?? 0);
  const rightScore = Math.max(right.xp ?? 0, right.point ?? 0);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return left.hotspotName.localeCompare(right.hotspotName, "vi");
}

function buildCreatedPostLocationLabel(
  hotspotIds: number[],
  routeIds: number[],
) {
  if (hotspotIds.length === 1) {
    return "1 địa điểm được gắn";
  }

  if (hotspotIds.length > 1) {
    return `${hotspotIds.length} địa điểm được gắn`;
  }

  if (routeIds.length === 1) {
    return "1 tuyến đường được gắn";
  }

  if (routeIds.length > 1) {
    return `${routeIds.length} tuyến đường được gắn`;
  }

  return "";
}

function mapCreatedPostToCommunityFeedPost(
  createdPost: CreatedPostResponse,
  options?: {
    fallbackRouteIds?: number[];
    fallbackTagNames?: string[];
  },
): CommunityFeedPost {
  const author =
    readMeaningfulText(createdPost.displayName) ??
    readMeaningfulText(createdPost.username) ??
    "Người dùng";
  const mergedRouteIds = Array.from(
    new Set([
      ...(createdPost.routeIds ?? []),
      ...(options?.fallbackRouteIds ?? []),
    ]),
  ).filter((routeId) => Number.isInteger(routeId) && routeId > 0);
  const tags = dedupeStringList([
    ...createdPost.tags
      .map((tag) => readMeaningfulText(tag.tagName))
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, 4),
    ...(options?.fallbackTagNames ?? []),
  ]).slice(0, 4);
  const mediaItems: CommunityFeedMediaItem[] = createdPost.medias
    .filter(
      (media) =>
        media.mediaType.trim().toUpperCase() === "IMAGE" &&
        Boolean(readMeaningfulText(media.fileUrl)),
    )
    .map((media) => ({
      key: `${createdPost.postId}-media-${media.mediaId}`,
      source: {
        uri: media.fileUrl,
      },
    }));
  const firstMediaItem = mediaItems[0] ?? null;
  const statusLabel =
    readMeaningfulText(createdPost.status)?.toUpperCase() === "PENDING"
      ? "Đang chờ duyệt"
      : "Cập nhật mới từ cộng đồng";
  const visibilityValue =
    readMeaningfulText(createdPost.visibility) ?? "PUBLIC";

  return {
    id: `newsfeed-post-${createdPost.postId}`,
    authorId: `${createdPost.userId}`,
    author,
    initials: getNameInitials(author),
    role: readMeaningfulText(createdPost.username)
      ? `@${createdPost.username.trim()}`
      : "Explorer community",
    time: "Vừa xong",
    caption:
      readMeaningfulText(createdPost.content) ?? "Bài viết mới từ cộng đồng.",
    location: buildCreatedPostLocationLabel(
      createdPost.hotspotIds,
      mergedRouteIds,
    ),
    mood: `${statusLabel} · ${getPostVisibilityLabel(visibilityValue)}`,
    badge:
      createdPost.hotspotIds.length > 0
        ? "Hotspot"
        : mergedRouteIds.length > 0
          ? "Route"
          : "Newsfeed",
    hotScore: "0",
    views: formatCompactCount(createdPost.pointRemaining),
    likes: formatCompactCount(createdPost.likeCount),
    comments: formatCompactCount(createdPost.commentCount),
    replies: "0",
    shares: formatCompactCount(createdPost.shareCount),
    topic: "culture",
    isFollowing: false,
    tags,
    image: firstMediaItem?.source ?? null,
    hotspotIds: createdPost.hotspotIds,
    commentCountValue: createdPost.commentCount,
    isLiked: createdPost.isLiked,
    likeCountValue: createdPost.likeCount,
    mediaItems,
    postNumericId: createdPost.postId,
    replyCountValue: 0,
    routeIds: mergedRouteIds,
    shareCountValue: createdPost.shareCount,
    avatarColors: getAvatarPalette(`${author}-${createdPost.userId}`),
    canComment: true,
    canLike: true,
    canOpenProfile: true,
    visibility: visibilityValue,
  };
}

function AvatarMonogram({
  initials,
  size,
}: {
  initials: string;
  size: number;
}) {
  return (
    <LinearGradient
      colors={avatarFallbackColors}
      end={{ x: 1, y: 0.5 }}
      start={{ x: 0, y: 0.5 }}
      style={{
        alignItems: "center",
        borderRadius: size / 2,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <Text
        className="font-normal text-white"
        style={{ fontSize: Math.max(16, size * 0.34) }}
      >
        {initials}
      </Text>
    </LinearGradient>
  );
}

function ComposerAvatar({
  displayName,
  uri,
}: {
  displayName: string;
  uri: string | null;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const hasError = !uri || failedUri === uri;

  if (hasError) {
    return <AvatarMonogram initials={getNameInitials(displayName)} size={48} />;
  }

  return (
    <Image
      source={{ uri }}
      contentFit="cover"
      transition={120}
      style={{ borderRadius: 24, height: 48, width: 48 }}
      onError={() => {
        setFailedUri(uri);
      }}
    />
  );
}

function MediaAddTile({
  canAddMore,
  count,
  onPress,
}: {
  canAddMore: boolean;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="items-center justify-center rounded-[16px] border border-dashed bg-[#FFF7FA]"
      disabled={!canAddMore}
      onPress={onPress}
      style={{
        borderColor: canAddMore ? "#F8C9DB" : "#E5E7EB",
        height: 82,
        opacity: canAddMore ? 1 : 0.65,
        width: 82,
      }}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#FFEDF4]">
        <SymbolView
          name={{
            ios: "plus",
            android: "add",
            web: "add",
          }}
          size={17}
          tintColor="#F43F78"
        />
      </View>
      <Text className="mt-2 text-center text-[10px] font-normal text-[#F43F78]">
        {count === 0 ? "Thêm ảnh/video" : "Thêm nữa"}
      </Text>
    </Pressable>
  );
}

function MediaPreviewCard({
  item,
  onPress,
  onRemove,
}: {
  item: ComposerMediaItem;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      className="overflow-hidden rounded-[16px] bg-[#F4F4F5]"
      onPress={onPress}
      style={{ height: 72, width: 72 }}
    >
      <Image
        source={item.uri}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        style={{ height: "100%", width: "100%" }}
      />

      {item.type === "video" ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-black/45">
            <SymbolView
              name={{
                ios: "play.fill",
                android: "play_arrow",
                web: "play_arrow",
              }}
              size={15}
              tintColor="#FFFFFF"
            />
          </View>
        </View>
      ) : null}

      <Pressable
        className="absolute right-1.5 top-1.5 h-5.5 w-5.5 items-center justify-center rounded-full bg-black/60"
        hitSlop={6}
        onPress={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <SymbolView
          name={{
            ios: "xmark",
            android: "close",
            web: "close",
          }}
          size={11}
          tintColor="#FFFFFF"
        />
      </Pressable>
    </Pressable>
  );
}

function SelectionRow({
  iconName,
  subtitle,
  title,
  value,
  onPress,
}: {
  iconName: {
    android: string;
    ios: string;
    web: string;
  };
  subtitle: string;
  title: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center rounded-[14px] border bg-white px-3 py-2.5"
      onPress={onPress}
      style={{ borderColor: "#EEE8EF" }}
    >
      <View className="h-8.5 w-8.5 items-center justify-center rounded-full bg-[#FFF1F6]">
        <SymbolView name={iconName} size={15} tintColor="#F43F78" />
      </View>

      <View className="ml-2.5 flex-1 pr-2">
        <Text
          className="text-[13px] font-medium text-[#1F2937]"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="mt-0.5 text-[10px] text-[#8B7280]" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View className="ml-2 max-w-[44%] flex-row items-center justify-end">
        <Text
          className="flex-shrink text-right text-[11px] font-normal text-[#111827]"
          numberOfLines={1}
        >
          {value}
        </Text>
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          size={16}
          tintColor="#9CA3AF"
        />
      </View>
    </Pressable>
  );
}

function SelectedEntityChip({
  imageUri,
  label,
  onRemove,
  subtitle,
  fullWidth = false,
}: {
  imageUri: string;
  label: string;
  onRemove: () => void;
  subtitle: string;
  fullWidth?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center rounded-[14px] border bg-[#FFF9FB] px-2.5 py-2 ${
        fullWidth ? "w-full" : ""
      }`}
      style={{
        borderColor: "#F6D7E3",
        maxWidth: fullWidth ? "100%" : undefined,
      }}
    >
      <Image
        source={{ uri: imageUri }}
        contentFit="cover"
        style={{ borderRadius: 10, height: 34, width: 34 }}
      />

      <View className="ml-2 min-w-0 flex-1">
        <Text
          className="text-[12px] font-medium text-[#1F2937]"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text className="mt-0.5 text-[10px] text-[#8B7280]" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Pressable
        className="ml-2 h-6 w-6 items-center justify-center rounded-full bg-white"
        hitSlop={6}
        onPress={onRemove}
      >
        <SymbolView
          name={{
            ios: "xmark",
            android: "close",
            web: "close",
          }}
          size={12}
          tintColor="#9CA3AF"
        />
      </Pressable>
    </View>
  );
}

function TagPill({
  active,
  label,
  onPress,
  removable = false,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  removable?: boolean;
}) {
  return (
    <Pressable
      className={`flex-row items-center rounded-full border px-2.5 py-1.5 ${
        active ? "bg-[#FFF1F6]" : "bg-white"
      }`}
      onPress={onPress}
      style={{
        borderColor: active ? "#F5B5CB" : "#E7E5EA",
      }}
    >
      <Text
        className={`text-[11px] font-normal ${
          active ? "text-[#F43F78]" : "text-[#6B7280]"
        }`}
      >
        {label}
      </Text>
      {removable ? (
        <SymbolView
          name={{
            ios: "xmark",
            android: "close",
            web: "close",
          }}
          size={10}
          tintColor={active ? "#F43F78" : "#9CA3AF"}
        />
      ) : null}
    </Pressable>
  );
}

function SheetSearchField({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View
      className="mt-3 flex-row items-center rounded-[14px] border bg-[#FAFAFB] px-3"
      style={{ borderColor: "#ECE9EF", height: 40 }}
    >
      <SymbolView
        name={{
          ios: "magnifyingglass",
          android: "search",
          web: "search",
        }}
        size={15}
        tintColor="#9CA3AF"
      />
      <TextInput
        className="ml-2 flex-1 text-[13px] text-[#111827]"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        returnKeyType="search"
        value={value}
      />
    </View>
  );
}

function RoutePickerSheet({
  errorMessage,
  isLoading,
  onChangeQuery,
  onClearSelection,
  onClose,
  onSelectRoute,
  query,
  routes,
  selectedRouteId,
  visible,
}: RoutePickerSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-[#1B0E13]/28">
          <Pressable className="flex-1" onPress={onClose} />

          <SafeAreaView edges={["left", "right", "bottom"]}>
            <View
              className="rounded-t-[28px] bg-white px-4 pb-4 pt-3"
              style={[sheetShadowStyle, { maxHeight: "92%", minHeight: 560 }]}
            >
              <View className="items-center">
                <View className="h-1.5 w-14 rounded-full bg-[#E5E7EB]" />
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <View className="w-10" />
                <Text className="text-[15px] font-medium text-[#111827]">
                  Chọn tuyến đường
                </Text>
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#FAFAFB]"
                  onPress={onClose}
                >
                  <SymbolView
                    name={{
                      ios: "xmark",
                      android: "close",
                      web: "close",
                    }}
                    size={15}
                    tintColor="#6B7280"
                  />
                </Pressable>
              </View>

              <SheetSearchField
                onChangeText={onChangeQuery}
                placeholder="Tìm tuyến đường..."
                value={query}
              />

              {selectedRouteId !== null ? (
                <Pressable
                  className="mt-2.5 self-start rounded-full bg-[#FFF1F6] px-3 py-1.5"
                  onPress={onClearSelection}
                >
                  <Text className="text-[11px] font-normal text-[#F43F78]">
                    Bỏ chọn tuyến đường
                  </Text>
                </Pressable>
              ) : null}

              {isLoading ? (
                <View className="flex-1 items-center justify-center py-8">
                  <ActivityIndicator color="#F43F78" />
                  <Text className="mt-2 text-[12px] font-normal text-[#8B7280]">
                    Đang tải tuyến đường...
                  </Text>
                </View>
              ) : errorMessage ? (
                <View className="mt-4 rounded-[20px] bg-[#FFF4F6] p-4">
                  <Text className="text-[13px] font-normal text-[#C2416C]">
                    {errorMessage}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  className="mt-4 flex-1"
                  contentContainerStyle={{ paddingBottom: 12 }}
                  showsVerticalScrollIndicator={false}
                >
                  {routes.length > 0 ? (
                    routes.map((route) => {
                      const isSelected = route.routeId === selectedRouteId;

                      return (
                        <Pressable
                          key={route.routeId}
                          className="mb-2.5 flex-row items-center rounded-[16px] border bg-white p-2.5"
                          onPress={() => {
                            onSelectRoute(route);
                          }}
                          style={{
                            borderColor: isSelected ? "#F5B5CB" : "#EEE8EF",
                          }}
                        >
                          <Image
                            source={{ uri: route.coverUri }}
                            contentFit="cover"
                            style={{ borderRadius: 12, height: 50, width: 50 }}
                          />

                          <View className="ml-2.5 flex-1">
                            <Text
                              className="text-[13px] font-medium text-[#111827]"
                              numberOfLines={1}
                            >
                              {route.routeName}
                            </Text>
                            <Text
                              className="mt-0.5 text-[11px] text-[#8B7280]"
                              numberOfLines={2}
                            >
                              {route.description}
                            </Text>
                            <Text className="mt-0.5 text-[10px] font-normal text-[#F97316]">
                              {route.metaLabel}
                            </Text>
                          </View>

                          <View className="ml-3">
                            <SymbolView
                              name={
                                isSelected
                                  ? {
                                      ios: "checkmark.circle.fill",
                                      android: "check_circle",
                                      web: "check_circle",
                                    }
                                  : {
                                      ios: "circle",
                                      android: "radio_button_unchecked",
                                      web: "radio_button_unchecked",
                                    }
                              }
                              size={20}
                              tintColor={isSelected ? "#F43F78" : "#D1D5DB"}
                            />
                          </View>
                        </Pressable>
                      );
                    })
                  ) : (
                    <View className="items-center rounded-[22px] border border-dashed border-[#E5E7EB] px-4 py-8">
                      <Text className="text-[13px] font-normal text-[#8B7280]">
                        Không tìm thấy tuyến đường phù hợp.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function HotspotPickerSheet({
  errorMessage,
  hotspots,
  isLoading,
  isSearching,
  isShowingSearchResults,
  onChangeQuery,
  onClose,
  onConfirm,
  onToggleHotspot,
  query,
  selectedHotspotIds,
  visible,
}: HotspotPickerSheetProps) {
  const selectedIdSet = useMemo(
    () => new Set(selectedHotspotIds),
    [selectedHotspotIds],
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-[#1B0E13]/28">
          <Pressable className="flex-1" onPress={onClose} />

          <SafeAreaView edges={["left", "right", "bottom"]}>
            <View
              className="rounded-t-[28px] bg-white px-4 pb-4 pt-3"
              style={[sheetShadowStyle, { maxHeight: "92%", minHeight: 560 }]}
            >
              <View className="items-center">
                <View className="h-1.5 w-14 rounded-full bg-[#E5E7EB]" />
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <View className="w-10" />
                <Text className="text-[15px] font-medium text-[#111827]">
                  Chọn địa điểm
                </Text>
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#FAFAFB]"
                  onPress={onClose}
                >
                  <SymbolView
                    name={{
                      ios: "xmark",
                      android: "close",
                      web: "close",
                    }}
                    size={15}
                    tintColor="#6B7280"
                  />
                </Pressable>
              </View>

              <SheetSearchField
                onChangeText={onChangeQuery}
                placeholder="Tìm tên địa điểm..."
                value={query}
              />

              {isLoading || isSearching ? (
                <View className="items-center py-6">
                  <ActivityIndicator color="#F43F78" />
                  <Text className="mt-2 text-[12px] font-normal text-[#8B7280]">
                    {isShowingSearchResults
                      ? "Đang tìm địa điểm..."
                      : "Đang tải địa điểm..."}
                  </Text>
                </View>
              ) : null}

              {errorMessage ? (
                <View className="mt-3 rounded-[20px] bg-[#FFF4F6] p-4">
                  <Text className="text-[13px] font-normal text-[#C2416C]">
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              {!isLoading && !isSearching ? (
                <ScrollView
                  className="mt-4 flex-1"
                  contentContainerStyle={{ paddingBottom: 12 }}
                  showsVerticalScrollIndicator={false}
                >
                  {hotspots.length > 0 ? (
                    hotspots.map((hotspot) => {
                      const isSelected = selectedIdSet.has(hotspot.hotspotId);

                      return (
                        <Pressable
                          key={hotspot.hotspotId}
                          className="mb-2.5 flex-row items-center rounded-[16px] border bg-white p-2.5"
                          onPress={() => {
                            onToggleHotspot(hotspot.hotspotId);
                          }}
                          style={{
                            borderColor: isSelected ? "#F5B5CB" : "#EEE8EF",
                          }}
                        >
                          <Image
                            source={{ uri: hotspot.imageUri }}
                            contentFit="cover"
                            style={{ borderRadius: 12, height: 50, width: 50 }}
                          />

                          <View className="ml-2.5 flex-1">
                            <Text
                              className="text-[13px] font-medium text-[#111827]"
                              numberOfLines={1}
                            >
                              {hotspot.hotspotName}
                            </Text>
                            <Text
                              className="mt-0.5 text-[11px] text-[#8B7280]"
                              numberOfLines={2}
                            >
                              {hotspot.address}
                            </Text>
                            <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
                              {hotspot.distanceLabel ? (
                                <Text className="text-[10px] font-normal text-[#F97316]">
                                  {hotspot.distanceLabel}
                                </Text>
                              ) : null}
                              {hotspot.tagNames.slice(0, 2).map((tagName) => (
                                <Text
                                  key={`${hotspot.hotspotId}-${tagName}`}
                                  className="text-[10px] font-normal text-[#9A5B78]"
                                >
                                  {buildHashtagLabel(tagName)}
                                </Text>
                              ))}
                            </View>
                          </View>

                          <View className="ml-3">
                            <SymbolView
                              name={
                                isSelected
                                  ? {
                                      ios: "checkmark.square.fill",
                                      android: "check_box",
                                      web: "check_box",
                                    }
                                  : {
                                      ios: "square",
                                      android: "check_box_outline_blank",
                                      web: "check_box_outline_blank",
                                    }
                              }
                              size={20}
                              tintColor={isSelected ? "#F43F78" : "#D1D5DB"}
                            />
                          </View>
                        </Pressable>
                      );
                    })
                  ) : (
                    <View className="items-center rounded-[22px] border border-dashed border-[#E5E7EB] px-4 py-8">
                      <Text className="text-[13px] font-normal text-[#8B7280]">
                        {isShowingSearchResults
                          ? "Không tìm thấy địa điểm phù hợp."
                          : "Chưa có địa điểm để chọn."}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              ) : null}

              <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
                <Text className="text-[12px] font-normal text-[#111827]">
                  Đã chọn {selectedHotspotIds.length} địa điểm
                </Text>

                <Pressable
                  className="overflow-hidden rounded-[16px]"
                  onPress={onConfirm}
                >
                  <LinearGradient
                    colors={gradientColors}
                    end={{ x: 1, y: 0.5 }}
                    start={{ x: 0, y: 0.5 }}
                    style={{
                      minWidth: 120,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                    }}
                  >
                    <Text className="text-center text-[13px] font-normal text-white">
                      Xác nhận
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TagPickerSheet({
  draft,
  onAddTag,
  onChangeDraft,
  onClose,
  onRemoveTag,
  onSelectSuggestedTag,
  selectedTags,
  suggestedTags,
  visible,
}: TagPickerSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-[#1B0E13]/28">
          <Pressable className="flex-1" onPress={onClose} />

          <SafeAreaView edges={["left", "right", "bottom"]}>
            <View
              className="rounded-t-[28px] bg-white px-4 pb-4 pt-3"
              style={[sheetShadowStyle, { maxHeight: "92%", minHeight: 560 }]}
            >
              <View className="items-center">
                <View className="h-1.5 w-14 rounded-full bg-[#E5E7EB]" />
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <View className="w-10" />
                <Text className="text-[15px] font-medium text-[#111827]">
                  Chọn thẻ
                </Text>
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#FAFAFB]"
                  onPress={onClose}
                >
                  <SymbolView
                    name={{
                      ios: "xmark",
                      android: "close",
                      web: "close",
                    }}
                    size={15}
                    tintColor="#6B7280"
                  />
                </Pressable>
              </View>

              <View
                className="mt-3 flex-row items-center rounded-[14px] border bg-[#FAFAFB] px-3"
                style={{ borderColor: "#ECE9EF", height: 40 }}
              >
                <TextInput
                  className="flex-1 text-[13px] text-[#111827]"
                  onChangeText={onChangeDraft}
                  onSubmitEditing={onAddTag}
                  placeholder="Nhập tag..."
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  value={draft}
                />
                <Pressable
                  className="rounded-full bg-[#FFF1F6] px-3 py-1.5"
                  onPress={onAddTag}
                >
                  <Text className="text-[11px] font-normal text-[#F43F78]">
                    Thêm
                  </Text>
                </Pressable>
              </View>

              {selectedTags.length > 0 ? (
                <View className="mt-4">
                  <Text className="text-[12px] font-normal text-[#6B7280]">
                    Đã chọn
                  </Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {selectedTags.map((tagName) => (
                      <TagPill
                        key={tagName}
                        active
                        label={buildHashtagLabel(tagName)}
                        onPress={() => {
                          onRemoveTag(tagName);
                        }}
                        removable
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <ScrollView
                className="mt-4 flex-1"
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator={false}
              >
                <Text className="text-[12px] font-normal text-[#6B7280]">
                  Gợi ý
                </Text>

                {suggestedTags.length > 0 ? (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {suggestedTags.map((tagName) => (
                      <TagPill
                        key={tagName}
                        active={false}
                        label={buildHashtagLabel(tagName)}
                        onPress={() => {
                          onSelectSuggestedTag(tagName);
                        }}
                      />
                    ))}
                  </View>
                ) : (
                  <View className="mt-3 rounded-[14px] border border-dashed border-[#E5E7EB] px-4 py-6">
                    <Text className="text-center text-[12px] font-normal text-[#8B7280]">
                      Chưa có thẻ gợi ý.
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
                <Text className="text-[12px] font-normal text-[#111827]">
                  Đã chọn {selectedTags.length} thẻ
                </Text>

                <Pressable
                  className="overflow-hidden rounded-[16px]"
                  onPress={onClose}
                >
                  <LinearGradient
                    colors={gradientColors}
                    end={{ x: 1, y: 0.5 }}
                    start={{ x: 0, y: 0.5 }}
                    style={{
                      minWidth: 120,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                    }}
                  >
                    <Text className="text-center text-[13px] font-normal text-white">
                      Xác nhận
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CommunityPostComposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const fallbackComposerIdentity = buildComposerIdentityFromSession(
    authSession.isAuthenticated,
    authSession.displayName,
    authSession.username,
  );
  const [composerIdentity, setComposerIdentity] = useState<ComposerIdentity>(
    fallbackComposerIdentity,
  );
  const [draftText, setDraftText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<ComposerMediaItem[]>([]);
  const [activeMediaViewerIndex, setActiveMediaViewerIndex] = useState<
    number | null
  >(null);
  const [postVisibility, setPostVisibility] = useState<PostVisibility>(() =>
    getCommunityPostVisibility(),
  );
  const [selectedRoute, setSelectedRoute] =
    useState<ComposerRouteOption | null>(null);
  const [selectedHotspots, setSelectedHotspots] = useState<
    ComposerHotspotOption[]
  >([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [activeSheet, setActiveSheet] = useState<SelectionSheet>(null);
  const [routeOptions, setRouteOptions] = useState<ComposerRouteOption[]>([]);
  const [routeSearchQuery, setRouteSearchQuery] = useState("");
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [hotspotOptions, setHotspotOptions] = useState<ComposerHotspotOption[]>(
    [],
  );
  const [hotspotSearchQuery, setHotspotSearchQuery] = useState("");
  const [hotspotSearchResults, setHotspotSearchResults] = useState<
    ComposerHotspotOption[]
  >([]);
  const [hotspotSheetSelectionIds, setHotspotSheetSelectionIds] = useState<
    number[]
  >([]);
  const [isHotspotLoading, setIsHotspotLoading] = useState(false);
  const [isHotspotSearching, setIsHotspotSearching] = useState(false);
  const [hotspotError, setHotspotError] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<ActiveTagDto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postSuccessState, setPostSuccessState] =
    useState<PostSuccessState | null>(null);
  const resolvedComposerIdentity =
    composerIdentity.accountKey === fallbackComposerIdentity.accountKey
      ? composerIdentity
      : fallbackComposerIdentity;
  const trimmedDraftText = draftText.trim();
  const composedDraftText = useMemo(
    () => buildTaggedPostContent(draftText, selectedTags),
    [draftText, selectedTags],
  );
  const composedDraftLength = composedDraftText.length;
  const visibilityLabel = getPostVisibilityLabel(postVisibility);
  const routeIdsForSubmit =
    selectedRoute === null ? [] : [selectedRoute.routeId];
  const hotspotIdsForSubmit = selectedHotspots.map(
    (hotspot) => hotspot.hotspotId,
  );
  const submitDisabledReason = !authSession.isAuthenticated
    ? "Đăng nhập để đăng bài viết cộng đồng."
    : !trimmedDraftText
      ? "Nhập nội dung để bật nút đăng."
      : composedDraftLength > maxPostLength
        ? "Nội dung và hashtag đang vượt quá giới hạn."
        : null;
  const isSubmitDisabled = submitDisabledReason !== null || isSubmitting;
  const routeSummaryLabel = selectedRoute?.routeName ?? "Chọn tuyến đường";
  const hotspotSummaryLabel =
    selectedHotspots.length === 0
      ? "Chọn địa điểm liên quan"
      : selectedHotspots.length === 1
        ? (selectedHotspots[0]?.hotspotName ?? "1 địa điểm")
        : `${selectedHotspots.length} địa điểm đã chọn`;
  const tagSummaryLabel =
    selectedTags.length === 0
      ? "Thêm thẻ"
      : selectedTags.length === 1
        ? buildHashtagLabel(selectedTags[0] ?? "")
        : `${selectedTags.length} thẻ`;
  const activeTagNames = useMemo(
    () => activeTags.map((tag) => tag.tagName),
    [activeTags],
  );
  const selectedTagIdsForSubmit = useMemo(() => {
    const tagLookup = new Map<string, number>();

    activeTags.forEach((tag) => {
      const normalizedTagName = normalizeLookupText(tag.tagName);

      if (!normalizedTagName || tagLookup.has(normalizedTagName)) {
        return;
      }

      tagLookup.set(normalizedTagName, tag.tagId);
    });

    return Array.from(
      new Set(
        selectedTags
          .map((tagName) => tagLookup.get(normalizeLookupText(tagName)) ?? null)
          .filter(
            (tagId): tagId is number =>
              typeof tagId === "number" &&
              Number.isInteger(tagId) &&
              Number.isFinite(tagId) &&
              tagId > 0,
          ),
      ),
    );
  }, [activeTags, selectedTags]);
  const selectedMediaViewerItems = useMemo<ReviewMediaViewerItem[]>(
    () =>
      selectedMedia.map((media) => ({
        type: media.type,
        uri: media.uri,
      })),
    [selectedMedia],
  );
  const suggestedTagNames = useMemo(
    () =>
      dedupeStringList([
        ...(selectedRoute?.tagNames ?? []),
        ...selectedHotspots.flatMap((hotspot) => hotspot.tagNames),
        ...activeTagNames,
      ])
        .filter(
          (tagName) =>
            !selectedTags.some(
              (selectedTag) =>
                normalizeLookupText(selectedTag) ===
                normalizeLookupText(tagName),
            ),
        )
        .slice(0, 12),
    [activeTagNames, selectedHotspots, selectedRoute, selectedTags],
  );
  const filteredRouteOptions = useMemo(() => {
    const keyword = normalizeLookupText(routeSearchQuery);

    if (!keyword) {
      return routeOptions;
    }

    return routeOptions.filter((route) =>
      normalizeLookupText(
        `${route.routeName} ${route.description} ${route.metaLabel}`,
      ).includes(keyword),
    );
  }, [routeOptions, routeSearchQuery]);
  const isShowingHotspotSearchResults = hotspotSearchQuery.trim().length > 0;
  const displayedHotspots = useMemo(() => {
    if (!isShowingHotspotSearchResults) {
      return hotspotOptions;
    }

    return hotspotSearchResults;
  }, [hotspotOptions, hotspotSearchResults, isShowingHotspotSearchResults]);
  const hotspotLookup = useMemo(() => {
    const lookup = new Map<number, ComposerHotspotOption>();

    [
      ...selectedHotspots,
      ...(selectedRoute?.hotspots ?? []),
      ...hotspotOptions,
    ].forEach((hotspot) => {
      if (
        Number.isInteger(hotspot.hotspotId) &&
        hotspot.hotspotId > 0 &&
        !lookup.has(hotspot.hotspotId)
      ) {
        lookup.set(hotspot.hotspotId, hotspot);
      }
    });

    return lookup;
  }, [hotspotOptions, selectedHotspots, selectedRoute]);

  const resolveOptionalAuth = useCallback(async () => {
    return {
      accessToken: authSession.isAuthenticated
        ? await getValidAccessToken()
        : null,
      tokenType: authSession.tokenType,
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  useFocusEffect(
    useCallback(() => {
      setPostVisibility(getCommunityPostVisibility());
    }, []),
  );

  useEffect(() => {
    let isActive = true;

    async function loadComposerIdentity() {
      if (!authSession.isAuthenticated) {
        return;
      }

      try {
        const accessToken = await getValidAccessToken();

        if (!accessToken || !isActive) {
          return;
        }

        const profile = await getMyProfile({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setComposerIdentity(
          buildComposerIdentityFromProfile(profile, fallbackComposerIdentity),
        );
      } catch (error) {
        console.warn("[community] load post composer identity failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setComposerIdentity(fallbackComposerIdentity);
      }
    }

    void loadComposerIdentity();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    fallbackComposerIdentity,
  ]);

  useEffect(() => {
    let isActive = true;

    async function loadAvailableTags() {
      try {
        const auth = await resolveOptionalAuth();
        const tags = await getActiveTags(auth);

        if (!isActive) {
          return;
        }

        setActiveTags(tags);
      } catch (error) {
        console.warn("[community] load compose tags failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    void loadAvailableTags();

    return () => {
      isActive = false;
    };
  }, [resolveOptionalAuth]);

  const loadRouteOptions = useCallback(async () => {
    setIsRouteLoading(true);
    setRouteError(null);

    try {
      const auth = await resolveOptionalAuth();
      const response = await searchRoutes({
        ...auth,
        page: 0,
        size: 30,
        sortBy: "routeId",
        sortDirection: "DESC",
        status: "PUBLISHED",
      });

      const mappedRoutes = response.content
        .filter((route) => {
          const status = readMeaningfulText(route.status)?.toUpperCase();
          return !status || status === "PUBLISHED" || status === "APPROVED";
        })
        .map(mapRouteToComposerRoute)
        .filter((route): route is ComposerRouteOption => route !== null);

      setRouteOptions(mappedRoutes);
    } catch (error) {
      setRouteError(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách tuyến đường.",
      );
    } finally {
      setIsRouteLoading(false);
    }
  }, [resolveOptionalAuth]);

  const loadHotspotOptions = useCallback(async () => {
    setIsHotspotLoading(true);
    setHotspotError(null);

    try {
      const auth = await resolveOptionalAuth();
      const hotspots = await getHotspots(auth);

      setHotspotOptions(
        dedupeHotspots(
          [...hotspots]
            .sort(sortHotspotsByProminence)
            .map((hotspot) => mapNearbyHotspotToComposerHotspot(hotspot)),
        ),
      );
    } catch (error) {
      setHotspotError(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách địa điểm.",
      );
    } finally {
      setIsHotspotLoading(false);
    }
  }, [resolveOptionalAuth]);

  useEffect(() => {
    if (activeSheet !== "hotspot") {
      return;
    }

    const keyword = hotspotSearchQuery.trim();

    if (!keyword) {
      return;
    }

    let isActive = true;
    const timeout = setTimeout(async () => {
      setIsHotspotSearching(true);
      setHotspotError(null);

      try {
        const auth = await resolveOptionalAuth();
        const response = await searchHotspots({
          ...auth,
          payload: {
            filters: [
              {
                field: "hotspotName",
                operator: "LIKE",
                value: keyword,
              },
            ],
            page: 0,
            size: 20,
            sortBy: "hotspotName",
            sortDirection: "ASC",
          },
        });

        if (!isActive) {
          return;
        }

        const mappedHotspots = dedupeHotspots(
          response.content.map((hotspot) =>
            mapNearbyHotspotToComposerHotspot(hotspot),
          ),
        ).filter((hotspot) => matchesHotspotSearchQuery(hotspot, keyword));

        setHotspotSearchResults(sortHotspotsForSearch(mappedHotspots, keyword));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setHotspotError(
          error instanceof Error ? error.message : "Không thể tìm địa điểm.",
        );
        setHotspotSearchResults(
          sortHotspotsForSearch(
            hotspotOptions.filter((hotspot) =>
              matchesHotspotSearchQuery(hotspot, keyword),
            ),
            keyword,
          ),
        );
      } finally {
        if (isActive) {
          setIsHotspotSearching(false);
        }
      }
    }, 280);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [activeSheet, hotspotOptions, hotspotSearchQuery, resolveOptionalAuth]);

  async function handlePickMedia() {
    if (selectedMedia.length >= maxMediaCount) {
      Alert.alert(
        "Đã đủ ảnh/video",
        `Bạn có thể thêm tối đa ${maxMediaCount} tệp.`,
      );
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Cần cấp quyền",
        "Hãy cho phép truy cập thư viện để thêm ảnh hoặc video vào bài viết.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: true,
      mediaTypes: ["images", "videos"],
      orderedSelection: true,
      quality: 0.85,
      selectionLimit: maxMediaCount,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    setSelectedMedia((current) => {
      const nextMediaItems: ComposerMediaItem[] = result.assets
        .filter((asset) => Boolean(asset?.uri))
        .map((asset, index) => ({
          assetId: readMeaningfulText(asset.assetId) ?? null,
          fileName:
            asset.fileName?.trim() ||
            buildFallbackFileName(
              asset.type === "video" ? "video" : "image",
              asset.mimeType,
              current.length + index + 1,
            ),
          mimeType:
            asset.mimeType?.trim() ||
            (asset.type === "video" ? "video/mp4" : "image/jpeg"),
          type: asset.type === "video" ? "video" : "image",
          uri: asset.uri,
        }));

      return dedupeComposerMediaItems([...current, ...nextMediaItems]).slice(
        0,
        maxMediaCount,
      );
    });
  }

  function openRouteSheet() {
    setActiveSheet("route");
    setRouteSearchQuery("");

    if (routeOptions.length === 0 && !isRouteLoading) {
      void loadRouteOptions();
    }
  }

  function openHotspotSheet() {
    setActiveSheet("hotspot");
    setHotspotSearchQuery("");
    setHotspotSearchResults([]);
    setIsHotspotSearching(false);
    setHotspotError(null);
    setHotspotSheetSelectionIds(
      selectedHotspots.map((hotspot) => hotspot.hotspotId),
    );

    if (hotspotOptions.length === 0 && !isHotspotLoading) {
      void loadHotspotOptions();
    }
  }

  function openTagSheet() {
    setActiveSheet("tag");
  }

  function handleSelectRoute(route: ComposerRouteOption) {
    setSelectedRoute(route);
    setActiveSheet(null);
  }

  function handleClearRouteSelection() {
    setSelectedRoute(null);
  }

  function toggleHotspotSelection(hotspotId: number) {
    setHotspotSheetSelectionIds((current) =>
      current.includes(hotspotId)
        ? current.filter((item) => item !== hotspotId)
        : [...current, hotspotId],
    );
  }

  function handleConfirmHotspotSelection() {
    const nextSelectedHotspots = hotspotSheetSelectionIds
      .map((hotspotId) => hotspotLookup.get(hotspotId))
      .filter((hotspot): hotspot is ComposerHotspotOption => Boolean(hotspot));

    setSelectedHotspots(dedupeHotspots(nextSelectedHotspots));
    setActiveSheet(null);
  }

  function addSelectedTag(value: string) {
    const nextTag = value.trim().replace(/^#/, "");

    if (!nextTag) {
      return;
    }

    setSelectedTags((current) =>
      dedupeStringList([...current, nextTag]).slice(0, maxSelectableTags),
    );
    setTagDraft("");
  }

  function handleHotspotSearchQueryChange(value: string) {
    setHotspotSearchQuery(value);

    if (!value.trim()) {
      setHotspotSearchResults([]);
      setIsHotspotSearching(false);
      setHotspotError(null);
    }
  }

  function removeSelectedTag(tagName: string) {
    setSelectedTags((current) =>
      current.filter(
        (value) => normalizeLookupText(value) !== normalizeLookupText(tagName),
      ),
    );
  }

  function handleLeaveComposer() {
    setPostSuccessState(null);

    if (router.canGoBack()) {
      router.back();
      return;
    }

    // Tab cộng đồng nằm ở route "/bookings".
    router.replace("/bookings" as Href);
  }

  function handleContinueExplore() {
    setPostSuccessState(null);
    router.replace("/explore" as Href);
  }

  async function handleSubmit() {
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để đăng bài viết cộng đồng.",
      );
      return;
    }

    if (composedDraftText.length > maxPostLength) {
      Alert.alert(
        "Nội dung quá dài",
        `Bài viết của bạn đang vượt quá ${maxPostLength} ký tự sau khi gắn thẻ.`,
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi đăng bài viết cộng đồng.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const fallbackTagNames = [...selectedTags];
      const fallbackRouteIds = [...routeIdsForSubmit];
      const createdPost = await createPost({
        accessToken,
        content: composedDraftText,
        files: selectedMedia.map((media) => ({
          fileName: media.fileName,
          mimeType: media.mimeType,
          uri: media.uri,
        })),
        hotspotIds: hotspotIdsForSubmit,
        routeIds: fallbackRouteIds,
        tagIds: selectedTagIdsForSubmit,
        tokenType: authSession.tokenType,
        visibility: postVisibility,
      });
      const createdPostStatus =
        readMeaningfulText(createdPost.status)?.toUpperCase() ?? "";
      const createdPostVisibility =
        readMeaningfulText(createdPost.visibility)?.toUpperCase() ?? "PUBLIC";
      const shouldAppearInCommunityFeed =
        createdPostVisibility === "PUBLIC" && createdPostStatus === "APPROVED";

      cacheProfilePost(mapCreatedPostToProfilePost(createdPost));

      if (shouldAppearInCommunityFeed) {
        const communityFeedPost = mapCreatedPostToCommunityFeedPost(
          createdPost,
          {
            fallbackRouteIds,
            fallbackTagNames,
          },
        );
        cacheCommunityPost(communityFeedPost);
        cacheCommunityExplorerProfile(communityFeedPost);
      }

      setPostSuccessState({
        rewardText: getCreatedPostRewardText(createdPost),
        variant: isCreatedPostPending(createdPost)
          ? "pending"
          : shouldAppearInCommunityFeed
            ? "approved"
            : "profileOnly",
      });
    } catch (error) {
      Alert.alert(
        "Không thể đăng bài",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi gửi bài viết cộng đồng.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView
        className="flex-1 bg-white"
        edges={["top", "left", "right"]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          <View className="flex-row items-center justify-between px-4 py-2.5">
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full"
              hitSlop={8}
              onPress={() => {
                router.back();
              }}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#111827"
              />
            </Pressable>

            <Text className="text-[18px] font-semibold text-[#111827]">
              Tạo bài viết
            </Text>

            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full"
              hitSlop={8}
              onPress={() => {
                router.back();
              }}
            >
              <SymbolView
                name={{
                  ios: "xmark",
                  android: "close",
                  web: "close",
                }}
                size={18}
                tintColor="#111827"
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom + 108, 138),
              paddingHorizontal: pageHorizontalPadding,
              paddingTop: 4,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-center">
              <ComposerAvatar
                displayName={resolvedComposerIdentity.displayName}
                uri={resolvedComposerIdentity.avatarUri}
              />

              <View className="ml-3 flex-1">
                <Text className="text-[14px] font-bold text-[#111827]">
                  {resolvedComposerIdentity.displayName}
                </Text>

                <View
                  className="mt-1 self-start rounded-[8px] border px-2.5 py-1"
                  style={{ borderColor: "#E9E5EA" }}
                >
                  <View className="flex-row items-center">
                    <SymbolView
                      name={{
                        ios: "globe",
                        android: "public",
                        web: "public",
                      }}
                      size={12}
                      tintColor="#6B7280"
                    />
                    <Text className="ml-1.5 text-[11px] font-normal text-[#374151]">
                      {visibilityLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View
              className="mt-3 rounded-[12px] border bg-white px-3 py-3"
              style={{ borderColor: "#ECE7EC" }}
            >
              <TextInput
                multiline
                maxLength={maxPostLength}
                onChangeText={setDraftText}
                placeholder="Bạn đang nghĩ gì?"
                placeholderTextColor="#A09AA8"
                style={{
                  color: "#111827",
                  fontSize: 14,
                  lineHeight: 20,
                  minHeight: 92,
                  padding: 0,
                  textAlignVertical: "top",
                }}
                value={draftText}
              />

              <View className="mt-2 flex-row items-center justify-end">
                <Text className="text-[10px] font-normal text-[#A09AA8]">
                  {`${composedDraftLength}/${maxPostLength}`}
                </Text>
              </View>
            </View>

            <View className="mt-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-[13px] font-medium text-[#111827]">
                  Ảnh / video
                </Text>
                <Text className="text-[11px] font-normal text-[#9CA3AF]">
                  {selectedMedia.length}/{maxMediaCount}
                </Text>
              </View>

              <ScrollView
                className="mt-2.5"
                contentContainerStyle={{ paddingRight: 8 }}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <MediaAddTile
                  canAddMore={selectedMedia.length < maxMediaCount}
                  count={selectedMedia.length}
                  onPress={() => {
                    void handlePickMedia();
                  }}
                />

                {selectedMedia.map((media, index) => (
                  <View key={`${media.uri}-${index}`} className="ml-2">
                    <MediaPreviewCard
                      item={media}
                      onPress={() => {
                        setActiveMediaViewerIndex(index);
                      }}
                      onRemove={() => {
                        setSelectedMedia((current) =>
                          current.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        );
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>

            <View className="mt-4 bg-white">
              <View className="py-1.5">
                <SelectionRow
                  iconName={{
                    ios: "map.fill",
                    android: "alt_route",
                    web: "alt_route",
                  }}
                  onPress={openRouteSheet}
                  subtitle={
                    selectedRoute?.metaLabel ?? "Gắn bài viết với một lộ trình"
                  }
                  title="Chọn tuyến đường"
                  value={routeSummaryLabel}
                />

                {selectedRoute ? (
                  <View className="mt-2">
                    <SelectedEntityChip
                      fullWidth
                      imageUri={selectedRoute.coverUri}
                      label={selectedRoute.routeName}
                      onRemove={handleClearRouteSelection}
                      subtitle={selectedRoute.metaLabel}
                    />
                  </View>
                ) : null}
              </View>

              <View className="py-1.5">
                <SelectionRow
                  iconName={{
                    ios: "mappin.circle.fill",
                    android: "location_on",
                    web: "location_on",
                  }}
                  onPress={openHotspotSheet}
                  subtitle={
                    selectedHotspots.length > 0
                      ? `Đã chọn ${selectedHotspots.length} địa điểm`
                      : "Chọn địa điểm liên quan đến bài viết"
                  }
                  title="Gắn địa điểm"
                  value={hotspotSummaryLabel}
                />

                {selectedHotspots.length > 0 ? (
                  <View className="mt-2 gap-2">
                    {selectedHotspots.map((hotspot) => (
                      <SelectedEntityChip
                        key={hotspot.hotspotId}
                        imageUri={hotspot.imageUri}
                        label={hotspot.hotspotName}
                        onRemove={() => {
                          setSelectedHotspots((current) =>
                            current.filter(
                              (item) => item.hotspotId !== hotspot.hotspotId,
                            ),
                          );
                        }}
                        subtitle={hotspot.distanceLabel ?? hotspot.address}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              <View className="py-1.5">
                <SelectionRow
                  iconName={{
                    ios: "tag.fill",
                    android: "sell",
                    web: "sell",
                  }}
                  onPress={openTagSheet}
                  subtitle={
                    selectedTags.length > 0
                      ? `Đã chọn ${selectedTags.length} thẻ`
                      : "Thêm các thẻ liên quan"
                  }
                  title="Chọn thẻ"
                  value={tagSummaryLabel}
                />

                {selectedTags.length > 0 ? (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {selectedTags.map((tagName) => (
                      <TagPill
                        key={tagName}
                        active
                        label={buildHashtagLabel(tagName)}
                        onPress={() => {
                          removeSelectedTag(tagName);
                        }}
                        removable
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>

          <View
            className="absolute inset-x-0 bottom-0 border-t border-[#F3EDF1] bg-white px-4 pt-2.5"
            style={[
              footerShadowStyle,
              {
                paddingBottom: Math.max(insets.bottom + 8, 12),
              },
            ]}
          >
            <View className="flex-row items-center gap-3">
              <Pressable
                className="flex-1 flex-row items-center justify-center rounded-[12px] border bg-white px-3"
                onPress={() => {
                  router.push("/community/post-visibility" as Href);
                }}
                style={{
                  borderColor: chipBorderColor,
                  height: footerActionHeight,
                }}
              >
                <SymbolView
                  name={{
                    ios: "globe",
                    android: "public",
                    web: "public",
                  }}
                  size={15}
                  tintColor="#111827"
                />
                <Text className="ml-1.5 text-[12px] font-normal text-[#111827]">
                  {visibilityLabel}
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.down",
                    android: "keyboard_arrow_down",
                    web: "keyboard_arrow_down",
                  }}
                  size={16}
                  tintColor="#9CA3AF"
                />
              </Pressable>

              <Pressable
                className="flex-1 overflow-hidden rounded-[12px]"
                disabled={isSubmitDisabled}
                onPress={() => {
                  void handleSubmit();
                }}
              >
                <LinearGradient
                  colors={
                    isSubmitDisabled ? ["#E5E7EB", "#E5E7EB"] : gradientColors
                  }
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={{
                    flex: 1,
                    height: footerActionHeight,
                    justifyContent: "center",
                    opacity: isSubmitDisabled ? 0.88 : 1,
                    paddingHorizontal: 22,
                  }}
                >
                  <View className="items-center justify-center">
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-[14px] font-normal text-white">
                        Đăng bài
                      </Text>
                    )}
                  </View>
                </LinearGradient>
              </Pressable>
            </View>

            <View className="mt-1.5 flex-row items-center justify-between gap-4">
              <Text className="flex-1 text-[10px] font-normal text-[#9CA3AF]">
                {submitDisabledReason ??
                  `Sẽ gắn ${routeIdsForSubmit.length} tuyến đường, ${hotspotIdsForSubmit.length} địa điểm và ${selectedTags.length} thẻ.`}
              </Text>
              <Text className="text-[10px] font-normal text-[#9CA3AF]">
                {selectedMedia.length}/{maxMediaCount}
              </Text>
            </View>
          </View>

          <RoutePickerSheet
            errorMessage={routeError}
            isLoading={isRouteLoading}
            onChangeQuery={setRouteSearchQuery}
            onClearSelection={handleClearRouteSelection}
            onClose={() => {
              setActiveSheet(null);
            }}
            onSelectRoute={handleSelectRoute}
            query={routeSearchQuery}
            routes={filteredRouteOptions}
            selectedRouteId={selectedRoute?.routeId ?? null}
            visible={activeSheet === "route"}
          />

          <HotspotPickerSheet
            errorMessage={hotspotError}
            hotspots={displayedHotspots}
            isLoading={isHotspotLoading}
            isSearching={isHotspotSearching}
            isShowingSearchResults={isShowingHotspotSearchResults}
            onChangeQuery={handleHotspotSearchQueryChange}
            onClose={() => {
              setActiveSheet(null);
            }}
            onConfirm={handleConfirmHotspotSelection}
            onToggleHotspot={toggleHotspotSelection}
            query={hotspotSearchQuery}
            selectedHotspotIds={hotspotSheetSelectionIds}
            visible={activeSheet === "hotspot"}
          />

          <TagPickerSheet
            draft={tagDraft}
            onAddTag={() => {
              addSelectedTag(tagDraft);
            }}
            onChangeDraft={setTagDraft}
            onClose={() => {
              setActiveSheet(null);
            }}
            onRemoveTag={removeSelectedTag}
            onSelectSuggestedTag={addSelectedTag}
            selectedTags={selectedTags}
            suggestedTags={suggestedTagNames}
            visible={activeSheet === "tag"}
          />

          {activeMediaViewerIndex !== null &&
          selectedMediaViewerItems.length > 0 ? (
            <ReviewMediaViewer
              initialIndex={activeMediaViewerIndex}
              items={selectedMediaViewerItems}
              onClose={() => {
                setActiveMediaViewerIndex(null);
              }}
            />
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {postSuccessState !== null ? (
        <CommunityPostSuccessOverlay
          avatarFallbackLabel={resolvedComposerIdentity.displayName}
          avatarUri={resolvedComposerIdentity.avatarUri}
          onClose={handleLeaveComposer}
          onContinueExplore={handleContinueExplore}
          onViewPost={handleLeaveComposer}
          rewardText={postSuccessState.rewardText}
          variant={postSuccessState.variant}
        />
      ) : null}
    </View>
  );
}
