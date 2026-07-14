import { PublicEnv } from '@/constants/env';

export type LatLng = { latitude: number; longitude: number };

type DirectionOptions = {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
};

function decodePolyline(encoded: string): LatLng[] {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates: LatLng[] = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return coordinates;
}

function toGoongPoint(point: LatLng) {
  return `${point.latitude},${point.longitude}`;
}

async function getSingleLegRouteCoordinates(
  origin: LatLng,
  destination: LatLng,
): Promise<LatLng[]> {
  if (!PublicEnv.goongApiKey) {
    return [origin, destination];
  }

  const params = new URLSearchParams({
    origin: toGoongPoint(origin),
    destination: toGoongPoint(destination),
    vehicle: 'bike',
    api_key: PublicEnv.goongApiKey,
  });

  const response = await fetch(`https://rsapi.goong.io/Direction?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Goong Direction API failed: ${response.status}`);
  }

  const data = await response.json();
  const encodedPolyline = data?.routes?.[0]?.overview_polyline?.points;

  if (typeof encodedPolyline !== 'string' || !encodedPolyline) {
    return [origin, destination];
  }

  return decodePolyline(encodedPolyline);
}

/**
 * Lấy đường đi thực tế qua toàn bộ điểm theo đúng thứ tự.
 * Mỗi cặp điểm liên tiếp được gọi Directions riêng rồi ghép lại, nhờ đó
 * tuyến luôn đi qua A -> B -> C -> D ngay cả khi endpoint Directions không
 * xử lý tham số waypoint như mong đợi.
 */
export async function getMultiStopRouteCoordinates(
  orderedPoints: LatLng[],
): Promise<LatLng[]> {
  if (orderedPoints.length < 2) return orderedPoints;

  const fullRoute: LatLng[] = [];

  for (let index = 0; index < orderedPoints.length - 1; index += 1) {
    const leg = await getSingleLegRouteCoordinates(
      orderedPoints[index],
      orderedPoints[index + 1],
    );

    if (leg.length === 0) continue;

    // Bỏ điểm đầu của chặng sau để không tạo điểm trùng tại hotspot nối tiếp.
    fullRoute.push(...(index === 0 ? leg : leg.slice(1)));
  }

  return fullRoute.length > 1 ? fullRoute : orderedPoints;
}

export async function getGoongRouteCoordinates({
  origin,
  destination,
  waypoints = [],
}: DirectionOptions): Promise<LatLng[]> {
  return getMultiStopRouteCoordinates([origin, ...waypoints, destination]);
}
