import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";

import { getGamificationLevels } from "../api/get-levels";
import { getMyProfile } from "../api/get-me";
import { useCurrentProfile } from "../data/current-profile-store";
import { applyLevelProgressToProfile } from "../lib/level-progress";
import type { Profile } from "../types";
import { setPremiumStatusFromProfile } from "./use-premium-status";

/**
 * Cấp độ + XP THẬT của user hiện tại cho các màn ngoài trang Hồ sơ (VD thẻ
 * "Cấp" ở trang Hành trình).
 *
 * Khác `useProfile()`: hook này chỉ gọi `GET /me` + `GET /gamification/levels`,
 * không kéo theo danh sách bài viết, và cũng không ghi đè
 * `current-profile-store` để tránh làm mất dữ liệu mà trang Hồ sơ đã dựng sẵn.
 * Profile trong store (nếu có) được dùng làm giá trị hiển thị tạm trong lúc
 * chờ API trả về.
 */
export function useMyLevelProgress() {
  const session = useAuthSession();
  const cachedProfile = useCurrentProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadLevelProgress() {
        if (!session.isAuthenticated) {
          setProfile(null);
          return;
        }

        if (isFetchingRef.current) return;

        isFetchingRef.current = true;
        setIsLoading(true);

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken) return;

          const [profileResult, levelsResult] = await Promise.allSettled([
            getMyProfile({ accessToken, tokenType: session.tokenType }),
            getGamificationLevels({
              accessToken,
              tokenType: session.tokenType,
            }),
          ]);

          if (cancelled) return;

          if (profileResult.status !== "fulfilled") {
            console.warn(
              "[profile] load level progress failed",
              profileResult.reason,
            );
            return;
          }

          const resolvedProfile =
            levelsResult.status === "fulfilled"
              ? applyLevelProgressToProfile(
                  profileResult.value,
                  levelsResult.value,
                )
              : profileResult.value;

          if (levelsResult.status === "rejected") {
            console.warn(
              "[profile] level catalog unavailable",
              levelsResult.reason,
            );
          }

          setProfile(resolvedProfile);
          setPremiumStatusFromProfile(resolvedProfile.isPremium);
        } catch (error) {
          console.warn("[profile] load level progress failed", error);
        } finally {
          isFetchingRef.current = false;

          if (!cancelled) {
            setIsLoading(false);
          }
        }
      }

      void loadLevelProgress();

      return () => {
        cancelled = true;
      };
    }, [session.isAuthenticated, session.tokenType]),
  );

  return {
    isLoading,
    profile: session.isAuthenticated ? (profile ?? cachedProfile) : null,
  };
}
