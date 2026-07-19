/**
 * Native (Capacitor) integration. Everything here NO-OPS on the web build, so the
 * same bundle runs in the browser and in the Android shell.
 *
 * On native it: styles the status bar, hides the splash once React is up, and
 * registers for push notifications — sending the device's FCM token to the server
 * so it can alert the app about incoming calls even when backgrounded.
 */
import { Capacitor } from "@capacitor/core";
import { API_ORIGIN } from "./services/origin";
import { getToken } from "./services/api";

export const isNative = (): boolean => Capacitor.isNativePlatform();

export async function initNative(): Promise<void> {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: "#0b1020" }).catch(() => {});
  } catch { /* plugin unavailable */ }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide().catch(() => {});
  } catch { /* plugin unavailable */ }

  // Hardware back button: let the web app handle history; exit only at the root.
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch { /* plugin unavailable */ }

  // Push requires Firebase: calling PushNotifications.register() WITHOUT
  // google-services.json throws a NATIVE fatal ("Default FirebaseApp is not
  // initialized") that crashes the app on launch — a JS try/catch can't stop it.
  // So it's gated on a BUILD flag (VITE_PUSH_ENABLED=true, set only in
  // .env.native) AND google-services.json must be present in android/app/ for
  // that build. The web build never sets the flag, so this never runs in a browser.
  const PUSH_ENABLED = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PUSH_ENABLED === "true";
  if (PUSH_ENABLED) await initPush();
}

async function initPush(): Promise<void> {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;

    PushNotifications.addListener("registration", (t) => { sendPushToken(t.value).catch(() => {}); });
    PushNotifications.addListener("registrationError", () => { /* ignore */ });
    // Foreground / tapped notifications — the incoming-call UI is driven by the
    // WebRTC socket once the app is awake; the push just wakes/att­racts it.
    PushNotifications.addListener("pushNotificationReceived", () => { /* no-op */ });
    PushNotifications.addListener("pushNotificationActionPerformed", () => { /* no-op */ });

    await PushNotifications.register();
  } catch { /* plugin unavailable / not configured */ }
}

/** Store the device's push token against the signed-in user so the server can
 *  send incoming-call alerts. Requires Firebase (google-services.json) at build. */
async function sendPushToken(token: string): Promise<void> {
  const auth = getToken();
  if (!auth || !token) return;
  await fetch(`${API_ORIGIN}/api/user/push-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
    body: JSON.stringify({ token, platform: "android" }),
  });
}
