import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import type { Profile } from "../types";

export type ProfileImageFile = {
  mimeType?: string | null;
  name?: string | null;
  uri: string;
};

type ProfileImageFilePart = {
  file: ExpoFile;
  name: string;
};

type UpdateMyProfileRequest = {
  accessToken: string;
  avatarFile?: ProfileImageFile | null;
  backgroundFile?: ProfileImageFile | null;
  displayName: string;
  autoPlayAudio: boolean;
  tokenType?: string | null;
};

type GetMeResponse = {
  userId: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  totalXp: number;
  totalPoints: number;
  autoPlayAudio: boolean;
  isPremium: boolean;
  status: string;
  levelName: string | null;
  role: string;
  createdAt: string;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;
};

function resolveUpdateMeUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/users/me");
  }

  return "http://13.158.40.56:8080/api/users/me";
}

const imageMimeTypeByExtension: Record<string, string> = {
  gif: "image/gif",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function readMeaningfulText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

// Expo SDK 56 ho tro multipart voi expo-file-system File. ImagePicker tren Android
// co the tra ve file:// hoac content://, nen dung File se on dinh hon object RN cu.
function buildProfileImageFilePart(
  file: ProfileImageFile | null | undefined,
  fallbackName: string,
): ProfileImageFilePart | null {
  const uri = readMeaningfulText(file?.uri);

  if (!uri) {
    return null;
  }

  const extension =
    uri.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() ?? "";
  const name =
    readMeaningfulText(file?.name) ??
    `${fallbackName}.${extension in imageMimeTypeByExtension ? extension : "jpg"}`;
  const type =
    readMeaningfulText(file?.mimeType) ??
    imageMimeTypeByExtension[extension] ??
    "image/jpeg";

  const uploadFile = new ExpoFile(uri);
  const normalizedName = name.includes(".")
    ? name
    : `${name}.${type.split("/")[1] ?? "jpg"}`;

  return {
    file: uploadFile,
    name: normalizedName,
  };
}

function appendProfileImageField(
  formData: FormData,
  fieldName: string,
  filePart: ProfileImageFilePart | null,
) {
  if (!filePart) {
    formData.append(fieldName, "");
    return;
  }

  formData.append(fieldName, filePart.file, filePart.name);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isGetMeResponse(value: unknown): value is GetMeResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.userId === "number" &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    typeof value.displayName === "string" &&
    isNullableString(value.avatarUrl) &&
    isNullableString(value.backgroundUrl) &&
    typeof value.totalXp === "number" &&
    typeof value.totalPoints === "number" &&
    typeof value.autoPlayAudio === "boolean" &&
    typeof value.isPremium === "boolean" &&
    typeof value.status === "string" &&
    isNullableString(value.levelName) &&
    typeof value.role === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.totalFollowers === "number" &&
    typeof value.totalFollowing === "number" &&
    typeof value.totalPosts === "number"
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
}

function summarizeBody(body: unknown) {
  if (typeof body === "string") {
    return body.slice(0, 300);
  }

  if (isObject(body)) {
    return body;
  }

  return body;
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

function getErrorMessage(body: unknown, status: number) {
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

  return `Không thể cập nhật hồ sơ (${status}).`;
}

function isExpoFormDataFileError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Unsupported FormDataPart implementation")
  );
}

function getConnectionErrorMessage(url: string, error: unknown) {
  if (isExpoFormDataFileError(error)) {
    return "Ảnh đang được gửi sai định dạng multipart. Vui lòng cập nhật app rồi thử lại.";
  }

  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ hồ sơ.";
}

function extractLevel(levelName: string | null) {
  const match = levelName?.match(/(\d+)/);

  if (!match) {
    return null;
  }

  const parsedLevel = Number(match[1]);
  return Number.isFinite(parsedLevel) ? parsedLevel : null;
}

function mapGetMeResponseToProfile(response: GetMeResponse): Profile {
  const normalizedDisplayName = response.displayName.trim();
  const normalizedUsername = response.username.trim();

  return {
    autoPlayAudio: response.autoPlayAudio,
    avatar: response.avatarUrl,
    cover: response.backgroundUrl,
    createdAt: response.createdAt,
    currentLevelRequiredXp: null,
    currentLevelXp: null,
    email: response.email,
    followers: response.totalFollowers,
    following: response.totalFollowing,
    hasExactLevelProgress: false,
    id: response.userId.toString(),
    isPremium: response.isPremium,
    isMaxLevel: false,
    level: extractLevel(response.levelName),
    levelName: response.levelName,
    levelProgressPercent: null,
    name: normalizedDisplayName || normalizedUsername,
    nextLevelName: null,
    nextLevelNumber: null,
    nextLevelRequiredXp: null,
    points: response.totalPoints,
    remainingXpToNextLevel: null,
    role: response.role,
    routeIds: [],
    savedHotspotSlugs: [],
    status: response.status,
    totalXp: response.totalXp,
    totalPosts: response.totalPosts,
    username: normalizedUsername,
    xpToNext: null,
  };
}

export async function updateMyProfile({
  accessToken,
  avatarFile,
  backgroundFile,
  displayName,
  autoPlayAudio,
  tokenType,
}: UpdateMyProfileRequest): Promise<Profile | null> {
  const updateMeUrl = resolveUpdateMeUrl();
  const formData = new FormData();

  formData.append("displayName", displayName);
  formData.append("autoPlayAudio", `${autoPlayAudio}`);

  // BE luon mong doi 2 part avatarFile/backgroundFile ton tai trong multipart
  // body (giong hanh vi mac dinh "Send empty value" cua Swagger) - neu thieu
  // part, BE se NPE khi doc MultipartFile null va tra ve 500 INTERNAL_ERROR.
  const avatarFilePart = buildProfileImageFilePart(avatarFile, "avatar");
  appendProfileImageField(formData, "avatarFile", avatarFilePart);

  const backgroundFilePart = buildProfileImageFilePart(
    backgroundFile,
    "background",
  );
  appendProfileImageField(formData, "backgroundFile", backgroundFilePart);

  let response: Response;

  try {
    response = await fetch(updateMeUrl, {
      body: formData,
      // Khong tu set Content-Type: de fetch tu sinh boundary cho multipart.
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "PUT",
    });
  } catch (error) {
    console.warn("[profile] update me network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: updateMeUrl,
    });
    throw new Error(getConnectionErrorMessage(updateMeUrl, error));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[profile] update me rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: updateMeUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (responseBody === null) {
    return null;
  }

  if (!isGetMeResponse(responseBody)) {
    console.warn("[profile] update me unexpected payload", {
      body: summarizeBody(responseBody),
      url: updateMeUrl,
    });
    return null;
  }

  return mapGetMeResponseToProfile(responseBody);
}
