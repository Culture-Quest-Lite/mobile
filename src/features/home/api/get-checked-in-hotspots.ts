import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetCheckedInHotspotsRequest = {
  accessToken: string;
  tokenType?: string | null;
};

type UserHotspotProgressQueryStyle = "flat" | "nested" | "none";
type RouteProgressQueryStyle = "flat" | "nested" | "none";

type UserHotspotProgressSummary = {
  hotspotId: number;
  isCheckedIn: boolean;
};

type UserHotspotProgressPage = {
  items: UserHotspotProgressSummary[];
  totalPages: number | null;
};

type UserRouteProgressSummary = {
  userRouteProgressId: number;
};

type UserRouteProgressPage = {
  items: UserRouteProgressSummary[];
  totalPages: number | null;
};

const routeProgressPageSize = 100;
const userHotspotProgressPageSize = 100;

function resolveUserHotspotProgressUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/v1/user-hotspot-progress");
  }

  return "https://api.culturequestlite.com/api/v1/user-hotspot-progress";
}

function resolveUserRouteProgressUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/v1/user-route-progress");
  }

  return "http://13.158.40.56:8080/api/v1/user-route-progress";
}

function resolveUserRouteProgressDetailUrl(userRouteProgressId: number) {
  const baseUrl = resolveUserRouteProgressUrl();
  return `${baseUrl}/${userRouteProgressId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return null;
}

function unwrapApiBody(body: unknown): unknown {
  if (!isObject(body)) {
    return body;
  }

  for (const key of ["data", "result", "payload", "response"]) {
    const candidate = body[key];

    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }

  return body;
}

function readPageItems(body: unknown): unknown[] {
  const unwrappedBody = unwrapApiBody(body);

  if (Array.isArray(unwrappedBody)) {
    return unwrappedBody;
  }

  if (!isObject(unwrappedBody)) {
    return [];
  }

  for (const key of ["content", "items", "data", "result", "records"]) {
    const candidate = unwrappedBody[key];

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function readRouteProgressSummary(
  value: unknown,
): UserRouteProgressSummary | null {
  if (!isObject(value)) {
    return null;
  }

  const userRouteProgressId = readNumber(
    value.userRouteProgressId ?? value.routeParticipantId ?? value.id,
  );

  if (userRouteProgressId === null) {
    return null;
  }

  return {
    userRouteProgressId,
  };
}

function readUserHotspotProgressSummary(
  value: unknown,
): UserHotspotProgressSummary | null {
  if (!isObject(value)) {
    return null;
  }

  const hotspotId = readNumber(value.hotspotId);
  const isCheckedIn = readBoolean(
    value.isCheckedIn ?? value.isCheckIn ?? value.checkedIn,
  );

  if (hotspotId === null || isCheckedIn === null) {
    return null;
  }

  return {
    hotspotId,
    isCheckedIn,
  };
}

function parseUserHotspotProgressPage(
  value: unknown,
): UserHotspotProgressPage | null {
  const unwrappedValue = unwrapApiBody(value);
  const standaloneItem = readUserHotspotProgressSummary(unwrappedValue);

  if (standaloneItem) {
    return {
      items: [standaloneItem],
      totalPages: 1,
    };
  }

  const pageItems = readPageItems(unwrappedValue);

  if (pageItems.length > 0) {
    const items = pageItems
      .map(readUserHotspotProgressSummary)
      .filter((item): item is UserHotspotProgressSummary => item !== null);
    const totalPages = isObject(unwrappedValue)
      ? (isObject(unwrappedValue.page)
          ? readNumber(unwrappedValue.page.totalPages)
          : readNumber(unwrappedValue.totalPages)) ?? 1
      : 1;

    return {
      items,
      totalPages,
    };
  }

  if (!isObject(unwrappedValue) || !Array.isArray(unwrappedValue.content)) {
    return null;
  }

  const items = unwrappedValue.content
    .map(readUserHotspotProgressSummary)
    .filter((item): item is UserHotspotProgressSummary => item !== null);
  const totalPages = isObject(unwrappedValue.page)
    ? readNumber(unwrappedValue.page.totalPages)
    : null;

  return {
    items,
    totalPages,
  };
}

function parseRouteProgressPage(value: unknown): UserRouteProgressPage | null {
  const unwrappedValue = unwrapApiBody(value);

  if (!isObject(unwrappedValue) || !Array.isArray(unwrappedValue.content)) {
    return null;
  }

  const items = unwrappedValue.content.map(readRouteProgressSummary);

  if (items.some((item) => item === null)) {
    return null;
  }

  const totalPages = isObject(unwrappedValue.page)
    ? readNumber(unwrappedValue.page.totalPages)
    : null;

  return {
    items: items.filter((item): item is UserRouteProgressSummary => item !== null),
    totalPages,
  };
}

function parseCheckedInHotspotIds(value: unknown) {
  const unwrappedValue = unwrapApiBody(value);

  if (!isObject(unwrappedValue) || !Array.isArray(unwrappedValue.hotspotProgressList)) {
    return null;
  }

  const checkedInHotspotIds: number[] = [];

  for (const item of unwrappedValue.hotspotProgressList) {
    if (!isObject(item)) {
      return null;
    }

    const hotspotId = readNumber(item.hotspotId);
    const isCheckedIn = readBoolean(
      item.isCheckedIn ?? item.isCheckIn ?? item.checkedIn,
    );

    if (hotspotId === null || isCheckedIn === null) {
      return null;
    }

    if (isCheckedIn) {
      checkedInHotspotIds.push(hotspotId);
    }
  }

  return checkedInHotspotIds;
}

async function parseResponseBody(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

function getErrorMessage(body: unknown, fallbackMessage: string, status: number) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const candidate = body[key];

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
  }

  return `${fallbackMessage} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ đồng bộ check-in.";
}

