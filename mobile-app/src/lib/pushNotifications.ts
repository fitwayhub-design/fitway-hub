import { Capacitor } from "@capacitor/core";
import { logger } from "@/lib/logger";
import {
  PushNotifications,
  type Token,
  type PermissionStatus,
} from "@capacitor/push-notifications";
import { getApiBase } from "@/lib/api";
import { resolveNotificationLink } from "@/lib/notificationLinks";

let listenersAttached = false;
let backendToken: string | null = null;

function isNativePushEnabled(): boolean {
  return String(import.meta.env.VITE_ENABLE_NATIVE_PUSH || "false").toLowerCase() === "true";
}

function getPlatform(): "android" | "ios" | "web" {
  const p = Capacitor.getPlatform();
  if (p === "android" || p === "ios") return p;
  return "web";
}

function isNativeRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function saveTokenToBackend(pushToken: string): Promise<void> {
  if (!backendToken) return;
  await fetch(getApiBase() + "/api/notifications/push-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${backendToken}`,
    },
    body: JSON.stringify({ token: pushToken, platform: getPlatform() }),
  });
}

async function attachListenersOnce(): Promise<void> {
  if (listenersAttached) return;

  await PushNotifications.addListener("registration", async (token: Token) => {
    try {
      await saveTokenToBackend(token.value);
      localStorage.setItem("fitway_push_token", token.value);
    } catch (err) {
      console.error("Push token registration failed:", err);
    }
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.error("Push registration error:", err);
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    // Keep default OS behavior; this event is useful for future in-app banners.
    logger.log("Push received:", notification?.title || "notification");
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    logger.log("Push action:", action?.notification?.title || "notification");
    try {
      const data = (action?.notification?.data ?? {}) as Record<string, string>;
      const dest =
        data.link ||
        resolveNotificationLink({
          type: data.type || "info",
          title: action?.notification?.title || data.title || null,
          body: action?.notification?.body || data.body || null,
        });
      if (dest) {
        // We're outside the React-Router context here, so a hard navigation is
        // the simplest reliable way to land the user on the destination route.
        window.location.assign(dest);
      }
    } catch (err) {
      logger.warn("Push action navigation failed:", err);
    }
  });

  listenersAttached = true;
}

export async function initPushNotifications(authToken: string): Promise<void> {
  if (!isNativeRuntime()) return;
  if (!isNativePushEnabled()) {
    logger.log("Native push skipped: VITE_ENABLE_NATIVE_PUSH is disabled");
    return;
  }

  backendToken = authToken;

  const perm: PermissionStatus = await PushNotifications.checkPermissions();
  let receive = perm.receive;

  if (receive === "prompt") {
    const req = await PushNotifications.requestPermissions();
    receive = req.receive;
  }

  if (receive !== "granted") return;

  await attachListenersOnce();
  await PushNotifications.register();
}

export async function unregisterPushNotifications(authToken: string): Promise<void> {
  if (!isNativeRuntime()) return;
  if (!isNativePushEnabled()) return;

  try {
    await fetch(getApiBase() + "/api/notifications/push-token", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ platform: getPlatform() }),
    });
  } catch (err) {
    logger.warn("Failed to remove push token from backend:", err);
  }
}
