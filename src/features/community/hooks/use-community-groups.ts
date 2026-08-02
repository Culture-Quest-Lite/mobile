import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getCommunityGroups,
  type CommunityGroupPayload,
} from "../api/group-api";
import { cacheCommunityGroupSession } from "../data/community-group-session-store";

export type CommunityGroupsStatus = "idle" | "loading" | "ready" | "error";

export function useCommunityGroups() {
  const authSession = useAuthSession();
  const communitySessionKey = authSession.isAuthenticated
    ? authSession.username?.trim() || authSession.displayName.trim() || "authenticated-user"
    : "guest";
  const communitySessionKeyRef = useRef(communitySessionKey);
  const [groups, setGroups] = useState<CommunityGroupPayload[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<CommunityGroupsStatus>("idle");

  useEffect(() => {
    communitySessionKeyRef.current = communitySessionKey;
  }, [communitySessionKey]);

  const loadCommunityGroups = useCallback(
    async (isActive?: () => boolean) => {
      const sessionKeyAtRequestStart = communitySessionKey;
      setStatus("loading");
      setErrorMessage(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const nextGroups = await getCommunityGroups({
          accessToken: accessToken ?? undefined,
          tokenType: authSession.tokenType,
        });

        if (
          (isActive && !isActive()) ||
          communitySessionKeyRef.current !== sessionKeyAtRequestStart
        ) {
          return;
        }

        nextGroups.forEach((group) => {
          cacheCommunityGroupSession({
            ...group,
            source: "listed",
          });
        });
        setGroups(nextGroups);
        setStatus("ready");
      } catch (error) {
        console.warn("[community] load groups failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (
          (isActive && !isActive()) ||
          communitySessionKeyRef.current !== sessionKeyAtRequestStart
        ) {
          return;
        }

        setGroups([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách nhóm cộng đồng.",
        );
        setStatus("error");
      }
    },
    [authSession.isAuthenticated, authSession.tokenType, communitySessionKey],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadCommunityGroups(() => isActive);

      return () => {
        isActive = false;
      };
    }, [loadCommunityGroups]),
  );

  const reload = useCallback(async () => {
    await loadCommunityGroups();
  }, [loadCommunityGroups]);

  return {
    errorMessage,
    groups,
    reload,
    status,
  };
}
