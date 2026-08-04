import { Alert, Linking, Platform } from "react-native";

import {
  ensureForegroundLocationPermission,
  getDevelopmentLocationOverride,
} from "@/lib/location";
import { ensureNotificationPermission } from "@/lib/notifications";
import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

const STARTUP_PERMISSION_STORAGE_KEY = "startup-permissions";

export type StartupPermissionKind = "location" | "notifications";

export type StartupPermissionOutcome = {
  /** The OS still shows its dialog, so asking again later is allowed. */
  canAskAgain: boolean;
  granted: boolean;
  kind: StartupPermissionKind;
};

type StartupPermissionState = {
  settingsHintShown: boolean;
};

const DEFAULT_STARTUP_PERMISSION_STATE: StartupPermissionState = {
  settingsHintShown: false,
};

const PERMISSION_LABELS: Record<StartupPermissionKind, string> = {
  location: "Vị trí",
  notifications: "Thông báo",
};

let startupPermissionFlowPromise: Promise<StartupPermissionOutcome[]> | null =
  null;

function readStartupPermissionState() {
  return readStoredJson<StartupPermissionState>(
    STARTUP_PERMISSION_STORAGE_KEY,
    DEFAULT_STARTUP_PERMISSION_STATE,
  );
}

/**
 * The OS refuses to show its own dialog once the user has denied a permission
 * for good, so Settings is the only way back. Nag about it at most once per
 * install, using the platform alert -- no in-app dialog of our own.
 */
function showSettingsHintOnce(outcomes: StartupPermissionOutcome[]) {
  const blocked = outcomes.filter(
    (outcome) => !outcome.granted && !outcome.canAskAgain,
  );

  if (!blocked.length || readStartupPermissionState().settingsHintShown) {
    return;
  }

  writeStoredJson(STARTUP_PERMISSION_STORAGE_KEY, {
    ...readStartupPermissionState(),
    settingsHintShown: true,
  });

  const blockedLabels = blocked
    .map((outcome) => PERMISSION_LABELS[outcome.kind])
    .join(" và ");

  Alert.alert(
    "Bật quyền trong Cài đặt",
    `Culture Quest cần quyền ${blockedLabels} để gợi ý địa điểm gần bạn và báo tin mới. Bạn đã từ chối trước đó nên hệ thống không hỏi lại được nữa.`,
    [
      { style: "cancel", text: "Để sau" },
      { onPress: () => void Linking.openSettings(), text: "Mở cài đặt" },
    ],
  );
}

/**
 * Asks for the permissions the app needs to be useful at all, using only the
 * native OS dialogs. The prompts are awaited one after another because Android
 * queues a second permission dialog behind the first one and iOS drops it.
 *
 * Each `ensure*` helper is a no-op when the permission is already granted, and
 * returns `canAskAgain: false` once the OS refuses to show its dialog again.
 *
 * Photo library access is deliberately not requested here: it is only asked for
 * at the moment the user picks an image.
 */
async function runStartupPermissionFlow(): Promise<StartupPermissionOutcome[]> {
  const outcomes: StartupPermissionOutcome[] = [];

  try {
    const location = getDevelopmentLocationOverride()
      ? { canAskAgain: false, granted: true }
      : await ensureForegroundLocationPermission();

    outcomes.push({
      canAskAgain: location.canAskAgain,
      granted: location.granted,
      kind: "location",
    });
  } catch (error) {
    console.warn("[permissions] location request failed", {
      error: error instanceof Error ? error.message : error,
    });
  }

  try {
    const notifications = await ensureNotificationPermission();

    outcomes.push({
      canAskAgain: notifications.canAskAgain,
      granted: notifications.granted,
      kind: "notifications",
    });
  } catch (error) {
    console.warn("[permissions] notification request failed", {
      error: error instanceof Error ? error.message : error,
    });
  }

  showSettingsHintOnce(outcomes);

  return outcomes;
}

export function requestStartupPermissions() {
  if (Platform.OS === "web") {
    return Promise.resolve<StartupPermissionOutcome[]>([]);
  }

  if (!startupPermissionFlowPromise) {
    startupPermissionFlowPromise = runStartupPermissionFlow().finally(() => {
      startupPermissionFlowPromise = null;
    });
  }

  return startupPermissionFlowPromise;
}
