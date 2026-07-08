import type { NearbyHotspotDto } from "../api/get-nearby-hotspots";
import type {
  HotspotSearchFilterPayload,
  HotspotSearchOperator,
  HotspotSearchSortDirection,
  SearchHotspotsPayload,
} from "../api/search-hotspots";

export type HotspotSearchField =
  | "hotspotName"
  | "status"
  | "tags.tagName"
  | "xp"
  | "address"
  | "description"
  | "historyInformation"
  | "point"
  | "checkInRadius"
  | "createdAt"
  | "createdBy.username";

export type HotspotSearchSortBy =
  | "createdAt"
  | "hotspotName"
  | "xp"
  | "point"
  | "checkInRadius";

export type HotspotQuickSearchField = "address" | "hotspotName";

type HotspotFieldDataType = "datetime" | "number" | "text";

export type HotspotAdvancedFilterDraft = {
  field: HotspotSearchField;
  id: string;
  operator: HotspotSearchOperator;
  rawValue: string;
};

type HotspotSearchFieldConfig = {
  autoApply: boolean;
  dataType: HotspotFieldDataType;
  label: string;
  operators: readonly HotspotSearchOperator[];
  placeholder: string;
};

export type HotspotQuickSearchDescriptor = {
  field: HotspotQuickSearchField;
  filter: HotspotSearchFilterPayload;
  label: string;
  term: string;
};

export const hotspotSearchPageSize = 10;
export const defaultHotspotSearchSortBy = "createdAt" as const satisfies HotspotSearchSortBy;
export const defaultHotspotSearchSortDirection =
  "DESC" as const satisfies HotspotSearchSortDirection;
export const hotspotSearchBaseStatusValues = ["DRAFT", "PUBLISHED"] as const;

export const hotspotSearchFieldConfigs: Record<
  HotspotSearchField,
  HotspotSearchFieldConfig
> = {
  hotspotName: {
    autoApply: false,
    dataType: "text",
    label: "Tên hotspot",
    operators: ["LIKE", "EQUALS", "NOT_EQUALS"],
    placeholder: "Ví dụ: Bưu điện Sài Gòn",
  },
  status: {
    autoApply: true,
    dataType: "text",
    label: "Trạng thái",
    operators: ["EQUALS", "NOT_EQUALS"],
    placeholder: "DRAFT hoặc PUBLISHED",
  },
  "tags.tagName": {
    autoApply: true,
    dataType: "text",
    label: "Tag",
    operators: ["LIKE", "EQUALS"],
    placeholder: "Ví dụ: Di sản",
  },
  xp: {
    autoApply: false,
    dataType: "number",
    label: "XP",
    operators: [
      "GREATER_THAN_OR_EQUAL",
      "GREATER_THAN",
      "EQUALS",
      "LESS_THAN",
      "LESS_THAN_OR_EQUAL",
    ],
    placeholder: "Ví dụ: 100",
  },
  address: {
    autoApply: true,
    dataType: "text",
    label: "Địa chỉ",
    operators: ["LIKE", "EQUALS"],
    placeholder: "Ví dụ: Quận 1",
  },
  description: {
    autoApply: true,
    dataType: "text",
    label: "Mô tả",
    operators: ["LIKE", "EQUALS"],
    placeholder: "Nhập mô tả",
  },
  historyInformation: {
    autoApply: true,
    dataType: "text",
    label: "Lịch sử",
    operators: ["LIKE", "EQUALS"],
    placeholder: "Nhập lịch sử",
  },
  point: {
    autoApply: false,
    dataType: "number",
    label: "Điểm",
    operators: [
      "GREATER_THAN_OR_EQUAL",
      "GREATER_THAN",
      "EQUALS",
      "LESS_THAN",
      "LESS_THAN_OR_EQUAL",
    ],
    placeholder: "Ví dụ: 10",
  },
  checkInRadius: {
    autoApply: false,
    dataType: "number",
    label: "Bán kính check-in",
    operators: [
      "GREATER_THAN_OR_EQUAL",
      "GREATER_THAN",
      "EQUALS",
      "LESS_THAN",
      "LESS_THAN_OR_EQUAL",
    ],
    placeholder: "Ví dụ: 50",
  },
  createdAt: {
    autoApply: false,
    dataType: "datetime",
    label: "Ngày tạo",
    operators: [
      "GREATER_THAN",
      "GREATER_THAN_OR_EQUAL",
      "EQUALS",
      "LESS_THAN",
      "LESS_THAN_OR_EQUAL",
    ],
    placeholder: "YYYY-MM-DDTHH:mm",
  },
  "createdBy.username": {
    autoApply: true,
    dataType: "text",
    label: "Người tạo",
    operators: ["LIKE", "EQUALS"],
    placeholder: "Ví dụ: admin",
  },
};

