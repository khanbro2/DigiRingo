/**
 * Web Push — subscribe the browser so incoming-call alerts arrive even when the
 * DGRINGO tab is backgrounded/minimized (the service worker shows the
 * notification). Web-only: on the native Capacitor app this no-ops (native push
 * is FCM, handled separately). Best-effort — never throws.
 *
 * IMPORTANT ordering: `Notification.requestPermission()` must be the FIRST
 * async call after a click — awaiting anything else first (e.g.
 * serviceWorker.ready) can expire the user-gesture, and the browser then
 * silently suppresses the permission popup.
 */
import { API_ORIGIN } from "./origin";
import { getToken } from "./api";

const supported = (): boolean => {
  const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  return !native && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
};

const urlB64ToUint8Array = (b64: string): Uint8Array => {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

/** Register the push subscription with the server. Assumes permission GRANTED. */
export async function subscribePush(): Promise<void> {
  try {
    if (!supported() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
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

/**
 * Ask for notification permission — call this DIRECTLY from a click handler so
 * the browser shows the real popup — then subscribe when granted.
 */
export async function requestPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!supported()) return "unsupported";
  let perm = Notification.permission;
  try {
    if (perm === "default") perm = await Notification.requestPermission(); // FIRST await — keeps the user gesture
  } catch { /* older callback API / blocked */ }
  if (perm === "granted") subscribePush(); // fire-and-forget
  return perm;
}

/** Login-time best effort: request (browser may quiet it) + subscribe. */
export async function initWebPush(): Promise<void> {
  await requestPushPermission();
}
