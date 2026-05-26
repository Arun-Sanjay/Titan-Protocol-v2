/**
 * Expo push-token registration + sync to the user's profile row.
 *
 * Flow:
 *   1. Permission gate via expo-notifications (asks the OS if needed)
 *   2. Fetch the device's Expo push token (gated on EAS project id)
 *   3. cloudUpsert it into the profiles row so the send-push Edge
 *      Function can read it server-side
 *
 * Idempotent: if the token in SQLite matches what Expo returns, do
 * nothing. Re-runs every cold start so a rotated token gets re-saved.
 *
 * NEVER call this on app launch — the permission prompt feels heavy.
 * Call it after the first useful action (first task create, first
 * focus session, etc.). The Settings screen also exposes a manual
 * "enable push" path that calls this.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { logError } from "./error-log";
import { useAuthStore } from "../stores/useAuthStore";
import {
  cloudUpsert,
  sqliteGet,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

type Profile = Tables<"profiles">;

export type PushRegistrationResult =
  | { status: "granted"; token: string }
  | { status: "denied" }
  | { status: "unsupported"; reason: string }
  | { status: "no_user" }
  | { status: "no_profile" }
  | { status: "error"; error: string };

/**
 * Request push permission, fetch the Expo push token, and mirror it
 * into the signed-in user's profile row. Returns the resolved status.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  // Simulators / tvOS / desktop don't deliver remote pushes reliably.
  if (Device.isDevice !== true) {
    return { status: "unsupported", reason: "not_physical_device" };
  }

  try {
    // Android needs a notification channel before scheduling local notifs;
    // create a default one so OS pop-ups render with sensible importance.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FFFFFF",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return { status: "denied" };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const expoPushToken = tokenData.data;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { status: "no_user" };

    // Only round-trip to Supabase if the token actually changed.
    const existing = await sqliteGet<Profile>("profiles", { id: userId });
    if (!existing) return { status: "no_profile" };
    if (existing.expo_push_token === expoPushToken) {
      return { status: "granted", token: expoPushToken };
    }

    await cloudUpsert("profiles", {
      ...existing,
      expo_push_token: expoPushToken,
    });

    return { status: "granted", token: expoPushToken };
  } catch (e) {
    logError("push-token.register", e);
    return {
      status: "error",
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * Inverse: clear the push token from the user's profile row. Called
 * from Settings when the user disables push notifications, and on
 * sign-out as part of the cache wipe.
 */
export async function clearPushToken(): Promise<void> {
  try {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const existing = await sqliteGet<Profile>("profiles", { id: userId });
    if (!existing || !existing.expo_push_token) return;
    await cloudUpsert("profiles", {
      ...existing,
      expo_push_token: null,
    });
  } catch (e) {
    logError("push-token.clear", e);
  }
}