export const hotspotSearchFieldOrder = Object.keys(
  hotspotSearchFieldConfigs,
) as HotspotSearchField[];
export const hotspotSearchSortOptions: {
  label: string;
  value: HotspotSearchSortBy;
}[] = [
  { label: "Mới nhất", value: "createdAt" },
  { label: "Tên hotspot", value: "hotspotName" },
  { label: "XP", value: "xp" },
  { label: "Điểm", value: "point" },
  { label: "Bán kính", value: "checkInRadius" },
];

export function normalizeHotspotSearchText(value: string) {
  return value
    .replace(/[Đđ]/g, (match) => (match === "Đ" ? "D" : "d"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function createHotspotAdvancedFilterDraft(
  overrides: Partial<Omit<HotspotAdvancedFilterDraft, "id">> = {},
): HotspotAdvancedFilterDraft {
  const field = overrides.field ?? "tags.tagName";

  return {
    field,
    id: `hotspot-filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    operator: overrides.operator ?? getDefaultOperatorForField(field),
    rawValue: overrides.rawValue ?? "",
  };
}

export function getDefaultOperatorForField(
  field: HotspotSearchField,
): HotspotSearchOperator {
  return hotspotSearchFieldConfigs[field].operators[0];
}

export function getFieldLabel(field: HotspotSearchField) {
  return hotspotSearchFieldConfigs[field].label;
}

export function getFieldPlaceholder(field: HotspotSearchField) {
  return hotspotSearchFieldConfigs[field].placeholder;
}

export function getFieldOperators(field: HotspotSearchField) {
  return hotspotSearchFieldConfigs[field].operators;
}

export function isAutoApplyField(field: HotspotSearchField) {
  return hotspotSearchFieldConfigs[field].autoApply;
}

function parseNumberValue(rawValue: string) {
  const parsedValue = Number(rawValue.trim());

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseDateTimeValue(rawValue: string) {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmedValue)) {
    return `${trimmedValue}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return null;
}

function parseFilterValue(
  field: HotspotSearchField,
  rawValue: string,
): number | string | null {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return null;
  }

  const config = hotspotSearchFieldConfigs[field];

  if (config.dataType === "number") {
    return parseNumberValue(trimmedValue);
  }

  if (config.dataType === "datetime") {
    return parseDateTimeValue(trimmedValue);
  }

  return field === "status" ? trimmedValue.toUpperCase() : trimmedValue;
}

export function buildFilterFromDraft(
  draft: HotspotAdvancedFilterDraft,
): HotspotSearchFilterPayload | null {
  const parsedValue = parseFilterValue(draft.field, draft.rawValue);

  if (parsedValue === null) {
    return null;
  }

  return {
    field: draft.field,
    operator: draft.operator,
    value: parsedValue,
  };
}

export function buildFiltersFromDrafts(
  drafts: HotspotAdvancedFilterDraft[],
): HotspotSearchFilterPayload[] {
  return drafts.map(buildFilterFromDraft).filter((filter) => filter !== null);
}

export function buildBaseStatusFilter(): HotspotSearchFilterPayload {
  return {
    field: "status",
    operator: "IN",
    values: [...hotspotSearchBaseStatusValues],
  };
}

export function buildQuickSearchDescriptor(
  keyword: string,
): HotspotQuickSearchDescriptor | null {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    return null;
  }

  return {
    field: "hotspotName",
    filter: {
      field: "hotspotName",
      operator: "LIKE",
      value: trimmedKeyword,
    },
    label: "Tên hotspot / địa chỉ",
    term: trimmedKeyword,
  };
}

export function buildQuickSearchFilter(keyword: string) {
  return buildQuickSearchDescriptor(keyword)?.filter ?? null;
}

export function buildHotspotSearchPayload({
  advancedFilters,
  keyword,
  page,
  size = hotspotSearchPageSize,
  sortBy = defaultHotspotSearchSortBy,
  sortDirection = defaultHotspotSearchSortDirection,
}: {
  advancedFilters: HotspotSearchFilterPayload[];
  keyword: string;
  page: number;
  size?: number;
  sortBy?: HotspotSearchSortBy;
  sortDirection?: HotspotSearchSortDirection;
}): SearchHotspotsPayload {
  const quickSearchFilter = buildQuickSearchFilter(keyword);

  return {
    filters: [
      buildBaseStatusFilter(),
      ...(quickSearchFilter ? [quickSearchFilter] : []),
      ...advancedFilters,
    ],
    page,
    size,
    sortBy,
    sortDirection,
  };
}

export function filterHotspotsByKeywordLocally(
  hotspots: NearbyHotspotDto[],
  keyword: string,
) {
  const normalizedKeyword = normalizeHotspotSearchText(keyword);

  if (!normalizedKeyword) {
    return hotspots;
  }

  return hotspots.filter((hotspot) =>
    [hotspot.hotspotName, hotspot.address].some((candidateValue) =>
      normalizeHotspotSearchText(candidateValue).includes(normalizedKeyword),
    ),
  );
}

function getComparableNumericValue(
  hotspot: NearbyHotspotDto,
  field: HotspotSearchField,
) {
  switch (field) {
    case "xp":
      return hotspot.xp;
    case "point":
      return hotspot.point;
    case "checkInRadius":
      return null;
    default:
      return null;
  }
}

function getComparableDateValue(
  hotspot: NearbyHotspotDto,
  field: HotspotSearchField,
) {
  if (field !== "createdAt") {
    return null;
  }

  const parsedDate = Date.parse(hotspot.createdAt);

  return Number.isFinite(parsedDate) ? parsedDate : null;
}

function getComparableTextValues(
  hotspot: NearbyHotspotDto,
  field: HotspotSearchField,
) {
  switch (field) {
    case "hotspotName":
      return [hotspot.hotspotName];
    case "status":
      return [hotspot.status];
    case "tags.tagName":
      return hotspot.tags.map((tag) => tag.tagName);
    case "address":
      return [hotspot.address];
    case "description":
      return [hotspot.description];
    case "historyInformation":
      return [hotspot.historyInformation];
    case "createdBy.username":
      return [];
    default:
      return [];
  }
}

function matchesTextFilter(
  candidateValues: string[],
  filter: HotspotSearchFilterPayload,
) {
  const normalizedFilterValue = normalizeHotspotSearchText(String(filter.value ?? ""));

  if (!normalizedFilterValue) {
    return true;
  }

  if (filter.operator === "NOT_EQUALS") {
    return candidateValues.every(
      (candidateValue) =>
        normalizeHotspotSearchText(candidateValue) !== normalizedFilterValue,
    );
  }

  return candidateValues.some((candidateValue) => {
    const normalizedCandidate = normalizeHotspotSearchText(candidateValue);

    if (filter.operator === "LIKE") {
      return normalizedCandidate.includes(normalizedFilterValue);
    }

    return normalizedCandidate === normalizedFilterValue;
  });
}

function matchesNumericFilter(
  candidateValue: number | null,
  filter: HotspotSearchFilterPayload,
) {
  if (candidateValue === null || typeof filter.value !== "number") {
    return false;
  }

  switch (filter.operator) {
    case "GREATER_THAN":
      return candidateValue > filter.value;
    case "GREATER_THAN_OR_EQUAL":
      return candidateValue >= filter.value;
    case "LESS_THAN":
      return candidateValue < filter.value;
    case "LESS_THAN_OR_EQUAL":
      return candidateValue <= filter.value;
    case "EQUALS":
      return candidateValue === filter.value;
    default:
      return false;
  }
}

function matchesDateFilter(
  candidateValue: number | null,
  filter: HotspotSearchFilterPayload,
) {
  if (candidateValue === null || typeof filter.value !== "string") {
    return false;
  }

  const parsedFilterValue = Date.parse(filter.value);

  if (!Number.isFinite(parsedFilterValue)) {
    return false;
  }

  switch (filter.operator) {
    case "GREATER_THAN":
      return candidateValue > parsedFilterValue;
    case "GREATER_THAN_OR_EQUAL":
      return candidateValue >= parsedFilterValue;
    case "LESS_THAN":
      return candidateValue < parsedFilterValue;
    case "LESS_THAN_OR_EQUAL":
      return candidateValue <= parsedFilterValue;
    case "EQUALS":
      return candidateValue === parsedFilterValue;
    default:
      return false;
  }
}

function matchesInFilter(
  hotspot: NearbyHotspotDto,
  filter: HotspotSearchFilterPayload,
) {
  if (filter.field !== "status" || !filter.values || filter.values.length === 0) {
    return true;
  }

  const normalizedStatus = normalizeHotspotSearchText(hotspot.status);

  return filter.values.some(
    (value) => normalizeHotspotSearchText(String(value)) === normalizedStatus,
  );
}

export function matchesHotspotFilterLocally(
  hotspot: NearbyHotspotDto,
  filter: HotspotSearchFilterPayload,
) {
  if (filter.operator === "IN") {
    return matchesInFilter(hotspot, filter);
  }

  const fieldConfig = hotspotSearchFieldConfigs[filter.field as HotspotSearchField];

  if (!fieldConfig) {
    return true;
  }

  if (fieldConfig.dataType === "number") {
    return matchesNumericFilter(
      getComparableNumericValue(hotspot, filter.field as HotspotSearchField),
      filter,
    );
  }

  if (fieldConfig.dataType === "datetime") {
    return matchesDateFilter(
      getComparableDateValue(hotspot, filter.field as HotspotSearchField),
      filter,
    );
  }

  return matchesTextFilter(
    getComparableTextValues(hotspot, filter.field as HotspotSearchField),
    filter,
  );
}

export function filterHotspotsLocally(
  hotspots: NearbyHotspotDto[],
  filters: HotspotSearchFilterPayload[],
) {
  return hotspots.filter((hotspot) =>
    filters.every((filter) => matchesHotspotFilterLocally(hotspot, filter)),
  );
}

function compareNullableNumbers(
  leftValue: number | null,
  rightValue: number | null,
  sortDirection: HotspotSearchSortDirection,
) {
  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  return sortDirection === "ASC" ? leftValue - rightValue : rightValue - leftValue;
}

export function sortHotspotsLocally(
  hotspots: NearbyHotspotDto[],
  sortBy: HotspotSearchSortBy,
  sortDirection: HotspotSearchSortDirection,
) {
  return [...hotspots].sort((left, right) => {
    if (sortBy === "hotspotName") {
      const comparedResult = normalizeHotspotSearchText(left.hotspotName).localeCompare(
        normalizeHotspotSearchText(right.hotspotName),
        "vi",
      );

      return sortDirection === "ASC" ? comparedResult : -comparedResult;
    }

    if (sortBy === "createdAt") {
      return compareNullableNumbers(
        getComparableDateValue(left, "createdAt"),
        getComparableDateValue(right, "createdAt"),
        sortDirection,
      );
    }

    return compareNullableNumbers(
      getComparableNumericValue(left, sortBy),
      getComparableNumericValue(right, sortBy),
      sortDirection,
    );
  });
}

export function paginateHotspotsLocally(
  hotspots: NearbyHotspotDto[],
  currentPage: number,
  pageSize: number,
) {
  const startIndex = Math.max(0, (currentPage - 1) * pageSize);

  return hotspots.slice(startIndex, startIndex + pageSize);
}

export function getTotalPagesFromCount(totalCount: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function formatHotspotFilterChipLabel(filter: HotspotSearchFilterPayload) {
  const fieldLabel =
    filter.field in hotspotSearchFieldConfigs
      ? hotspotSearchFieldConfigs[filter.field as HotspotSearchField].label
      : filter.field;

  if (filter.operator === "IN" && filter.values?.length) {
    return `${fieldLabel}: ${filter.values.join(", ")}`;
  }

  return `${fieldLabel}: ${String(filter.value ?? "")}`;
}
