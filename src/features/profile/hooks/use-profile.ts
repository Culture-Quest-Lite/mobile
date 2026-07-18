import { useEffect, useMemo, useState } from "react";

import { useAuthSession, getValidAccessToken } from "@/features/auth/hooks/use-auth-session";
import { getHotspotBySlug, type HotspotDetail } from "@/features/home/data/hotspots";
import { routes, type RouteItem } from "@/lib/demo-data";

import { getGamificationLevels } from "../api/get-levels";
import { getMyProfile } from "../api/get-me";
import { getMyProfilePosts } from "../api/get-profile-posts";
import { CURRENT_USER_ID, getProfileById, getProfilePosts } from "../data/profile-demo";
import { applyLevelProgressToProfile } from "../lib/level-progress";
import type { Profile, ProfilePost } from "../types";

type UseProfileResult = {
  likedHotspots: HotspotDetail[];
  profile: Profile | undefined;
  posts: ProfilePost[];
  userRoutes: RouteItem[];
  isLoading: boolean;
  error: Error | null;
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
    avatar: profile.avatar ?? fallbackProfile.avatar,
    cover: profile.cover ?? fallbackProfile.cover,
  };
}

export function useProfile(userId?: string): UseProfileResult {
  const authSession = useAuthSession();
  const fallbackProfile = useMemo(
    () => getProfileById(userId ?? CURRENT_USER_ID),
    [userId],
  );
  const [profile, setProfile] = useState<Profile | undefined>();
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!authSession.isAuthenticated) {
      return () => {
        isActive = false;
      };
    }

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = await getValidAccessToken();

        if (!accessToken) {
          throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }

        const [profileResult, levelsResult, postsResult] = await Promise.allSettled([
          getMyProfile({
            accessToken,
            tokenType: authSession.tokenType,
          }),
          getGamificationLevels({
            accessToken,
            tokenType: authSession.tokenType,
          }),
          getMyProfilePosts({
            accessToken,
            size: 10,
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

        if (!isActive) {
          return;
        }

        setProfile(mergeProfileWithFallback(resolvedProfile, fallbackProfile));

        if (postsResult.status === "fulfilled") {
          setPosts(postsResult.value);
        } else {
          const postsError =
            postsResult.reason instanceof Error
              ? postsResult.reason
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
        if (!isActive) {
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
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, fallbackProfile]);

  const resolvedProfile = authSession.isAuthenticated ? profile : fallbackProfile;
  const resolvedError = authSession.isAuthenticated ? error : null;
  const resolvedIsLoading = authSession.isAuthenticated ? isLoading : false;

  const fallbackPosts = useMemo(
    () => (resolvedProfile ? getProfilePosts(resolvedProfile.id) : []),
    [resolvedProfile],
  );
  const resolvedPosts = authSession.isAuthenticated ? posts : fallbackPosts;

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
  };
}
