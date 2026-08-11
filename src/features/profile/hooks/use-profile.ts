import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthSession, getValidAccessToken } from "@/features/auth/hooks/use-auth-session";
import { getHotspotBySlug, type HotspotDetail } from "@/features/home/data/hotspots";
import { routes, type RouteItem } from "@/lib/demo-data";

import { getGamificationLevels } from "../api/get-levels";
import { getMyProfile } from "../api/get-me";
import {
  getMyProfilePosts,
  getUserProfilePosts,
} from "../api/get-profile-posts";
import { useCachedProfilePosts } from "../data/profile-post-cache";
import { CURRENT_USER_ID, getProfileById, getProfilePosts } from "../data/profile-demo";
import { applyLevelProgressToProfile } from "../lib/level-progress";
import type { Profile, ProfilePost, ProfilePostStatus } from "../types";

type UseProfileResult = {
  likedHotspots: HotspotDetail[];
  profile: Profile | undefined;
  posts: ProfilePost[];
  userRoutes: RouteItem[];
  isLoading: boolean;
  error: Error | null;
  reloadProfile: () => Promise<void>;
};

type UseProfileOptions = {
  postStatus?: ProfilePostStatus | null;
};

function mergeProfileWithFallback(
  profile: Profile,
  fallbackProfile?: Profile,
): Profile {
  if (!fallbackProfile) {
    return profile;
  }

  return {
    ...profile,
    cover: profile.cover ?? fallbackProfile.cover,
  };
}

function filterPostsForOwner(posts: ProfilePost[], profile: Profile) {
  const normalizedProfileId = profile.id.trim();
  const normalizedUsername = profile.username.trim().toLowerCase();

  return posts.filter((post) => {
    const normalizedPostUserId = post.userId.trim();
    const normalizedPostUsername = post.username.trim().toLowerCase();

    return (
      (normalizedProfileId.length > 0 && normalizedPostUserId === normalizedProfileId) ||
      (normalizedUsername.length > 0 && normalizedPostUsername === normalizedUsername)
    );
  });
}

function resolveProfilePostTimestamp(post: ProfilePost) {
  const resolvedTimestamp = Date.parse(post.createdAt ?? "");

  return Number.isFinite(resolvedTimestamp) ? resolvedTimestamp : 0;
}

function mergeProfilePosts(remotePosts: ProfilePost[], cachedPosts: ProfilePost[]) {
  const mergedPostsById = new Map(remotePosts.map((post) => [post.id, post] as const));

  for (const cachedPost of cachedPosts) {
    mergedPostsById.set(cachedPost.id, cachedPost);
  }

  return Array.from(mergedPostsById.values()).sort(
    (left, right) => resolveProfilePostTimestamp(right) - resolveProfilePostTimestamp(left),
  );
}

export function useProfile(userId?: string, options?: UseProfileOptions): UseProfileResult {
  const authSession = useAuthSession();
  const postStatus = options?.postStatus ?? null;
  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const fallbackProfile = useMemo(
    () => getProfileById(userId ?? CURRENT_USER_ID),
    [userId],
  );
  const [profile, setProfile] = useState<Profile | undefined>();
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [isLoading, setIsLoading] = useState(authSession.isAuthenticated);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!authSession.isAuthenticated) {
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

      const [profileResult, levelsResult] = await Promise.allSettled([
        getMyProfile({
          accessToken,
          tokenType: authSession.tokenType,
        }),
        getGamificationLevels({
          accessToken,
          tokenType: authSession.tokenType,
        }),
      ]);

      if (profileResult.status !== "fulfilled") {
        throw profileResult.reason;
      }

      let resolvedProfile = profileResult.value;

      if (levelsResult.status === "fulfilled") {
        resolvedProfile = applyLevelProgressToProfile(
          profileResult.value,
          levelsResult.value,
        );
      } else {
        const levelError = levelsResult.reason;
        console.warn("[profile] level progress unavailable", {
          error:
            levelError instanceof Error
              ? {
                  message: levelError.message,
                  name: levelError.name,
                  stack: levelError.stack,
                }
              : levelError,
          });
      }

      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      const mergedProfile = mergeProfileWithFallback(resolvedProfile, fallbackProfile);
      setProfile(mergedProfile);

      const profileNumericId = Number.parseInt(resolvedProfile.id, 10);
      const postsRequest = userId
        ? Number.isFinite(profileNumericId) && profileNumericId > 0
          ? getUserProfilePosts({
              accessToken,
              size: 10,
              sort: [],
              status: postStatus,
              tokenType: authSession.tokenType,
              userId: profileNumericId,
            })
          : Promise.reject(
              new Error("Không xác định được tài khoản để tải bài viết."),
            )
        : getMyProfilePosts({
            accessToken,
            size: 10,
            sort: [],
            status: postStatus,
            tokenType: authSession.tokenType,
          });
      const [resolvedPostsResult] = await Promise.allSettled([postsRequest]);

      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      if (resolvedPostsResult.status === "fulfilled") {
        setPosts(filterPostsForOwner(resolvedPostsResult.value, mergedProfile));
      } else {
        const postsError =
          resolvedPostsResult.reason instanceof Error
            ? resolvedPostsResult.reason
            : new Error("Không thể tải bài viết.");

        console.warn("[profile] posts unavailable", {
          error: {
            message: postsError.message,
            name: postsError.name,
            stack: postsError.stack,
          },
        });
        setPosts([]);
        setError(postsError);
      }
    } catch (nextError) {
      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      setError(
        nextError instanceof Error
          ? nextError
          : new Error("Không thể tải hồ sơ."),
      );
      setProfile(fallbackProfile);
      setPosts([]);
    } finally {
      if (isMountedRef.current && requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    fallbackProfile,
    postStatus,
    userId,
  ]);

  useEffect(() => {
    if (!authSession.isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const loadTimer = setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => {
      clearTimeout(loadTimer);
    };
  }, [authSession.isAuthenticated, loadProfile]);

  const resolvedProfile = authSession.isAuthenticated ? profile : fallbackProfile;
  const resolvedError = authSession.isAuthenticated ? error : null;
  const resolvedIsLoading = authSession.isAuthenticated ? isLoading : false;

  const fallbackPosts = useMemo(
    () => (resolvedProfile ? getProfilePosts(resolvedProfile.id) : []),
    [resolvedProfile],
  );
  const cachedProfilePosts = useCachedProfilePosts({
    ownerId: resolvedProfile?.id ?? fallbackProfile?.id,
    status: postStatus,
    username:
      resolvedProfile?.username ??
      fallbackProfile?.username ??
      authSession.username ??
      null,
  });
  const resolvedPosts = authSession.isAuthenticated
    ? mergeProfilePosts(posts, cachedProfilePosts)
    : fallbackPosts;

  const userRoutes = useMemo(() => {
    if (!resolvedProfile) return [];
    return resolvedProfile.routeIds
      .map((id) => routes.find((route) => route.id === id))
      .filter(Boolean) as RouteItem[];
  }, [resolvedProfile]);

  const likedHotspots = useMemo(() => {
    if (!resolvedProfile) return [];
    return resolvedProfile.savedHotspotSlugs
      .map((slug) => getHotspotBySlug(slug))
      .filter(Boolean) as HotspotDetail[];
  }, [resolvedProfile]);

  return {
    likedHotspots,
    profile: resolvedProfile,
    posts: resolvedPosts,
    userRoutes,
    isLoading: resolvedIsLoading,
    error: resolvedError,
    reloadProfile: loadProfile,
  };
}
