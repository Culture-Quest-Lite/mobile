import { Linking } from "react-native";

export type NavigationPoint = {
  latitude: number;
  longitude: number;
  title?: string | null;
};

export type GoogleMapsTravelMode =
  | "driving"
  | "walking"
  | "bicycling"
  | "transit"
  | "two-wheeler";

function coordinate(point: NavigationPoint) {
  return `${point.latitude},${point.longitude}`;
}

export function buildGoogleMapsMultiStopUrl({
  points,
  travelMode = "driving",
  useCurrentLocationAsOrigin = false,
}: {
  points: NavigationPoint[];
  travelMode?: GoogleMapsTravelMode;
  useCurrentLocationAsOrigin?: boolean;
}) {
  const validPoints = points.filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180,
  );

  if (!validPoints.length) {
    throw new Error("Không có tọa độ hợp lệ để mở Google Maps.");
  }

  const destination = validPoints[validPoints.length - 1];
  const routePoints = useCurrentLocationAsOrigin ? validPoints : validPoints.slice(1);
  const waypoints = routePoints.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    destination: coordinate(destination),
    travelmode: travelMode,
    dir_action: "navigate",
  });

  if (!useCurrentLocationAsOrigin && validPoints[0]) {
    params.set("origin", coordinate(validPoints[0]));
  }

  if (waypoints.length) {
    params.set("waypoints", waypoints.map(coordinate).join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export async function openGoogleMapsMultiStopRoute(options: {
  points: NavigationPoint[];
  travelMode?: GoogleMapsTravelMode;
  useCurrentLocationAsOrigin?: boolean;
}) {
  const url = buildGoogleMapsMultiStopUrl(options);
  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error("Thiết bị không thể mở Google Maps.");
  await Linking.openURL(url);
}
