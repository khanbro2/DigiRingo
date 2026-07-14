/**
 * Web Push — subscribe the browser so incoming-call alerts arrive even when the
 * DGRINGO tab is backgrounded/minimized (the service worker shows the
 * notification). Web-only: on the native Capacitor app this no-ops (native push
 * is FCM, handled separately). Best-effort — never throws.
 */
import { API_ORIGIN } from "./origin";
import { getToken } from "./api";

const urlB64ToUint8Array = (b64: string): Uint8Array => {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export async function initWebPush(): Promise<void> {
  try {
    // Native app uses FCM, not web push.
    if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    const reg = await navigator.serviceWorker.ready;

    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return;

    const vr = await fetch(`${API_ORIGIN}/api/push/vapid`).then((r) => r.json()).catch(() => null);
    if (!vr?.enabled || !vr?.publicKey) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vr.publicKey),
      });
    }

    const token = getToken();
    await fetch(`${API_ORIGIN}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch { /* best effort — push just won't work */ }
}
