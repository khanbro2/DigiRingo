/**
 * FCM (Firebase Cloud Messaging) HTTP v1 sender — ZERO dependencies (Node crypto
 * + fetch). Alerts the native Android/iOS app about incoming calls & texts even
 * when it's fully backgrounded/killed (Web Push in webpush.mjs only covers the
 * browser/PWA; a killed native app can only be woken by FCM).
 *
 * Flow: sign a service-account JWT (RS256) → exchange for an OAuth2 access token
 * → POST the message to FCM v1. The access token is cached until it expires.
 *
 * Env: FCM_SERVICE_ACCOUNT = the Firebase service-account JSON (from Project
 * settings → Service accounts → Generate new private key). Either the raw JSON
 * (single line) or base64 of it — base64 avoids newline/quoting pain in .env.
 * Read LAZILY (this module is imported before process.loadEnvFile()).
 */
import crypto from "node:crypto";

function serviceAccount() {
  let raw = process.env.FCM_SERVICE_ACCOUNT || "";
  if (!raw) return null;
  if (!raw.trim().startsWith("{")) { try { raw = Buffer.from(raw, "base64").toString("utf8"); } catch { /* use as-is */ } }
  try { return JSON.parse(raw); } catch { return null; }
}

export const fcmConfigured = () => !!serviceAccount();

const b64url = (buf) => Buffer.from(buf).toString("base64url");

let cachedToken = null; // { token, exp (epoch s) }
async function accessToken() {
  const sa = serviceAccount();
  if (!sa) throw new Error("FCM not configured");
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(sa.private_key, "base64url");
  const jwt = `${header}.${claim}.${sig}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "FCM token exchange failed");
  cachedToken = { token: j.access_token, exp: now + (Number(j.expires_in) || 3600) };
  return cachedToken.token;
}

/**
 * Send a high-priority notification to ONE device token. Returns { ok, gone,
 * error } — gone=true means the token is dead (UNREGISTERED / not found) and the
 * caller should delete it from the DB.
 */
export async function sendFcm(token, { title, body, data = {} } = {}) {
  const sa = serviceAccount();
  if (!sa) return { ok: false, error: "not configured" };
  try {
    const at = await accessToken();
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      // High priority so it wakes a dozing device; no channel_id → FCM uses its
      // auto-created fallback channel (always exists, so the notification shows).
      android: {
        priority: "high",
        notification: { sound: "default", default_sound: true },
      },
    };
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    const code = j?.error?.status || "";
    const gone = code === "NOT_FOUND" || code === "UNREGISTERED" || r.status === 404;
    return { ok: false, gone, error: j?.error?.message || `HTTP ${r.status}` };
  } catch (e) { return { ok: false, error: e.message }; }
}

/** Fan a notification out to all of a user's device tokens; prunes dead ones. */
export async function sendFcmToUser(tokens, payload, onDead) {
  const results = await Promise.all((tokens || []).map(async (t) => {
    const tok = typeof t === "string" ? t : t.token;
    const res = await sendFcm(tok, payload);
    if (res.gone && onDead) await onDead(tok).catch(() => {});
    return res;
  }));
  return { sent: results.filter((r) => r.ok).length, total: results.length };
}
