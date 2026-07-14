/**
 * Minimal Web Push (RFC 8291 "aes128gcm" + VAPID / RFC 8292) — zero dependencies,
 * pure Node crypto. Lets the server push an "incoming call" notification to a
 * browser's service worker even when the tab is backgrounded/minimized (this is
 * how Quo and other web softphones alert on calls without a native app).
 *
 * Keys (generate once, put in the server .env):
 *   VAPID_PUBLIC       = base64url of the raw 65-byte P-256 public point
 *   VAPID_PRIVATE_B64  = base64 of the PKCS8 PEM private key
 *   VAPID_SUBJECT      = mailto:you@domain (optional)
 */
import crypto from "node:crypto";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC || "";
const VAPID_PRIVATE_PEM = process.env.VAPID_PRIVATE_B64 ? Buffer.from(process.env.VAPID_PRIVATE_B64, "base64").toString() : "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@digiringo.com";

export const vapidPublicKey = () => VAPID_PUBLIC;
export const webPushConfigured = () => !!(VAPID_PUBLIC && VAPID_PRIVATE_PEM);

const b64url = (buf) => Buffer.from(buf).toString("base64url");

/** VAPID Authorization header for a given push endpoint. */
function vapidAuth(endpoint) {
  const { protocol, host } = new URL(endpoint);
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64url(JSON.stringify({ aud: `${protocol}//${host}`, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT }));
  const signingInput = `${header}.${payload}`;
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), { key: crypto.createPrivateKey(VAPID_PRIVATE_PEM), dsaEncoding: "ieee-p1363" });
  return `vapid t=${signingInput}.${b64url(sig)}, k=${VAPID_PUBLIC}`;
}

/** Encrypt `payload` (Buffer) for a subscription using aes128gcm (RFC 8291). */
function encrypt(payload, p256dhB64, authB64) {
  const uaPublic = Buffer.from(p256dhB64, "base64url");   // client public key (65 bytes)
  const authSecret = Buffer.from(authB64, "base64url");   // client auth secret (16 bytes)
  const ecdh = crypto.createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();                   // our ephemeral public (65 bytes)
  const sharedSecret = ecdh.computeSecret(uaPublic);      // ECDH (32 bytes)
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const plaintext = Buffer.concat([payload, Buffer.from([0x02])]); // single/last record delimiter
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  const idlen = Buffer.from([asPublic.length]);
  return Buffer.concat([salt, rs, idlen, asPublic, ciphertext]); // aes128gcm body
}

/**
 * Send a push. `subscription` = { endpoint, p256dh, auth }. Returns
 * { ok, status, gone } — gone=true means the subscription is dead (404/410) and
 * the caller should delete it.
 */
export async function sendPush(subscription, payloadObj) {
  if (!webPushConfigured()) return { ok: false, status: 0, error: "web push not configured" };
  const body = encrypt(Buffer.from(JSON.stringify(payloadObj)), subscription.p256dh, subscription.auth);
  try {
    const r = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuth(subscription.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "60",
        Urgency: "high",
      },
      body,
    });
    return { ok: r.ok, status: r.status, gone: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}
