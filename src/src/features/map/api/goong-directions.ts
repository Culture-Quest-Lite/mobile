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

export async function getGoongRouteCoordinates({
  origin,
  destination,
  waypoints = [],
}: DirectionOptions): Promise<LatLng[]> {
  if (!PublicEnv.goongApiKey) {
    return [origin, ...waypoints, destination];
  }

  const params = new URLSearchParams({
    origin: toGoongPoint(origin),
    destination: toGoongPoint(destination),
    vehicle: 'bike',
    api_key: PublicEnv.goongApiKey,
  });

  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(toGoongPoint).join('|'));
  }

  const response = await fetch(`https://rsapi.goong.io/Direction?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Goong Direction API failed: ${response.status}`);
  }

  const data = await response.json();
  const encodedPolyline = data?.routes?.[0]?.overview_polyline?.points;

  if (typeof encodedPolyline !== 'string' || !encodedPolyline) {
    return [origin, ...waypoints, destination];
  }

  return decodePolyline(encodedPolyline);
}
