import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

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
  const [groups, setGroups] = useState<CommunityGroupPayload[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<CommunityGroupsStatus>("idle");

  const loadCommunityGroups = useCallback(
    async (isActive?: () => boolean) => {
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

        if (isActive && !isActive()) {
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

        if (isActive && !isActive()) {
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
    [authSession.isAuthenticated, authSession.tokenType],
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

  const reload = useCallback(() => {
    void loadCommunityGroups();
  }, [loadCommunityGroups]);

  return {
    errorMessage,
    groups,
    reload,
    status,
  };
}
