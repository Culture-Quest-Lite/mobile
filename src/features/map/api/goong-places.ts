import { PublicEnv } from "@/constants/env";

export type GoongPlacePrediction = {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
};

export type GoongPlaceDetail = {
  address: string;
  latitude: number;
  longitude: number;
};

type AutocompleteResponse = {
  predictions?: Array<{
    description?: string;
    place_id?: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }>;
  status?: string;
};

type PlaceDetailResponse = {
  result?: {
    formatted_address?: string;
    name?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  };
  status?: string;
};

function requireGoongApiKey() {
  if (!PublicEnv.goongApiKey) {
    throw new Error("Thiếu EXPO_PUBLIC_GOONG_API_KEY để tìm kiếm địa chỉ.");
  }

  return PublicEnv.goongApiKey;
}

export async function autocompleteGoongPlaces(
  input: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<GoongPlacePrediction[]> {
  const normalizedInput = input.trim();

  if (normalizedInput.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    api_key: requireGoongApiKey(),
    input: normalizedInput,
    limit: "8",
    more_compound: "true",
    sessiontoken: sessionToken,
  });

  const response = await fetch(
    `https://rsapi.goong.io/Place/AutoComplete?${params.toString()}`,
    {
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Không tải được gợi ý địa chỉ (${response.status}).`);
  }

  const data = (await response.json()) as AutocompleteResponse;

  if (data.status && data.status !== "OK") {
    throw new Error("Goong không trả được gợi ý địa chỉ.");
  }

  return (data.predictions ?? [])
    .filter((item) => Boolean(item.place_id && item.description))
    .map((item) => ({
      description: item.description ?? "",
      placeId: item.place_id ?? "",
      mainText: item.structured_formatting?.main_text || item.description || "",
      secondaryText: item.structured_formatting?.secondary_text || "",
    }));
}

export async function getGoongPlaceDetail(
  placeId: string,
  sessionToken: string,
): Promise<GoongPlaceDetail> {
  const params = new URLSearchParams({
    api_key: requireGoongApiKey(),
    place_id: placeId,
    sessiontoken: sessionToken,
  });

  const response = await fetch(
    `https://rsapi.goong.io/Place/Detail?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Không lấy được chi tiết địa chỉ (${response.status}).`);
  }

  const data = (await response.json()) as PlaceDetailResponse;
  const latitude = data.result?.geometry?.location?.lat;
  const longitude = data.result?.geometry?.location?.lng;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Địa chỉ này chưa có tọa độ hợp lệ.");
  }

  return {
    address: data.result?.formatted_address || data.result?.name || "",
    latitude: latitude as number,
    longitude: longitude as number,
  };
}
