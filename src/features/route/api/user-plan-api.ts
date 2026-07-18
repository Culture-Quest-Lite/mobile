import { PublicEnv, buildApiUrl } from "@/constants/env";

export type PlanStatus = "DRAFT" | "READY" | "STARTED" | "COMPLETED";
export type OptimizeCriterion = "DISTANCE" | "TIME";

export type PlannerHotspot = {
  hotspotId: number;
  hotspotName: string;
  address: string;
  latitude: number;
  longitude: number;
  openingTime?: string;
  closingTime?: string;
  description?: string;
  historyInformation?: string;
  xp?: number;
  point?: number;
  estimatedDurationMin?: number;
  estimatedDurationMax?: number;
  startTime?: string;
  endTime?: string;
  status?: string;
  medias?: Array<{
    mediaId?: number;
    fileUrl?: string;
    mediaType?: string;
    mimeType?: string;
  }>;
};

export type HotspotSuggestion = {
  hotspot: PlannerHotspot;
  score: number | null;
  reason: string;
  distanceInMeters: number | null;
};

export type OptimizedStop = {
  hotspotId: number;
  index: number;
  hotspotName: string;
  latitude: number;
  longitude: number;
  distanceToNext: number | null;
  travelTimeToNext: number | null;
  travelTimeToNextText: string;
  estimatedArrivalTime: string;
  closingWarning: boolean;
};

export type UserPlan = {
  userPlanId: number;
  name: string;
  description: string;
  status: PlanStatus;
  totalStops: number;
  startLatitude: number | null;
  startLongitude: number | null;
  isOptimized: boolean;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedStops: number;
  progressPercentage: number;
  stops: Array<{
    planHotspotId: number;
    stopIndex: number;
    userNote: string | null;
    isCheckedIn: boolean;
    hotspot: PlannerHotspot;
  }>;
};

export type CreateUserPlanPayload = {
  name: string;
  description?: string;
  stops: Array<{ hotspotId: number; userNote?: string }>;
  startLatitude?: number;
  startLongitude?: number;
  isOptimized?: boolean;
};

type Auth = { accessToken: string; tokenType?: string | null };

function url(path: string) {
  return PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl(path)
    : `http://13.158.40.56:8080${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function message(body: unknown, status: number) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return `API kế hoạch lỗi ${status}.`;
}

async function request<T>(path: string, auth: Auth, init?: RequestInit): Promise<T> {
  if (!auth.accessToken.trim()) throw new Error("Bạn cần đăng nhập để sử dụng kế hoạch cá nhân.");
  const response = await fetch(url(path), {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `${auth.tokenType || "Bearer"} ${auth.accessToken}`,
      "Content-Type": "application/json",
      "X-Client-Type": "mobile",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) throw new Error(message(body, response.status));
  return (isObject(body) && "data" in body ? body.data : body) as T;
}

export function suggestPlansByDescription(auth: Auth, payload: {
  description: string;
  latitude?: number;
  longitude?: number;
  anchorHotspotIds?: number[];
  radiusInMeters?: number;
  limit?: number;
}) {
  return request<HotspotSuggestion[]>("/api/v1/custom-plans/suggest-by-description", auth, {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function suggestNearbyPlans(auth: Auth, payload: {
  anchorHotspotIds: number[];
  radiusInMeters?: number;
  limit?: number;
}) {
  return request<HotspotSuggestion[]>("/api/v1/custom-plans/suggest-nearby", auth, {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function optimizeUserPlan(auth: Auth, payload: {
  hotspotIds: number[];
  startLatitude?: number;
  startLongitude?: number;
  criterion: OptimizeCriterion;
  startTime?: string;
}) {
  return request<{
    stops: OptimizedStop[];
    totalDistance: number;
    totalEstimatedTime: number;
    totalEstimatedTimeText: string;
    criterion: OptimizeCriterion;
    usedFallback: boolean;
  }>("/api/v1/custom-plans/optimize", auth, { method: "POST", body: JSON.stringify(payload) });
}

export function createUserPlan(auth: Auth, payload: CreateUserPlanPayload) {
  return request<UserPlan>("/api/v1/custom-plans", auth, { method: "POST", body: JSON.stringify(payload) });
}

export function updateUserPlan(auth: Auth, planId: number, payload: CreateUserPlanPayload) {
  return request<UserPlan>(`/api/v1/custom-plans/${planId}`, auth, { method: "PUT", body: JSON.stringify(payload) });
}

export function getUserPlan(auth: Auth, planId: number) {
  return request<UserPlan>(`/api/v1/custom-plans/${planId}`, auth);
}

export function getMyUserPlans(auth: Auth) {
  return request<UserPlan[]>("/api/v1/custom-plans", auth);
}

export function startUserPlan(auth: Auth, planId: number) {
  return request<UserPlan>(`/api/v1/custom-plans/${planId}/start`, auth, { method: "POST" });
}
