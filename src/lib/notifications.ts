import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const DEFAULT_NOTIFICATION_CHANNEL_ID = "default";

export type NotificationPermissionResult = {
  canAskAgain: boolean;
  granted: boolean;
};

// Foreground notifications are hidden by default, so opt them back in once for
// the whole app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let notificationPermissionRequestPromise: Promise<NotificationPermissionResult> | null =
  null;

function isNotificationPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus,
) {
  return (
    permission.granted ||
    permission.ios?.status ===
      Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

// Android 13+ only surfaces the notification prompt for apps that already own a
// channel, so create it before asking.
export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(
      DEFAULT_NOTIFICATION_CHANNEL_ID,
      {
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: "#F7F6F2",
        name: "Thông báo Culture Quest",
        vibrationPattern: [0, 250, 250, 250],
      },
    );
  } catch (error) {
    console.warn("[notifications] create channel failed", {
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermissionResult> {
  if (Platform.OS === "web") {
    return { canAskAgain: false, granted: false };
  }

  await ensureAndroidNotificationChannel();

  const currentPermission = await Notifications.getPermissionsAsync();

  if (isNotificationPermissionGranted(currentPermission)) {
    return { canAskAgain: currentPermission.canAskAgain, granted: true };
  }

  // The user permanently denied it; the OS will no longer show a dialog, so
  // send them to Settings from the UI instead of asking again.
  if (!currentPermission.canAskAgain) {
    return { canAskAgain: false, granted: false };
  }

  if (!notificationPermissionRequestPromise) {
    notificationPermissionRequestPromise = Notifications.requestPermissionsAsync(
      {
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      },
    )
      .then((requestedPermission) => ({
        canAskAgain: requestedPermission.canAskAgain,
        granted: isNotificationPermissionGranted(requestedPermission),
      }))
      .catch((error: unknown) => {
        console.warn("[notifications] request permission failed", {
          error: error instanceof Error ? error.message : error,
        });

        return { canAskAgain: false, granted: false };
      })
      .finally(() => {
        notificationPermissionRequestPromise = null;
      });
  }

  return notificationPermissionRequestPromise;
}

export async function getNotificationPermission(): Promise<NotificationPermissionResult> {
  if (Platform.OS === "web") {
    return { canAskAgain: false, granted: false };
  }

  const currentPermission = await Notifications.getPermissionsAsync();

  return {
    canAskAgain: currentPermission.canAskAgain,
    granted: isNotificationPermissionGranted(currentPermission),
  };
}
