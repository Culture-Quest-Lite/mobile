import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetCheckedInHotspotsRequest = {
  accessToken: string;
  tokenType?: string | null;
};

type RouteProgressQueryStyle = "flat" | "nested" | "none";

type UserRouteProgressSummary = {
  userRouteProgressId: number;
};

type UserRouteProgressPage = {
  items: UserRouteProgressSummary[];
  totalPages: number | null;
};

const routeProgressPageSize = 100;

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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readRouteProgressSummary(
  value: unknown,
): UserRouteProgressSummary | null {
  if (!isObject(value)) {
    return null;
  }

  const userRouteProgressId = readNumber(value.userRouteProgressId);

  if (userRouteProgressId === null) {
    return null;
  }

  return {
    userRouteProgressId,
  };
}

function parseRouteProgressPage(value: unknown): UserRouteProgressPage | null {
  if (!isObject(value) || !Array.isArray(value.content)) {
    return null;
  }

  const items = value.content.map(readRouteProgressSummary);

  if (items.some((item) => item === null)) {
    return null;
  }

  const totalPages = isObject(value.page)
    ? readNumber(value.page.totalPages)
    : null;

  return {
    items: items.filter((item): item is UserRouteProgressSummary => item !== null),
    totalPages,
  };
}

function parseCheckedInHotspotIds(value: unknown) {
  if (!isObject(value) || !Array.isArray(value.hotspotProgressList)) {
    return null;
  }

  const checkedInHotspotIds: number[] = [];

  for (const item of value.hotspotProgressList) {
    if (!isObject(item)) {
      return null;
    }

    const hotspotId = readNumber(item.hotspotId);
    const isCheckedIn = readBoolean(item.isCheckedIn);

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

export async function getCheckedInHotspotIds({
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
