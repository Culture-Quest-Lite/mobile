import * as Location from "expo-location";

import { PublicEnv } from "@/constants/env";

export type AppCoordinate = {
  latitude: number;
  longitude: number;
  source: "device" | "dev-override";
};

type DeviceCoordinateOptions = {
  accuracy: Location.Accuracy;
  maxAge: number;
  mayShowUserSettingsDialog?: boolean;
  requiredAccuracy?: number;
};

function parseCoordinateValue(rawValue: string) {
  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function formatCoordinateLabel(
  coordinate: Pick<AppCoordinate, "latitude" | "longitude">,
) {
  return `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
}

export function getDevelopmentLocationOverride(): AppCoordinate | null {
  if (!__DEV__) {
    return null;
  }

  const latitude = parseCoordinateValue(PublicEnv.devLatitude);
  const longitude = parseCoordinateValue(PublicEnv.devLongitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    source: "dev-override",
  };
}

export async function getDeviceCoordinate(
  options: DeviceCoordinateOptions,
): Promise<AppCoordinate | null> {
  const lastKnownPosition = await Location.getLastKnownPositionAsync({
    maxAge: options.maxAge,
    requiredAccuracy: options.requiredAccuracy,
  });
  const currentPosition =
    lastKnownPosition ??
    (await Location.getCurrentPositionAsync({
      accuracy: options.accuracy,
      mayShowUserSettingsDialog: options.mayShowUserSettingsDialog,
    }));

  if (!currentPosition) {
    return null;
  }

  return {
    latitude: currentPosition.coords.latitude,
    longitude: currentPosition.coords.longitude,
    source: "device",
  };
}
