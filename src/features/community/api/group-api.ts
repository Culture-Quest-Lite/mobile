import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type CommunityGroupPayload = {
  createdAt: string | null;
  createdBy: string | null;
  groupId: string | null;
  groupName: string | null;
  imageUrl: string | null;
  inviteLink: string | null;
  leaderId: string | null;
  requiredApproval: boolean | null;
  shareToken: string;
  status: string | null;
  totalMembers: number | null;
  updatedAt: string | null;
};

export type CommunityGroupMemberPayload = {
  action: string | null;
  createdAt: string | null;
  groupId: string | null;
  groupParticipantId: string | null;
  role: string | null;
  status: string | null;
  updatedAt: string | null;
  userId: string | null;
};

type AuthenticatedGroupRequest = {
  accessToken: string;
  tokenType?: string | null;
};

export type CommunityGroupImageFile = {
  mimeType?: string | null;
  name?: string | null;
  uri: string;
};

export type CreateCommunityGroupRequest = AuthenticatedGroupRequest & {
  groupName: string;
  userIds?: (number | string)[];
  imageFile?: CommunityGroupImageFile | null;
};

export type JoinCommunityGroupRequest = AuthenticatedGroupRequest & {
  shareToken: string;
};

export type GetCommunityGroupsRequest = Partial<AuthenticatedGroupRequest>;

export type GetCommunityGroupByIdRequest =
  Partial<AuthenticatedGroupRequest> & {
    groupId: string;
  };

export type GetCommunityGroupMembersRequest =
  Partial<AuthenticatedGroupRequest> & {
    action?: string | null;
    groupId: string;
  };

export type UpdateCommunityGroupRequest = AuthenticatedGroupRequest & {
  groupId: string;
  groupName: string;
  imageFile?: CommunityGroupImageFile | null;
  requiredApproval: boolean;
};

export type RefreshCommunityGroupTokenRequest = AuthenticatedGroupRequest & {
  groupId: string;
};

export type LeaveCommunityGroupRequest = AuthenticatedGroupRequest & {
  groupId: string;
};

export type DeleteCommunityGroupRequest = AuthenticatedGroupRequest & {
  groupId: string;
};

export type KickCommunityGroupMemberRequest = AuthenticatedGroupRequest & {
  groupId: string;
  userId: string;
};

export type UpdateCommunityGroupParticipantRequest =
  AuthenticatedGroupRequest & {
    action: "DENIED" | "JOIN";
    participantId: string;
  };

function resolveGroupUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMeaningfulText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeActionValue(value: unknown) {
  return readMeaningfulText(value)?.toUpperCase() ?? null;
}

function readIdentifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.trunc(value)}`;
  }

  return readMeaningfulText(value);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeCreateGroupUserIds(userIds?: (number | string)[]) {
  if (!Array.isArray(userIds)) {
    return [];
  }

  const normalizedUserIds: number[] = [];
  const seenUserIds = new Set<number>();

  for (const userId of userIds) {
    const parsedUserId =
      typeof userId === "number" && Number.isSafeInteger(userId) && userId > 0
        ? Math.trunc(userId)
        : typeof userId === "string" && /^\d+$/.test(userId.trim())
          ? Number(userId.trim())
          : null;

    if (
      parsedUserId === null ||
      !Number.isSafeInteger(parsedUserId) ||
      parsedUserId <= 0 ||
      seenUserIds.has(parsedUserId)
    ) {
      continue;
    }

    seenUserIds.add(parsedUserId);
    normalizedUserIds.push(parsedUserId);
  }

  return normalizedUserIds;
}

const imageMimeTypeByExtension: Record<string, string> = {
  gif: "image/gif",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// RN gui multipart tu object { uri, name, type }; Blob/expo File khong dung duoc
// vi FormData cua RN spread object nen mat cac getter tren prototype.
function buildImageFilePart(imageFile?: CommunityGroupImageFile | null) {
  const uri = readMeaningfulText(imageFile?.uri);

  if (
    !uri ||
    !(
      uri.startsWith("file:") ||
      uri.startsWith("content:") ||
      uri.startsWith("/")
    )
  ) {
    return null;
  }

  const extension =
    uri.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() ?? "";
  const name =
    readMeaningfulText(imageFile?.name) ??
    `group-image.${extension in imageMimeTypeByExtension ? extension : "jpg"}`;
  const type =
    readMeaningfulText(imageFile?.mimeType) ??
    imageMimeTypeByExtension[extension] ??
    "image/jpeg";

  return { name, type, uri };
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

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android dang chan ket noi HTTP toi Group API. Hay dung HTTPS hoac rebuild Android dev client sau khi bat cleartext traffic.";
  }

  return "Khong the ket noi den may chu nhom.";
}

function getDefaultErrorMessage(body: unknown, status: number) {
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
    return "Ban can dang nhap de thuc hien thao tac nay.";
  }

  return `Khong the xu ly nhom (HTTP ${status}).`;
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getJoinGroupErrorMessage(body: unknown, status: number) {
  const fallbackMessage = getDefaultErrorMessage(body, status);
  const normalizedMessage = normalizeLookupText(fallbackMessage);

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("da tham gia") ||
    normalizedMessage.includes("joined")
  ) {
    return "Ban da tham gia nhom.";
  }

  if (
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("het han")
  ) {
    return "Link da het han.";
  }

  if (
    normalizedMessage.includes("invalid") ||
    normalizedMessage.includes("khong hop le") ||
    normalizedMessage.includes("not found")
  ) {
    return "Link khong hop le.";
  }

  if (status === 404) {
    return "Link khong hop le.";
  }

  if (status === 410) {
    return "Link da het han.";
  }

  return fallbackMessage;
}

function readShareTokenFromInviteLink(inviteLink?: string | null) {
  const normalizedInviteLink = readMeaningfulText(inviteLink);

  if (!normalizedInviteLink) {
    return null;
  }

  const matchedToken = normalizedInviteLink.match(/\/join\/([^/?#]+)/i);
  return matchedToken?.[1]?.trim() || null;
}

function parseCommunityGroupPayload(
  body: unknown,
  fallbackShareToken?: string | null,
): CommunityGroupPayload {
  const parsedInviteLink = isObject(body)
    ? readMeaningfulText(body.inviteLink)
    : null;
  const parsedShareToken =
    (isObject(body) ? readMeaningfulText(body.shareToken) : null) ??
    readShareTokenFromInviteLink(parsedInviteLink) ??
    readMeaningfulText(fallbackShareToken);

  if (!parsedShareToken) {
    throw new Error("Backend khong tra ve shareToken hop le cho nhom.");
  }

  return {
    createdAt: isObject(body) ? readMeaningfulText(body.createdAt) : null,
    createdBy: isObject(body) ? readIdentifier(body.createdBy) : null,
    groupId: isObject(body) ? readIdentifier(body.groupId) : null,
    groupName: isObject(body) ? readMeaningfulText(body.groupName) : null,
    imageUrl: isObject(body) ? readMeaningfulText(body.imageUrl) : null,
    inviteLink: parsedInviteLink,
    leaderId: isObject(body)
      ? (readIdentifier(body.leaderId) ?? readIdentifier(body.createdBy))
      : null,
    requiredApproval: isObject(body)
      ? readBoolean(body.requiredApproval)
      : null,
    shareToken: parsedShareToken,
    status: isObject(body) ? readMeaningfulText(body.status) : null,
    totalMembers: isObject(body) ? readNumber(body.totalMembers) : null,
    updatedAt: isObject(body) ? readMeaningfulText(body.updatedAt) : null,
  };
}

function parseCommunityGroupCollection(body: unknown) {
  const rawGroups = Array.isArray(body)
    ? body
    : isObject(body) && Array.isArray(body.content)
      ? body.content
      : null;

  if (!rawGroups) {
    throw new Error("Backend tra ve danh sach nhom khong hop le.");
  }

  return rawGroups.flatMap((entry) => {
    try {
      return [parseCommunityGroupPayload(entry)];
    } catch (error) {
      console.warn("[community] skip invalid group entry", {
        entry,
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  });
}

function parseCommunityGroupMemberPayload(
  body: unknown,
): CommunityGroupMemberPayload {
  if (!isObject(body)) {
    throw new Error("Backend tra ve thong tin thanh vien khong hop le.");
  }

  return {
    action: readMeaningfulText(body.action),
    createdAt: readMeaningfulText(body.createdAt),
    groupId: readIdentifier(body.groupId),
    groupParticipantId: readIdentifier(body.groupParticipantId),
    role: readMeaningfulText(body.role),
    status: readMeaningfulText(body.status),
    updatedAt: readMeaningfulText(body.updatedAt),
    userId: readIdentifier(body.userId),
  };
}

function parseCommunityGroupMemberCollection(body: unknown) {
  const rawMembers = Array.isArray(body)
    ? body
    : isObject(body) && Array.isArray(body.content)
      ? body.content
      : null;

  if (!rawMembers) {
    throw new Error("Backend tra ve danh sach thanh vien khong hop le.");
  }

  return rawMembers.flatMap((entry) => {
    try {
      return [parseCommunityGroupMemberPayload(entry)];
    } catch (error) {
      console.warn("[community] skip invalid group member entry", {
        entry,
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  });
}

function shouldRetryCommunityGroupListRequest(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    /\bHTTP 404\b/i.test(error.message) || /\bHTTP 405\b/i.test(error.message)
  );
}

async function requestGroup(
  url: string,
  options: {
    accessToken?: string | null;
    body?: unknown;
    errorMessageFactory?: (body: unknown, status: number) => string;
    method: "DELETE" | "GET" | "POST" | "PUT";
    tokenType?: string | null;
  },
) {
  let response: Response;

  try {
    response = await fetch(url, {
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Accept: "application/json",
        "X-Client-Type": "mobile",
        ...(options.accessToken
          ? {
              Authorization: `${options.tokenType ?? "Bearer"} ${options.accessToken}`,
            }
          : null),
        ...(options.body === undefined
          ? null
          : {
              "Content-Type": "application/json",
            }),
      },
      method: options.method,
    });
  } catch (error) {
    console.warn("[community] group network failure", {
      error,
      method: options.method,
      url,
    });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[community] group request rejected", {
      body: responseBody,
      method: options.method,
      status: response.status,
      url,
    });
    throw new Error(
      options.errorMessageFactory
        ? options.errorMessageFactory(responseBody, response.status)
        : getDefaultErrorMessage(responseBody, response.status),
    );
  }

  return responseBody;
}

export async function createCommunityGroup({
  accessToken,
  groupName,
  imageFile,
  tokenType,
  userIds,
}: CreateCommunityGroupRequest) {
  const trimmedGroupName = groupName.trim();
  const normalizedUserIds = normalizeCreateGroupUserIds(userIds);

  if (!trimmedGroupName) {
    throw new Error("Hay nhap ten nhom truoc khi tao.");
  }

  const url = resolveGroupUrl("/api/v1/groups");
  // POST /api/v1/groups chi nhan multipart/form-data (GroupRequest:
  // groupName, userIds[], imageFile). Body JSON se lam backend tra 500.
  const formData = new FormData();

  formData.append("groupName", trimmedGroupName);

  for (const userId of normalizedUserIds) {
    formData.append("userIds", `${userId}`);
  }

  const imageFilePart = buildImageFilePart(imageFile);

  if (imageFilePart) {
    formData.append("imageFile", imageFilePart as unknown as Blob);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      body: formData,
      // Khong tu set Content-Type: de fetch tu sinh boundary cho multipart.
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? {
              Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
            }
          : null),
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[community] group network failure", {
      error,
      method: "POST",
      url,
    });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[community] group request rejected", {
      body: responseBody,
      method: "POST",
      status: response.status,
      url,
    });
    throw new Error(getDefaultErrorMessage(responseBody, response.status));
  }

  return parseCommunityGroupPayload(responseBody);
}

export async function joinCommunityGroup({
  accessToken,
  shareToken,
  tokenType,
}: JoinCommunityGroupRequest) {
  const normalizedShareToken = shareToken.trim();

  if (!normalizedShareToken) {
    throw new Error("Link khong hop le.");
  }

  const body = await requestGroup(
    resolveGroupUrl(
      `/api/v1/groups/join/${encodeURIComponent(normalizedShareToken)}`,
    ),
    {
      accessToken,
      errorMessageFactory: getJoinGroupErrorMessage,
      method: "POST",
      tokenType,
    },
  );

  return parseCommunityGroupPayload(body, normalizedShareToken);
}

export async function getCommunityGroups({
  accessToken,
  tokenType,
}: GetCommunityGroupsRequest = {}) {
  try {
    const body = await requestGroup(resolveGroupUrl("/api/v1/groups"), {
      accessToken,
      method: "GET",
      tokenType,
    });

    return parseCommunityGroupCollection(body);
  } catch (error) {
    if (!shouldRetryCommunityGroupListRequest(error)) {
      throw error;
    }
  }

  const fallbackBody = await requestGroup(resolveGroupUrl("/api/v1/groupsv"), {
    accessToken,
    method: "GET",
    tokenType,
  });

  return parseCommunityGroupCollection(fallbackBody);
}

export async function getCommunityGroupById({
  accessToken,
  groupId,
  tokenType,
}: GetCommunityGroupByIdRequest) {
  const normalizedGroupId = readIdentifier(groupId);

  if (!normalizedGroupId) {
    throw new Error("Khong tim thay ID nhom hop le.");
  }

  const body = await requestGroup(
    resolveGroupUrl(`/api/v1/groups/${encodeURIComponent(normalizedGroupId)}`),
    {
      accessToken,
      method: "GET",
      tokenType,
    },
  );

  return parseCommunityGroupPayload(body);
}

export async function getCommunityGroupMembers({
  accessToken,
  action,
  groupId,
  tokenType,
}: GetCommunityGroupMembersRequest) {
  const normalizedGroupId = readIdentifier(groupId);
  const normalizedAction = normalizeActionValue(action);

  if (!normalizedGroupId) {
    throw new Error("Khong tim thay ID nhom hop le.");
  }

  const params = new URLSearchParams();

  if (normalizedAction) {
    params.set("action", normalizedAction);
  }

  const querySuffix = params.size ? `?${params.toString()}` : "";
  const body = await requestGroup(
    resolveGroupUrl(
      `/api/v1/groups/${encodeURIComponent(normalizedGroupId)}/member${querySuffix}`,
    ),
    {
      accessToken,
      method: "GET",
      tokenType,
    },
  );

  const members = parseCommunityGroupMemberCollection(body);

  if (!normalizedAction) {
    return members;
  }

  return members.filter(
    (member) => normalizeActionValue(member.action) === normalizedAction,
  );
}

export async function updateCommunityGroup({
  accessToken,
  groupId,
  groupName,
  imageFile,
  requiredApproval,
  tokenType,
}: UpdateCommunityGroupRequest) {
  const normalizedGroupId = readIdentifier(groupId);
  const trimmedGroupName = groupName.trim();

  if (!normalizedGroupId) {
    throw new Error("Khong tim thay ID nhom hop le.");
  }

  if (!trimmedGroupName) {
    throw new Error("Hay nhap ten nhom truoc khi luu.");
  }

  const url = resolveGroupUrl(
    `/api/v1/groups/${encodeURIComponent(normalizedGroupId)}`,
  );
  // PUT /api/v1/groups/{id} chi nhan multipart/form-data (groupName,
  // requiredApproval, imageFile). Body JSON se lam backend tra 500.
  const formData = new FormData();

  formData.append("groupName", trimmedGroupName);
  formData.append("requiredApproval", `${requiredApproval}`);

  const imageFilePart = buildImageFilePart(imageFile);

  if (imageFilePart) {
    formData.append("imageFile", imageFilePart as unknown as Blob);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      body: formData,
      // Khong tu set Content-Type: de fetch tu sinh boundary cho multipart.
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? {
              Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
            }
          : null),
        "X-Client-Type": "mobile",
      },
      method: "PUT",
    });
  } catch (error) {
    console.warn("[community] group network failure", {
      error,
      method: "PUT",
      url,
    });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[community] group request rejected", {
      body: responseBody,
      method: "PUT",
      status: response.status,
      url,
    });
    throw new Error(getDefaultErrorMessage(responseBody, response.status));
  }

  return parseCommunityGroupPayload(responseBody);
}

export async function refreshCommunityGroupToken({
  accessToken,
  groupId,
  tokenType,
}: RefreshCommunityGroupTokenRequest) {
  const normalizedGroupId = readIdentifier(groupId);

  if (!normalizedGroupId) {
    throw new Error("Khong tim thay ID nhom hop le.");
  }

  const body = await requestGroup(
    resolveGroupUrl(
      `/api/v1/groups/${encodeURIComponent(normalizedGroupId)}/refresh-token`,
    ),
    {
      accessToken,
      method: "PUT",
      tokenType,
    },
  );

  return parseCommunityGroupPayload(body);
}

export async function leaveCommunityGroup({
  accessToken,
  groupId,
  tokenType,
}: LeaveCommunityGroupRequest) {
  const normalizedGroupId = readIdentifier(groupId);

  if (!normalizedGroupId) {
    throw new Error("Khong tim thay ID nhom hop le.");
  }

  const body = await requestGroup(
    resolveGroupUrl(
      `/api/v1/groups/${encodeURIComponent(normalizedGroupId)}/leave`,
    ),
    {
      accessToken,
      method: "PUT",
      tokenType,
    },
  );

  return parseCommunityGroupPayload(body);
}

export async function deleteCommunityGroup({
  accessToken,
  groupId,
  tokenType,
}: DeleteCommunityGroupRequest): Promise<void> {
  const normalizedGroupId = readIdentifier(groupId);

  if (!normalizedGroupId) {
    throw new Error("Khong tim thay ID nhom hop le.");
  }

  await requestGroup(
    resolveGroupUrl(`/api/v1/groups/${encodeURIComponent(normalizedGroupId)}`),
    {
      accessToken,
      method: "DELETE",
      tokenType,
    },
  );
}

export async function kickCommunityGroupMember({
  accessToken,
  groupId,
  tokenType,
  userId,
}: KickCommunityGroupMemberRequest) {
  const normalizedGroupId = readIdentifier(groupId);
  const normalizedUserId = readIdentifier(userId);

  if (!normalizedGroupId) {
    throw new Error("Khong tim thay ID nhom hop le.");
  }

  if (!normalizedUserId) {
    throw new Error("Khong tim thay ID thanh vien hop le.");
  }

  const body = await requestGroup(
    resolveGroupUrl(
      `/api/v1/groups/${encodeURIComponent(normalizedGroupId)}/kick/${encodeURIComponent(normalizedUserId)}`,
    ),
    {
      accessToken,
      method: "PUT",
      tokenType,
    },
  );

  return parseCommunityGroupPayload(body);
}

export async function updateCommunityGroupParticipant({
  accessToken,
  action,
  participantId,
  tokenType,
}: UpdateCommunityGroupParticipantRequest) {
  const normalizedParticipantId = readIdentifier(participantId);
  const normalizedAction = normalizeActionValue(action);

  if (!normalizedParticipantId) {
    throw new Error("Khong tim thay participantId hop le.");
  }

  if (normalizedAction !== "JOIN" && normalizedAction !== "DENIED") {
    throw new Error("Action participant khong hop le.");
  }

  const body = await requestGroup(
    resolveGroupUrl(
      `/api/v1/groups/participant/${encodeURIComponent(normalizedParticipantId)}?action=${encodeURIComponent(normalizedAction)}`,
    ),
    {
      accessToken,
      method: "PUT",
      tokenType,
    },
  );

  return isObject(body) ? parseCommunityGroupMemberPayload(body) : null;
}
