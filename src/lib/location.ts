import * as Location from "expo-location";

import { PublicEnv } from "@/constants/env";

export type AppCoordinate = {
  latitude: number;
  longitude: number;
  source: "device" | "dev-override";
};


export type ForegroundLocationPermissionResult = {
  canAskAgain: boolean;
  granted: boolean;
  status: Location.PermissionStatus;
};

export async function ensureForegroundLocationPermission(): Promise<ForegroundLocationPermissionResult> {
  const currentPermission = await Location.getForegroundPermissionsAsync();

  if (currentPermission.granted) {
    return {
      canAskAgain: currentPermission.canAskAgain,
      granted: true,
      status: currentPermission.status,
    };
  }

  // Do not repeatedly show the native dialog after the user has denied it
  // permanently. The UI can direct the user to Android/iOS Settings instead.
  if (!currentPermission.canAskAgain) {
    return {
      canAskAgain: false,
      granted: false,
      status: currentPermission.status,
    };
  }

  const requestedPermission = await Location.requestForegroundPermissionsAsync();

  return {
    canAskAgain: requestedPermission.canAskAgain,
    granted: requestedPermission.granted,
    status: requestedPermission.status,
  };
}

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
  if (!__DEV__ || !PublicEnv.useDevLocationOverride) {
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