function buildUserHotspotProgressPageUrl({
  baseUrl,
  page,
  style,
}: {
  baseUrl: string;
  page: number;
  style: UserHotspotProgressQueryStyle;
}) {
  if (style === "none") {
    return baseUrl;
  }

  if (style === "nested") {
    return `${baseUrl}?filter.page=${page}&filter.size=${userHotspotProgressPageSize}`;
  }

  return `${baseUrl}?page=${page}&size=${userHotspotProgressPageSize}`;
}

function buildRouteProgressPageUrl({
  baseUrl,
  page,
  style,
}: {
  baseUrl: string;
  page: number;
  style: RouteProgressQueryStyle;
}) {
  if (style === "none") {
    return baseUrl;
  }

  if (style === "nested") {
    return `${baseUrl}?filter.page=${page}&filter.size=${routeProgressPageSize}`;
  }

  return `${baseUrl}?page=${page}&size=${routeProgressPageSize}`;
}

async function fetchJson({
  accessToken,
  tokenType,
  url,
}: {
  accessToken: string;
  tokenType?: string | null;
  url: string;
}) {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch {
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  return {
    body: responseBody,
    ok: response.ok,
    status: response.status,
  };
}

async function fetchUserHotspotProgressPage({
  accessToken,
  page,
  queryStyle,
  tokenType,
}: {
  accessToken: string;
  page: number;
  queryStyle: UserHotspotProgressQueryStyle;
  tokenType?: string | null;
}) {
  const url = buildUserHotspotProgressPageUrl({
    baseUrl: resolveUserHotspotProgressUrl(),
    page,
    style: queryStyle,
  });
  const response = await fetchJson({
    accessToken,
    tokenType,
    url,
  });

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        response.body,
        "Không thể tải tiến độ check-in hotspot",
        response.status,
      ),
    );
  }

  const parsedPage = parseUserHotspotProgressPage(response.body);

  if (!parsedPage) {
    throw new Error(
      "API user-hotspot-progress trả về dữ liệu không đúng định dạng.",
    );
  }

  return parsedPage;
}

async function fetchRouteProgressPage({
  accessToken,
  page,
  queryStyle,
  tokenType,
}: {
  accessToken: string;
  page: number;
  queryStyle: RouteProgressQueryStyle;
  tokenType?: string | null;
}) {
  const url = buildRouteProgressPageUrl({
    baseUrl: resolveUserRouteProgressUrl(),
    page,
    style: queryStyle,
  });
  const response = await fetchJson({
    accessToken,
    tokenType,
    url,
  });

  if (!response.ok) {
    throw new Error(
      getErrorMessage(response.body, "Không thể tải tiến độ tuyến", response.status),
    );
  }

  const parsedPage = parseRouteProgressPage(response.body);

  if (!parsedPage) {
    throw new Error("API tiến độ tuyến trả về dữ liệu không đúng định dạng.");
  }

  return parsedPage;
}

async function resolveWorkingUserHotspotProgressQueryStyle({
  accessToken,
  tokenType,
}: GetCheckedInHotspotsRequest) {
  const queryStyles: UserHotspotProgressQueryStyle[] = [
    "flat",
    "nested",
    "none",
  ];
  let lastQueryError: Error | null = null;

  for (const queryStyle of queryStyles) {
    const url = buildUserHotspotProgressPageUrl({
      baseUrl: resolveUserHotspotProgressUrl(),
      page: 0,
      style: queryStyle,
    });
    const response = await fetchJson({
      accessToken,
      tokenType,
      url,
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 404 || response.status === 405) {
        lastQueryError = new Error(
          getErrorMessage(
            response.body,
            "Yêu cầu tiến độ check-in hotspot không hợp lệ",
            response.status,
          ),
        );
        continue;
      }

      throw new Error(
        getErrorMessage(
          response.body,
          "Không thể tải tiến độ check-in hotspot",
          response.status,
        ),
      );
    }

    const parsedPage = parseUserHotspotProgressPage(response.body);

    if (!parsedPage) {
      lastQueryError = new Error(
        "API user-hotspot-progress trả về dữ liệu không đúng định dạng.",
      );
      continue;
    }

    return {
      firstPage: parsedPage,
      queryStyle,
    };
  }

  throw (
    lastQueryError ??
    new Error("Không xác định được cách gọi API user-hotspot-progress.")
  );
}

