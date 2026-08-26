import * as Location from "expo-location";
import { Platform } from "react-native";

import { PublicEnv } from "@/constants/env";

export type AppCoordinate = {
  latitude: number;
  longitude: number;
  /** Sai số GPS (mét) do thiết bị báo về. Server dùng để nới ngưỡng check-in. */
  accuracy: number | null;
  source: "device" | "dev-override";
};


export type ForegroundLocationPermissionResult = {
  canAskAgain: boolean;
  granted: boolean;
  status: Location.PermissionStatus;
};

let foregroundPermissionRequestPromise:
  | Promise<ForegroundLocationPermissionResult>
  | null = null;

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

  if (!foregroundPermissionRequestPromise) {
    foregroundPermissionRequestPromise =
      Location.requestForegroundPermissionsAsync()
        .then((requestedPermission) => {
          return {
            canAskAgain: requestedPermission.canAskAgain,
            granted: requestedPermission.granted,
            status: requestedPermission.status,
          };
        })
        .finally(() => {
          foregroundPermissionRequestPromise = null;
        });
  }

  return foregroundPermissionRequestPromise;
}

export async function getForegroundLocationPermission(): Promise<ForegroundLocationPermissionResult> {
  if (Platform.OS === "web") {
    return {
      canAskAgain: false,
      granted: false,
      status: Location.PermissionStatus.DENIED,
    };
  }

  const currentPermission = await Location.getForegroundPermissionsAsync();

  return {
    canAskAgain: currentPermission.canAskAgain,
    granted: currentPermission.granted,
    status: currentPermission.status,
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
    // Toạ độ giả lập nên coi như GPS rất chính xác.
    accuracy: 5,
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
    accuracy: currentPosition.coords.accuracy ?? null,
    source: "device",
  };
}

/**
 * Khoảng cách Haversine (mét). Trước đây mỗi màn tự chép một bản; gom về đây để
 * hook check-in và các màn "gần đây" dùng chung một công thức.
 */
export function getDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return "--";
  }

  if (distanceMeters < 1000) {
    return `${Math.max(1, Math.round(distanceMeters))}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}
