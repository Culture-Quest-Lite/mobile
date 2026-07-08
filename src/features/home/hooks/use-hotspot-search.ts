import { useEffect, useMemo, useRef, useState } from "react";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";

import type { NearbyHotspotDto } from "../api/get-nearby-hotspots";
import {
  getHotspots,
  searchHotspots,
  type HotspotSearchFilterPayload,
  type HotspotSearchSortDirection,
  type SearchHotspotsPage,
} from "../api/search-hotspots";
import {
  buildBaseStatusFilter,
  buildQuickSearchDescriptor,
  buildFiltersFromDrafts,
  buildHotspotSearchPayload,
  createHotspotAdvancedFilterDraft,
  defaultHotspotSearchSortBy,
  defaultHotspotSearchSortDirection,
  filterHotspotsByKeywordLocally,
  filterHotspotsLocally,
  formatHotspotFilterChipLabel,
  getFieldOperators,
  getTotalPagesFromCount,
  hotspotSearchPageSize,
  isAutoApplyField,
  paginateHotspotsLocally,
  sortHotspotsLocally,
  type HotspotAdvancedFilterDraft,
  type HotspotSearchSortBy,
} from "../utils/hotspot-search-utils";

type LoadState = "error" | "idle" | "loading" | "ready";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

export function useHotspotSearch() {
  const authSession = useAuthSession();
  const localRequestVersionRef = useRef(0);
  const remoteRequestVersionRef = useRef(0);

  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [draftFilters, setDraftFilters] = useState<HotspotAdvancedFilterDraft[]>([]);
  const [appliedAutoFilters, setAppliedAutoFilters] = useState<
    HotspotSearchFilterPayload[]
  >([]);
  const [appliedManualFilters, setAppliedManualFilters] = useState<
    HotspotSearchFilterPayload[]
  >([]);
  const [pendingSortBy, setPendingSortBy] =
    useState<HotspotSearchSortBy>(defaultHotspotSearchSortBy);
  const [pendingSortDirection, setPendingSortDirection] =
    useState<HotspotSearchSortDirection>(defaultHotspotSearchSortDirection);
  const [appliedSortBy, setAppliedSortBy] =
    useState<HotspotSearchSortBy>(defaultHotspotSearchSortBy);
  const [appliedSortDirection, setAppliedSortDirection] =
    useState<HotspotSearchSortDirection>(defaultHotspotSearchSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const [localHotspots, setLocalHotspots] = useState<NearbyHotspotDto[]>([]);
  const [localStatus, setLocalStatus] = useState<LoadState>("idle");
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);
  const [remotePageData, setRemotePageData] = useState<SearchHotspotsPage | null>(
    null,
  );
  const [remoteStatus, setRemoteStatus] = useState<LoadState>("idle");
  const [remoteErrorMessage, setRemoteErrorMessage] = useState<string | null>(null);
  const [localReloadNonce, setLocalReloadNonce] = useState(0);
  const [remoteReloadNonce, setRemoteReloadNonce] = useState(0);

  const autoApplyDrafts = useMemo(
    () => draftFilters.filter((filter) => isAutoApplyField(filter.field)),
    [draftFilters],
  );
  const manualApplyDrafts = useMemo(
    () => draftFilters.filter((filter) => !isAutoApplyField(filter.field)),
    [draftFilters],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAppliedAutoFilters(buildFiltersFromDrafts(autoApplyDrafts));
      setCurrentPage(1);
    }, 350);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [autoApplyDrafts]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 350);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [keyword]);

  const appliedAdvancedFilters = useMemo(
    () => [...appliedAutoFilters, ...appliedManualFilters],
    [appliedAutoFilters, appliedManualFilters],
  );
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;
  const trimmedKeyword = debouncedKeyword.trim();
  const quickSearchDescriptor = useMemo(
    () => buildQuickSearchDescriptor(trimmedKeyword),
    [trimmedKeyword],
  );
  const isRemoteSearchMode = hasAdvancedFilters;

  const baseLocalFilters = useMemo(() => [buildBaseStatusFilter()], []);
  const locallyProcessedHotspots = useMemo(() => {
    const locallyFilteredHotspots = filterHotspotsLocally(
      localHotspots,
      baseLocalFilters,
    );
    const locallyKeywordMatchedHotspots = filterHotspotsByKeywordLocally(
      locallyFilteredHotspots,
      trimmedKeyword,
    );

    return sortHotspotsLocally(
      locallyKeywordMatchedHotspots,
      appliedSortBy,
      appliedSortDirection,
    );
  }, [
    appliedSortBy,
    appliedSortDirection,
    baseLocalFilters,
    localHotspots,
    trimmedKeyword,
  ]);
  const localTotalElements = locallyProcessedHotspots.length;
  const localTotalPages = getTotalPagesFromCount(
    localTotalElements,
    hotspotSearchPageSize,
  );
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const requestVersion = ++localRequestVersionRef.current;

    async function loadAllHotspots() {
      setLocalStatus("loading");
      setLocalErrorMessage(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        if (!isActive || controller.signal.aborted) {
          return;
        }

        const hotspots = await getHotspots({
          accessToken,
          signal: controller.signal,
          tokenType: authSession.tokenType,
        });

        if (
          !isActive ||
          controller.signal.aborted ||
          requestVersion !== localRequestVersionRef.current
        ) {
          return;
        }

        setLocalHotspots(hotspots);
        setLocalStatus("ready");
      } catch (error) {
        if (
          !isActive ||
          controller.signal.aborted ||
          requestVersion !== localRequestVersionRef.current
        ) {
          return;
        }

        setLocalHotspots([]);
        setLocalErrorMessage(
          getErrorMessage(error, "Không thể tải danh sách hotspot."),
        );
        setLocalStatus("error");
      }
    }

    void loadAllHotspots();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [authSession.isAuthenticated, authSession.tokenType, localReloadNonce]);

  useEffect(() => {
    if (!isRemoteSearchMode) {
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    const requestVersion = ++remoteRequestVersionRef.current;

    async function loadSearchResults() {
      setRemoteStatus("loading");
      setRemoteErrorMessage(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        if (!isActive || controller.signal.aborted) {
          return;
        }

        const response = await searchHotspots({
          accessToken,
          payload: buildHotspotSearchPayload({
            advancedFilters: appliedAdvancedFilters,
            keyword: trimmedKeyword,
            page: currentPage - 1,
            sortBy: appliedSortBy,
            sortDirection: appliedSortDirection,
          }),
          signal: controller.signal,
          tokenType: authSession.tokenType,
        });

        if (
          !isActive ||
          controller.signal.aborted ||
          requestVersion !== remoteRequestVersionRef.current
        ) {
          return;
        }

        setRemotePageData(response);
        setRemoteStatus("ready");
      } catch (error) {
        if (
          !isActive ||
          controller.signal.aborted ||
          requestVersion !== remoteRequestVersionRef.current
        ) {
          return;
        }

        setRemotePageData(null);
        setRemoteErrorMessage(
          getErrorMessage(error, "Không thể tìm kiếm hotspot."),
        );
        setRemoteStatus("error");
      }
    }

    void loadSearchResults();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    appliedAdvancedFilters,
    appliedSortBy,
    appliedSortDirection,
    authSession.isAuthenticated,
    authSession.tokenType,
    currentPage,
    isRemoteSearchMode,
    remoteReloadNonce,
    trimmedKeyword,
  ]);

  const totalPages = isRemoteSearchMode
    ? remotePageData?.page.totalPages ?? 1
    : localTotalPages;
  const resolvedCurrentPage = Math.min(currentPage, totalPages);

  const results = isRemoteSearchMode
    ? remotePageData?.content ?? []
    : paginateHotspotsLocally(
        locallyProcessedHotspots,
        resolvedCurrentPage,
        hotspotSearchPageSize,
      );
  const totalElements = isRemoteSearchMode
    ? remotePageData?.page.totalElements ?? 0
    : localTotalElements;
  const status = isRemoteSearchMode ? remoteStatus : localStatus;
  const errorMessage = isRemoteSearchMode ? remoteErrorMessage : localErrorMessage;

  const summaryChips = useMemo(() => {
    const chips: string[] = [];

    if (quickSearchDescriptor) {
      chips.push(`${quickSearchDescriptor.label}: ${quickSearchDescriptor.term}`);
    }

    appliedAdvancedFilters.forEach((filter) => {
      chips.push(formatHotspotFilterChipLabel(filter));
    });

    if (
      appliedSortBy !== defaultHotspotSearchSortBy ||
      appliedSortDirection !== defaultHotspotSearchSortDirection
    ) {
      chips.push(`Sắp xếp: ${appliedSortBy} ${appliedSortDirection}`);
    }

    return chips;
  }, [
    appliedAdvancedFilters,
    appliedSortBy,
    appliedSortDirection,
    quickSearchDescriptor,
  ]);

  const applyAdvancedFilters = () => {
    setAppliedManualFilters(buildFiltersFromDrafts(manualApplyDrafts));
    setAppliedSortBy(pendingSortBy);
    setAppliedSortDirection(pendingSortDirection);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setKeyword("");
    setDraftFilters([]);
    setAppliedAutoFilters([]);
    setAppliedManualFilters([]);
    setPendingSortBy(defaultHotspotSearchSortBy);
    setPendingSortDirection(defaultHotspotSearchSortDirection);
    setAppliedSortBy(defaultHotspotSearchSortBy);
    setAppliedSortDirection(defaultHotspotSearchSortDirection);
    setCurrentPage(1);
    setRemotePageData(null);
    setRemoteErrorMessage(null);
  };

  const addDraftFilter = (
    overrides: Partial<Omit<HotspotAdvancedFilterDraft, "id">> = {},
  ) => {
    setDraftFilters((currentFilters) => [
      ...currentFilters,
      createHotspotAdvancedFilterDraft(overrides),
    ]);
  };

  const updateDraftFilter = (
    filterId: string,
    patch: Partial<Omit<HotspotAdvancedFilterDraft, "id">>,
  ) => {
    setDraftFilters((currentFilters) =>
      currentFilters.map((filter) => {
        if (filter.id !== filterId) {
          return filter;
        }

        const nextField = patch.field ?? filter.field;
        const nextOperator = patch.operator ?? filter.operator;
        const supportedOperators = getFieldOperators(nextField);
        const resolvedOperator = supportedOperators.includes(nextOperator)
          ? nextOperator
          : supportedOperators[0];

        return {
          ...filter,
          ...patch,
          field: nextField,
          operator: resolvedOperator,
        };
      }),
    );
  };

  const removeDraftFilter = (filterId: string) => {
    setDraftFilters((currentFilters) =>
      currentFilters.filter((filter) => filter.id !== filterId),
    );
  };

  const retry = () => {
    if (isRemoteSearchMode) {
      setRemoteReloadNonce((currentValue) => currentValue + 1);
      return;
    }

    setLocalReloadNonce((currentValue) => currentValue + 1);
  };

  return {
    addDraftFilter,
    applyAdvancedFilters,
    currentPage: resolvedCurrentPage,
    draftFilters,
    errorMessage,
    hasAdvancedFilters,
    isRemoteSearchMode,
    isResetVisible:
      trimmedKeyword.length > 0 ||
      draftFilters.length > 0 ||
      appliedSortBy !== defaultHotspotSearchSortBy ||
      appliedSortDirection !== defaultHotspotSearchSortDirection,
    keyword,
    pendingSortBy,
    pendingSortDirection,
    removeDraftFilter,
    resetFilters,
    results,
    retry,
    setCurrentPage: (page: number) =>
      setCurrentPage(Math.max(1, Math.min(page, totalPages))),
    setKeyword: (value: string) => {
      setKeyword(value);
      setCurrentPage(1);
    },
    setPendingSortBy,
    setPendingSortDirection,
    status,
    summaryChips,
    totalElements,
    totalPages,
    updateDraftFilter,
  };
}