async function resolveWorkingRouteProgressQueryStyle({
  accessToken,
  tokenType,
}: GetCheckedInHotspotsRequest) {
  const queryStyles: RouteProgressQueryStyle[] = ["flat", "nested", "none"];
  let lastQueryError: Error | null = null;

  for (const queryStyle of queryStyles) {
    const url = buildRouteProgressPageUrl({
      baseUrl: resolveUserRouteProgressUrl(),
      page: 0,
      style: queryStyle,
    });
    const response = await fetchJson({
      accessToken,
      tokenType,
      url,
    });

    if (!response.ok) {
      if (response.status === 400) {
        lastQueryError = new Error(
          getErrorMessage(response.body, "Yêu cầu tiến độ tuyến không hợp lệ", response.status),
        );
        continue;
      }

      throw new Error(
        getErrorMessage(response.body, "Không thể tải tiến độ tuyến", response.status),
      );
    }

    const parsedPage = parseRouteProgressPage(response.body);

    if (!parsedPage) {
      lastQueryError = new Error(
        "API tiến độ tuyến trả về dữ liệu không đúng định dạng.",
      );
      continue;
    }

    return {
      firstPage: parsedPage,
      queryStyle,
    };
  }

  throw lastQueryError ?? new Error("Không xác định được cách gọi API tiến độ tuyến.");
}

async function fetchCheckedInHotspotIdsByRouteProgressId({
  accessToken,
  tokenType,
  userRouteProgressId,
}: {
  accessToken: string;
  tokenType?: string | null;
  userRouteProgressId: number;
}) {
  const response = await fetchJson({
    accessToken,
    tokenType,
    url: resolveUserRouteProgressDetailUrl(userRouteProgressId),
  });

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        response.body,
        `Không thể tải chi tiết tiến độ tuyến #${userRouteProgressId}`,
        response.status,
      ),
    );
  }

  const checkedInHotspotIds = parseCheckedInHotspotIds(response.body);

  if (!checkedInHotspotIds) {
    throw new Error("API chi tiết tiến độ tuyến trả về dữ liệu không đúng định dạng.");
  }

  return checkedInHotspotIds;
}

async function getCheckedInHotspotIdsFromUserHotspotProgress({
  accessToken,
  tokenType,
}: GetCheckedInHotspotsRequest) {
  const { firstPage, queryStyle } = await resolveWorkingUserHotspotProgressQueryStyle({
    accessToken,
    tokenType,
  });
  const hotspotProgressSummaries = [...firstPage.items];

  if (queryStyle !== "none") {
    let currentPage = 1;
    const totalPages = firstPage.totalPages ?? 1;

    while (currentPage < totalPages) {
      const nextPage = await fetchUserHotspotProgressPage({
        accessToken,
        page: currentPage,
        queryStyle,
        tokenType,
      });

      hotspotProgressSummaries.push(...nextPage.items);
      currentPage += 1;
    }
  }

  return Array.from(
    new Set(
      hotspotProgressSummaries
        .filter((item) => item.isCheckedIn)
        .map((item) => item.hotspotId),
    ),
  );
}

async function getCheckedInHotspotIdsFromRouteProgress({
  accessToken,
  tokenType,
}: GetCheckedInHotspotsRequest): Promise<number[]> {
  const { firstPage, queryStyle } = await resolveWorkingRouteProgressQueryStyle({
    accessToken,
    tokenType,
  });
  const routeProgressSummaries = [...firstPage.items];

  if (queryStyle !== "none") {
    let currentPage = 1;
    const totalPages = firstPage.totalPages ?? 1;

    while (currentPage < totalPages) {
      const nextPage = await fetchRouteProgressPage({
        accessToken,
        page: currentPage,
        queryStyle,
        tokenType,
      });

      routeProgressSummaries.push(...nextPage.items);
      currentPage += 1;
    }
  }

  const checkedInHotspotIds = new Set<number>();

  for (const routeProgressSummary of routeProgressSummaries) {
    const nextCheckedInHotspotIds =
      await fetchCheckedInHotspotIdsByRouteProgressId({
        accessToken,
        tokenType,
        userRouteProgressId: routeProgressSummary.userRouteProgressId,
      });

    for (const hotspotId of nextCheckedInHotspotIds) {
      checkedInHotspotIds.add(hotspotId);
    }
  }

  return Array.from(checkedInHotspotIds);
}

export async function getCheckedInHotspotIds({
  accessToken,
  tokenType,
}: GetCheckedInHotspotsRequest): Promise<number[]> {
  try {
    return await getCheckedInHotspotIdsFromUserHotspotProgress({
      accessToken,
      tokenType,
    });
  } catch (error) {
    console.info("[checkin-sync] user-hotspot-progress sync failed, fallback route-progress", {
      error: error instanceof Error ? error.message : error,
    });
  }

  return getCheckedInHotspotIdsFromRouteProgress({
    accessToken,
    tokenType,
  });
}
