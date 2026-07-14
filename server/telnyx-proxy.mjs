/**
 * DGRINGO — Telnyx backend proxy + inbox store (Node 18+, zero dependencies).
 *
 * Two jobs:
 *  1) PROXY  — the app calls /api/telnyx/* on YOUR origin; this server forwards
 *     to https://api.telnyx.com/v2/* and injects `Authorization: Bearer <KEY>`
 *     so the secret API key NEVER reaches the browser.
 *  2) INBOX  — Telnyx has no "list conversations" endpoint. This server receives
 *     inbound SMS via the `message.received` webhook, records outbound sends, and
 *     groups them into threads per (owned number, contact). The app reads them at
 *     GET /api/telnyx/messaging/conversations.
 *
 * Run:
 *   TELNYX_API_KEY=KEY_xxx node server/telnyx-proxy.mjs
 *
 * Endpoints:
 *   ANY  /api/telnyx/*                      → forwarded to api.telnyx.com/v2/*
 *   POST /api/telnyx/messages               → forwarded, then recorded as outbound
 *   GET  /api/telnyx/messaging/conversations→ served from the local inbox store
 *   POST /webhooks/telnyx                    → Telnyx events (message.received, DLRs)
 *
 * NOTE: the inbox store is IN-MEMORY (resets on restart). For production, swap the
 * `threads` Map for a database (Postgres/Redis). The route shapes stay identical.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, timingSafeEqual, createPublicKey, verify as edVerify } from "node:crypto";
import { numberPrice, bundleCharge, bundleFor } from "./plans.mjs";
import {
  freemiusConfigured, verifyWebhook as fsVerifyWebhook, parseEvent as fsParseEvent,
  grantFor as fsGrantFor, getCheckouts as fsCheckouts, getProductId as fsProductId, getPublicKey as fsPublicKey,
} from "./freemius.mjs";
import { sendPush, vapidPublicKey, webPushConfigured } from "./webpush.mjs";

// Resolve the app root and load env from a `.env` there (DB creds + all secrets)
// if present — keeps the deployment self-contained and SSH-configurable.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
try { process.loadEnvFile?.(join(ROOT, ".env")); } catch { /* rely on host-injected env */ }

// DB layer for real auth + persistent wallet. Optional: the site still serves if
// mysql2 / the database is unavailable; the auth & wallet routes then 503.
let db = null;
try { db = await import("./auth-db.mjs"); }
catch (e) { console.warn("⚠ DB layer disabled:", e.message); }

// Email (password-reset). Configured via SMTP_* env; off until set.
let mailer = null;
try {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT || 465);
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    console.warn("⚠ SMTP not configured — password-reset emails won't send.");
  }
} catch (e) { console.warn("⚠ nodemailer unavailable:", e.message); }

async function sendResetEmail(to, name, link) {
  if (!mailer) throw new Error("Email is not configured");
  await mailer.sendMail({
    from: process.env.SMTP_FROM || `DGRINGO <${process.env.SMTP_USER}>`,
    to,
    subject: "Reset your DGRINGO password",
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:8px">
      <h2 style="color:#0a1b3d">Reset your password</h2>
      <p style="color:#475">Hi ${name || "there"}, we got a request to reset your DGRINGO password.
      Click the button below to choose a new one. This link expires in 1 hour.</p>
      <p style="margin:26px 0"><a href="${link}" style="background:linear-gradient(120deg,#4f8ef7,#9b6ff7);color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:700;display:inline-block">Reset password</a></p>
      <p style="color:#889;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p style="color:#aab;font-size:12px;word-break:break-all">Or paste this link: ${link}</p>
    </div>`,
  });
}

async function sendVerifyEmail(to, name, link) {
  if (!mailer) throw new Error("Email is not configured");
  await mailer.sendMail({
    from: process.env.SMTP_FROM || `DGRINGO <${process.env.SMTP_USER}>`,
    to,
    subject: "Verify your DGRINGO email",
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:8px">
      <h2 style="color:#0a1b3d">Welcome to DGRINGO 👋</h2>
      <p style="color:#475">Hi ${name || "there"}, thanks for signing up! Please confirm this is your
      email address by clicking the button below. This link expires in 24 hours.</p>
      <p style="margin:26px 0"><a href="${link}" style="background:linear-gradient(120deg,#4f8ef7,#9b6ff7);color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:700;display:inline-block">Verify email</a></p>
      <p style="color:#889;font-size:13px">If you didn't create a DGRINGO account, you can safely ignore this email.</p>
      <p style="color:#aab;font-size:12px;word-break:break-all">Or paste this link: ${link}</p>
    </div>`,
  });
}

const bearer = (req) => {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
};

// Admin (Control Hub) auth — a single shared password (ADMIN_PASSWORD) gates the
// dashboard; sessions are short-lived HMAC tokens. No DB needed.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET = process.env.AUTH_SECRET || "dgringo-admin-secret-change-me";
const adminHmac = (s) => createHmac("sha256", ADMIN_SECRET).update(String(s)).digest();
function signAdminToken() {
  const payload = Buffer.from(JSON.stringify({ admin: true, exp: Date.now() + 12 * 3600 * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url")}`;
}
function verifyAdminToken(token) {
  if (!token) return false;
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return false;
  const expect = createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { const p = JSON.parse(Buffer.from(payload, "base64url").toString()); return p.admin === true && Date.now() < p.exp; } catch { return false; }
}

// Telnyx webhook signature verification (Ed25519). Set TELNYX_PUBLIC_KEY (the
// base64 public key from the Telnyx portal) to reject spoofed webhooks. If unset,
// verification is skipped (with a warning) so inbound SMS still works meanwhile.
const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY;
let telnyxPubKey = null;
if (TELNYX_PUBLIC_KEY) {
  try {
    const raw = Buffer.from(TELNYX_PUBLIC_KEY, "base64");
    const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]); // SPKI prefix + 32-byte key
    telnyxPubKey = createPublicKey({ key: der, format: "der", type: "spki" });
  } catch (e) { console.warn("⚠ TELNYX_PUBLIC_KEY invalid:", e.message); }
}
function verifyTelnyxWebhook(rawBody, sigB64, timestamp) {
  if (!telnyxPubKey) return true; // not configured → allow (warned at boot)
  if (!sigB64 || !timestamp) return false;
  try {
    return edVerify(null, Buffer.from(`${timestamp}|${rawBody}`), telnyxPubKey, Buffer.from(sigB64, "base64"));
  } catch { return false; }
}
if (!TELNYX_PUBLIC_KEY) console.warn("⚠ TELNYX_PUBLIC_KEY not set — webhook signatures NOT verified.");

const KEY = process.env.TELNYX_API_KEY;
// Hostinger (and most PaaS) inject the port to listen on via PORT.
const PORT = Number(process.env.PORT ?? process.env.TELNYX_PROXY_PORT ?? 8787);
const TELNYX = "https://api.telnyx.com/v2";
const PREFIX = "/api/telnyx";

// (ROOT/DIST resolved above — this one Node server hosts the marketing site (/),
// the app (/app) and the Control Hub (/admin) alongside the API.)

// Payments run through Freemius (Merchant of Record) — see server/freemius.mjs.
// The browser opens Freemius's hosted checkout; fulfilment happens via webhook.
// No card secrets live in this process.

// The Telnyx key is optional at boot: without it the static site still serves
// (so the marketing pages are live even before Telnyx is configured); the
// /api/telnyx/* routes just answer 503 until the key is set in the host's env.
if (!KEY) {
  console.warn("⚠ TELNYX_API_KEY not set — serving site only; /api/telnyx/* will return 503.");
}

/* ------------------------------------------------------------------ helpers */
const send = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? Buffer.concat(chunks).toString() : "";
};

/* --------------------------------------------------- wallet charge (in-app pay) */
const payErr = (status, msg) => { const e = new Error(msg); e.status = status; return e; };

/**
 * Take payment of `amount` USD from a user's wallet balance. The SERVER decides
 * the amount — callers pass the authoritative figure from plans.mjs, never a
 * client-sent price. Direct card payments go through Freemius's hosted checkout
 * (which credits the wallet / activates the plan via webhook), so anything paid
 * here draws from the prepaid wallet. Throws payErr(402) if the balance is short.
 */
async function takePayment(uid, amount, label) {
  const wallet = await db.debitWallet(uid, amount, label); // throws 402 if insufficient
  return { method: "wallet", wallet };
}

/* ----------------------------------------------------------------- Freemius */
/**
 * Fulfil a verified Freemius webhook event: match the buyer by email, look up
 * what their payment grants, and apply it. Idempotency (no double-credit) is
 * enforced by the caller via db.recordFreemiusEvent before this runs.
 */
async function fulfilFreemius(p) {
  if (!db) throw new Error("DB not configured");
  const user = p.email ? await db.getUserByEmail(p.email) : null;
  if (!user) { console.warn("[freemius] no DGRINGO user for", p.email, "— event", p.type); return; }
  const uid = user.id;

  if (p.type === "payment.created") {
    const grant = fsGrantFor({ pricingId: p.pricingId, planId: p.planId, billingCycle: p.billingCycle });
    if (!grant) { console.warn("[freemius] no grant mapped for pricing", p.pricingId, "plan", p.planId); return; }
    if (grant.kind === "topup") {
      const amt = grant.amount || p.amount;
      if (!(amt > 0)) { console.warn("[freemius] top-up with no amount", p.id); return; }
      await db.creditWallet(uid, amt, `Wallet top-up $${amt.toFixed(2)} (Freemius)`, `fs_${p.id}`);
      await db.logActivity(uid, { kind: "wallet", title: "Top-up successful", body: `$${amt.toFixed(2)} added to your wallet.` });
    } else if (grant.kind === "bundle") {
      const b = bundleFor(grant.tier);
      if (!b) { console.warn("[freemius] unknown bundle tier", grant.tier); return; }
      await db.activateBundle(uid, {
        tier: b.id, cycle: grant.cycle, minutes: b.minutes, sms: b.sms,
        payMethod: "card", autoRenew: true, // Freemius runs the recurring charge
        amount: grant.cycle === "annual" ? b.annualTotal : b.monthly,
      });
      await db.logActivity(uid, { kind: "wallet", title: "Plan activated", body: `Your ${b.name} plan (${grant.cycle}) is now active.` });
    }
  } else if (p.type === "subscription.cancelled" || p.type === "subscription.renewal.failed") {
    await db.markSubscriptionPastDue(uid);
  }
  // subscription.created / subscription.updated are covered by payment.created.
}

/* ------------------------------------------------------------ static serving */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".map": "application/json", ".csv": "text/csv", ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".wasm": "application/wasm",
};

// Clean URLs → built HTML entries. Root is the marketing site; the app and the
// Control Hub live under /app and /admin.
const PAGE_ROUTES = {
  "/": "site.html",
  "/app": "index.html",
  "/admin": "admin.html",
};

async function tryFile(absPath) {
  try {
    const s = await stat(absPath);
    if (s.isFile()) return absPath;
  } catch { /* not found */ }
  return null;
}

/** Serve the built front-end from /dist. Returns true if it handled the request. */
async function serveStatic(req, res) {
  // strip query/hash, decode, and prevent path traversal
  let pathname = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  const clean = pathname.replace(/\/+$/, "") || "/";

  let filePath = null;
  if (PAGE_ROUTES[clean]) {
    filePath = join(DIST, PAGE_ROUTES[clean]);
  } else {
    // safe-join inside DIST
    const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const candidate = join(DIST, rel);
    if (candidate.startsWith(DIST)) filePath = await tryFile(candidate);
  }

  // SPA / unknown-route fallback → marketing site (its router is hash-based)
  if (!filePath) filePath = join(DIST, "site.html");

  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || "application/octet-stream";
    const cacheable = filePath.includes(`${join("dist", "assets")}`) || /\.(png|jpe?g|svg|webp|woff2?|ico)$/.test(filePath);
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": cacheable ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found. Did you run `npm run build`?");
  }
  return true;
}

const digits = (s) => (s ?? "").replace(/\D/g, "");

// Parse a "M:SS" / "H:MM:SS" call duration into billed minutes (rounded up per
// minute, min 1 for any connected call). Empty/"0:00" → 0 (nothing to meter).
const callMinutes = (dur) => {
  const s = String(dur || "").trim();
  if (!s) return 0;
  const parts = s.split(":").map((n) => parseInt(n, 10));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return 0;
  const sec = parts.reduce((acc, p) => acc * 60 + p, 0);
  return sec > 0 ? Math.ceil(sec / 60) : 0;
};
const shortTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const flagFor = (e164) => {
  const d = digits(e164);
  if (d.startsWith("1")) return "🇺🇸";
  if (d.startsWith("44")) return "🇬🇧";
  if (d.startsWith("92")) return "🇵🇰";
  if (d.startsWith("91")) return "🇮🇳";
  if (d.startsWith("971")) return "🇦🇪";
  if (d.startsWith("61")) return "🇦🇺";
  return "🌐";
};

const telnyxFetch = (path, init = {}) =>
  fetch(TELNYX + path, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

/* ------------------------------------------------------ WebRTC (browser voice)
 * Real in-browser calling uses the Telnyx WebRTC SDK, which logs in with an
 * ephemeral JWT minted here from a Credential Connection — the SIP password
 * NEVER reaches the browser. We resolve the connection once, then create (and
 * cache) one short-lived telephony credential + token, refreshing before expiry.
 */
// Find (or create) an enabled Outbound Voice Profile — REQUIRED for outbound
// calls. Without an OVP attached to the connection, Telnyx rejects the call.
async function ensureOutboundProfileId() {
  const r = await telnyxFetch("/outbound_voice_profiles?page[size]=1");
  const j = await r.json().catch(() => ({}));
  if (j?.data?.[0]?.id) return j.data[0].id;
  const cr = await telnyxFetch("/outbound_voice_profiles", {
    method: "POST", body: JSON.stringify({ name: "DGRINGO Voice" }),
  });
  const cj = await cr.json().catch(() => ({}));
  if (!cr.ok || !cj?.data?.id) throw new Error(cj?.errors?.[0]?.detail || "Could not create outbound voice profile");
  return cj.data.id;
}

// Resolve the credential connection used for the WebRTC softphone. We use a
// DEDICATED connection ("DGRINGO WebRTC") with an OVP attached so outbound
// calling works — without touching any pre-existing connection. Auto-created on
// first use; override with TELNYX_SIP_CONNECTION_ID.
let SIP_CONN = null;
const SIP_CONN_NAME = "DGRINGO WebRTC";
async function getSipConnectionId() {
  if (SIP_CONN) return SIP_CONN;
  if (process.env.TELNYX_SIP_CONNECTION_ID) return (SIP_CONN = process.env.TELNYX_SIP_CONNECTION_ID);
  // reuse ours if it already exists
  const list = await telnyxFetch("/credential_connections?page[size]=100");
  const lj = await list.json().catch(() => ({}));
  const existing = (lj.data || []).find((c) => c.connection_name === SIP_CONN_NAME);
  if (existing) return (SIP_CONN = existing.id);
  // create a dedicated credential connection with an OVP for outbound
  const ovp = await ensureOutboundProfileId();
  const rand = () => Math.random().toString(36).slice(2, 12);
  const cr = await telnyxFetch("/credential_connections", {
    method: "POST",
    body: JSON.stringify({
      connection_name: SIP_CONN_NAME,
      user_name: `dgringo${rand()}`,
      password: `Dg${rand()}${rand()}`,
    }),
  });
  const cj = await cr.json().catch(() => ({}));
  if (!cr.ok || !cj?.data?.id) throw new Error(cj?.errors?.[0]?.detail || "Could not create WebRTC connection");
  const newId = cj.data.id;
  // Attach the OVP so OUTBOUND works. Must be a NESTED PATCH — Telnyx silently
  // ignores `outbound_voice_profile_id` on the create body.
  await telnyxFetch(`/credential_connections/${newId}`, {
    method: "PATCH", body: JSON.stringify({ outbound: { outbound_voice_profile_id: ovp } }),
  }).catch(() => {});
  return (SIP_CONN = newId);
}

// The WebRTC client logs in with the credential connection's STATIC SIP
// username/password — NOT an on-demand telephony-credential token. Telnyx
// on-demand credentials are OUTBOUND-ONLY (inbound calls never ring them), so
// they broke incoming calls. Static credential-connection logins receive
// inbound. We set a DETERMINISTIC password (derived from AUTH_SECRET) on the
// connection so the server always knows it without persisting anything.
let SIP_CREDS = null;
async function ensureSipCreds() {
  if (SIP_CREDS) return SIP_CREDS;
  const connId = await getSipConnectionId();
  // Telnyx requires SIP username/password to be ALPHANUMERIC only (no symbols,
  // no spaces). Hex digests satisfy this.
  const login = "dgringowebrtc";
  const password = "Dg" + createHmac("sha256", process.env.AUTH_SECRET || "dgringo")
    .update("sip:" + connId).digest("hex").slice(0, 26);
  // Set the connection's SIP credentials to our known values (idempotent).
  const r = await telnyxFetch(`/credential_connections/${connId}`, {
    method: "PATCH", body: JSON.stringify({ user_name: login, password }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.errors?.[0]?.detail || "Could not set SIP credentials");
  }
  SIP_CREDS = { login, password };
  return SIP_CREDS;
}

/* Per-user WebRTC identity — each user gets their OWN Telnyx CREDENTIAL CONNECTION
 * (static username/password). This is deliberate: on-demand telephony credentials
 * are OUTBOUND-ONLY (inbound never rings them), which sent every incoming call to
 * voicemail even with the app open. A registered credential connection RECEIVES
 * inbound, so the TeXML <Dial><Sip> leg rings the right user's softphone. Creds
 * are deterministic (derived from AUTH_SECRET + uid) — nothing secret persisted. */
const userSipPassword = (uid) =>
  "Dg" + createHmac("sha256", process.env.AUTH_SECRET || "dgringo").update("sipuser:" + uid).digest("hex").slice(0, 26);

async function ensureUserSipCredential(uid) {
  const v = await db.getVoiceSettings(uid);
  const username = `dgringou${uid}`;            // Telnyx SIP usernames must be alphanumeric
  const password = userSipPassword(uid);
  // Reuse the stored per-user credential connection if it still exists.
  if (v.sipCredentialId && String(v.sipUsername || "").startsWith("dgringou")) {
    const chk = await telnyxFetch(`/credential_connections/${v.sipCredentialId}`).catch(() => null);
    if (chk && chk.ok) {
      await telnyxFetch(`/credential_connections/${v.sipCredentialId}`, {
        // sip_uri_calling_preference must be enabled or dialing sip:user@sip.telnyx.com
        // from the TeXML app is REJECTED with SIP 403 → the call never rings the app.
        method: "PATCH", body: JSON.stringify({ user_name: username, password, sip_uri_calling_preference: "unrestricted" }),
      }).catch(() => {}); // keep creds pinned to our known values (idempotent)
      return { credentialId: v.sipCredentialId, sipUsername: username, password };
    }
  }
  // Create a dedicated per-user credential connection (+ OVP so outbound works).
  const ovp = await ensureOutboundProfileId().catch(() => null);
  const cr = await telnyxFetch("/credential_connections", {
    method: "POST", body: JSON.stringify({ connection_name: `DGRINGO u${uid}`, user_name: username, password, sip_uri_calling_preference: "unrestricted" }),
  });
  const cj = await cr.json().catch(() => ({}));
  if (!cr.ok || !cj?.data?.id) throw new Error(cj?.errors?.[0]?.detail || "Could not create voice identity");
  const connId = cj.data.id;
  if (ovp) await telnyxFetch(`/credential_connections/${connId}`, {
    method: "PATCH", body: JSON.stringify({ outbound: { outbound_voice_profile_id: ovp } }),
  }).catch(() => {});
  await db.setSipCredential(uid, { sipUsername: username, sipCredentialId: connId });
  return { credentialId: connId, sipUsername: username, password };
}

/* --------------------------------------------------- incoming-call routing (TeXML)
 * Every owned number points its inbound at ONE TeXML application whose Voice URL
 * is /webhooks/texml here. On an inbound call we answer with TeXML that rings the
 * user's in-app WebRTC softphone first, then their forwarding cellphone, then
 * records voicemail — so a call reaches them whether or not the app is open. */
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || "https://digiringo.com").replace(/\/$/, "");
let TEXML_APP = null;
const TEXML_APP_NAME = "DGRINGO Inbound";
async function getTexmlAppId() {
  if (TEXML_APP) return TEXML_APP;
  if (process.env.TELNYX_TEXML_APP_ID) return (TEXML_APP = process.env.TELNYX_TEXML_APP_ID);
  const list = await telnyxFetch("/texml_applications?page[size]=100");
  const lj = await list.json().catch(() => ({}));
  const existing = (lj.data || []).find((a) => a.friendly_name === TEXML_APP_NAME);
  if (existing) return (TEXML_APP = existing.id);
  const cr = await telnyxFetch("/texml_applications", { method: "POST", body: JSON.stringify({
    friendly_name: TEXML_APP_NAME, voice_url: `${PUBLIC_BASE}/webhooks/texml`,
    voice_method: "post", active: true, anchorsite_override: "Latency",
  }) });
  const cj = await cr.json().catch(() => ({}));
  if (!cr.ok || !cj?.data?.id) throw new Error(cj?.errors?.[0]?.detail || "Could not create inbound app");
  return (TEXML_APP = cj.data.id);
}

const xmlEsc = (s) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
const texmlResponse = (inner) => `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;

/** The voicemail (or graceful goodbye) tail of an inbound flow. */
function voicemailTeXML(owner, to, from) {
  if (owner?.voicemailEnabled) {
    const cb = `${PUBLIC_BASE}/webhooks/texml/voicemail?to=${encodeURIComponent(to)}&from=${encodeURIComponent(from)}`;
    return texmlResponse(
      `  <Say voice="Polly.Joanna">You've reached ${xmlEsc(owner?.name ? owner.name.split(" ")[0] : "a DGRINGO customer")}. Please leave a message after the tone.</Say>\n` +
      `  <Record maxLength="120" playBeep="true" trim="trim-silence" recordingStatusCallback="${xmlEsc(cb)}" recordingStatusCallbackMethod="POST" />\n` +
      `  <Hangup/>`
    );
  }
  return texmlResponse(`  <Say voice="Polly.Joanna">This number is not available right now. Goodbye.</Say>\n  <Hangup/>`);
}

/** Build the TeXML for a given stage of the inbound ring chain. Stateless: the
 *  owner is re-resolved from `to` each hop, and `stage`/to/from ride the action URL. */
async function inboundTeXML({ stage, to, from }) {
  const owner = db ? await db.findNumberOwner(to).catch(() => null) : null;
  // Number isn't ours (or DB down) → straight to a graceful voicemail/goodbye.
  if (!owner) return texmlResponse(`  <Say voice="Polly.Joanna">This number is not available right now. Goodbye.</Say>\n  <Hangup/>`);

  const qs = (s) => `${PUBLIC_BASE}/webhooks/texml?stage=${s}&to=${encodeURIComponent(to)}&from=${encodeURIComponent(from)}`;

  // Stage 1: ring the in-app WebRTC softphone (if the user has a SIP identity).
  if (stage === "start" && owner.sipUsername) {
    return texmlResponse(
      `  <Dial timeout="30" answerOnBridge="true" callerId="${xmlEsc(from)}" action="${xmlEsc(qs("fwd"))}" method="POST">\n` +
      `    <Sip>sip:${xmlEsc(owner.sipUsername)}@sip.telnyx.com</Sip>\n` +
      `  </Dial>`
    );
  }
  // Stage 2: forward to the user's real cellphone (if set).
  if ((stage === "start" || stage === "fwd") && owner.forwardNumber) {
    return texmlResponse(
      `  <Dial timeout="25" callerId="${xmlEsc(to)}" action="${xmlEsc(qs("vm"))}" method="POST">\n` +
      `    <Number>${xmlEsc(owner.forwardNumber)}</Number>\n` +
      `  </Dial>`
    );
  }
  // Stage 3 (or nothing left to try): voicemail.
  return voicemailTeXML(owner, to, from);
}

/** Web-push an "incoming call" alert to a user's browsers (so a backgrounded /
 *  minimized tab still notifies — the WebRTC leg still rings the app if open). */
async function notifyIncomingCall(userId, from) {
  if (!db || !webPushConfigured()) return;
  try {
    const subs = await db.getPushSubscriptions(userId);
    await Promise.all(subs.map(async (s) => {
      const r = await sendPush(s, { type: "call", title: "Incoming call", body: `${from || "Someone"} is calling you`, from: from || "" });
      if (r.gone) await db.deletePushSubscription(s.endpoint).catch(() => {});
    }));
  } catch (e) { console.error("notifyIncomingCall:", e.message); }
}

/* ------------------------------------------------------ in-memory inbox store */
// key: `${ownedE164}|${contactE164}`  →  thread object
const threads = new Map();
let msgSeq = 0;

const keyOf = (owned, contact) => `${digits(owned)}|${digits(contact)}`;

function recordMessage({ owned, contact, direction, text, status, telnyxId }) {
  if (!owned || !contact) return;
  // Persist to the DB when available (survives restarts); else in-memory.
  if (db) {
    db.recordMessage({ owned, contact, direction, body: text, status, telnyxId }).catch((e) => console.error("db recordMessage:", e.message));
    return;
  }
  const k = keyOf(owned, contact);
  let t = threads.get(k);
  if (!t) {
    t = { id: `thr_${digits(owned)}_${digits(contact)}`, owned, contact, contact_flag: flagFor(contact), unread: 0, messages: [] };
    threads.set(k, t);
  }
  t.messages.push({
    id: telnyxId ?? `local_${++msgSeq}`,
    direction,
    text: text ?? "",
    status: status ?? (direction === "inbound" ? "delivered" : "sent"),
    time: shortTime(),
  });
  t.time = shortTime();
  if (direction === "inbound") t.unread += 1;
}

function updateStatus(telnyxId, status) {
  if (!telnyxId) return;
  if (db) { db.updateMessageStatus(telnyxId, status).catch(() => {}); return; }
  for (const t of threads.values()) {
    const m = t.messages.find((x) => x.id === telnyxId);
    if (m) { m.status = status; return; }
  }
}

// Resolve owned E.164 → Telnyx phone_number_id (cached 60s), so the app can
// match each thread to the right owned number (Conversation.numberId).
let idMap = new Map();
let idMapAt = 0;
async function ownedNumberId(e164) {
  if (Date.now() - idMapAt > 60_000) {
    try {
      const r = await telnyxFetch("/phone_numbers?page[size]=250");
      const j = await r.json();
      const next = new Map();
      for (const n of j.data ?? []) next.set(digits(n.phone_number), n.id);
      idMap = next; idMapAt = Date.now();
    } catch (e) { console.error("phone_numbers lookup failed:", e.message); }
  }
  return idMap.get(digits(e164)) ?? digits(e164); // fall back to E.164 digits
}

async function conversationsPayload() {
  const list = db ? await db.getThreads() : [...threads.values()];
  const out = [];
  for (const t of list) {
    out.push({
      id: `thr_${digits(t.owned)}_${digits(t.contact)}`,
      phone_number_id: await ownedNumberId(t.owned),
      contact: t.contact,
      contact_flag: flagFor(t.contact),
      unread: t.unread,
      time: t.time ?? shortTime(),
      messages: t.messages,
    });
  }
  return { data: out };
}

/* --------------------------------------------------------------- webhook in */
function handleWebhook(payload) {
  const ev = payload?.data ?? payload;
  const type = ev?.event_type ?? ev?.record_type;
  const p = ev?.payload ?? {};
  if (type === "message.received") {
    const contact = p.from?.phone_number;
    const owned = p.to?.[0]?.phone_number;
    recordMessage({ owned, contact, direction: "inbound", text: p.text, telnyxId: p.id });
    console.log(`📥 inbound SMS ${contact} → ${owned}`);
  } else if (type === "message.sent" || type === "message.finalized") {
    const status = p.to?.[0]?.status ?? "sent";
    updateStatus(p.id, status);
  } else if (type && String(type).startsWith("call.")) {
    // TEMP diagnostic: trace inbound call routing / hangup causes.
    console.log(`☎ ${type} dir=${p.direction || ""} state=${p.state || ""} from=${p.from || ""} to=${p.to || ""} cause=${p.hangup_cause || ""} sip=${p.sip_hangup_cause || ""}`);
  }
}

/* ------------------------------------------------------------------- routing */
createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");

  // 1) Telnyx webhooks (signature-verified when TELNYX_PUBLIC_KEY is set)
  if (req.url?.startsWith("/webhooks/telnyx")) {
    const body = await readBody(req);
    if (!verifyTelnyxWebhook(body, req.headers["telnyx-signature-ed25519"], req.headers["telnyx-timestamp"])) {
      console.warn("⚠ rejected webhook: invalid signature");
      return send(res, 401, { error: "invalid signature" });
    }
    try { handleWebhook(JSON.parse(body || "{}")); } catch (e) { console.error("webhook parse:", e.message); }
    return send(res, 200, { ok: true });
  }

  // 1b) Voicemail recording ready (Telnyx TeXML <Record> callback). Store it
  //     against the owner + surface it as an activity item. Checked BEFORE the
  //     generic /webhooks/texml route (more specific path first).
  if (req.url?.startsWith("/webhooks/texml/voicemail") && req.method === "POST") {
    const body = await readBody(req);
    try {
      const p = new URLSearchParams(body || "");
      const q = new URL(req.url, "http://x").searchParams;
      const to = q.get("to") || p.get("To") || "";
      const from = q.get("from") || p.get("From") || "";
      const url = p.get("RecordingUrl") || "";
      const duration = Number(p.get("RecordingDuration") || 0) || 0;
      const owner = db ? await db.findNumberOwner(to).catch(() => null) : null;
      if (owner && url) {
        await db.addVoicemail(owner.userId, { fromNumber: from, toNumber: to, recordingUrl: url, duration });
        await db.logActivity(owner.userId, { kind: "call", title: "New voicemail", body: `${from || "Unknown caller"} left a ${duration}s voicemail.` });
      }
    } catch (e) { console.error("voicemail cb:", e.message); }
    return send(res, 200, { ok: true });
  }

  // 1c) Inbound voice — Telnyx TeXML application Voice URL. Answers with TeXML
  //     that rings the in-app softphone → forwarding cellphone → voicemail. The
  //     same route serves the <Dial action> callbacks (advanced via ?stage=).
  if (req.url?.startsWith("/webhooks/texml")) {
    const body = await readBody(req);
    let xml;
    try {
      const p = new URLSearchParams(body || "");
      const q = new URL(req.url, "http://x").searchParams;
      const stage = q.get("stage") || "start";
      const to = q.get("to") || p.get("To") || "";
      const from = q.get("from") || p.get("From") || "";
      const dialStatus = p.get("DialCallStatus") || "";
      // TEMP diagnostic — trace inbound routing (why calls hit voicemail).
      const allParams = {}; for (const [k, val] of p) allParams[k] = val;
      const own = db ? await db.findNumberOwner(to).catch(() => null) : null;
      console.error(`☎ TEXML stage=${stage} to=${to} from=${from} dialStatus=${dialStatus} sip=${own?.sipUsername || "-"} fwd=${own?.forwardNumber || "-"} vm=${own?.voicemailEnabled} params=${JSON.stringify(allParams)}`);
      // On the first hop, web-push the owner so a backgrounded browser tab alerts.
      if (stage === "start" && own) notifyIncomingCall(own.userId, from).catch(() => {});
      // If a prior <Dial> leg was answered & completed, stop — don't fall through
      // to voicemail after a real conversation.
      if (dialStatus === "completed" || dialStatus === "answered") {
        xml = texmlResponse("  <Hangup/>");
      } else {
        xml = await inboundTeXML({ stage, to, from });
      }
    } catch (e) {
      console.error("texml:", e.message);
      xml = texmlResponse(`  <Say voice="Polly.Joanna">Sorry, something went wrong. Goodbye.</Say>\n  <Hangup/>`);
    }
    res.writeHead(200, { "Content-Type": "application/xml", "Access-Control-Allow-Origin": "*" });
    return res.end(xml);
  }

  // 2) Freemius (Merchant of Record) — the browser opens Freemius's hosted
  //    checkout; PAYMENTS are fulfilled here via signed webhooks.
  //
  //    GET  /api/freemius/config  — public product id + key + checkout id map so
  //         the browser can open the right overlay (server is source of truth;
  //         changing IDs needs no frontend rebuild).
  if (req.url?.startsWith("/api/freemius/config") && req.method === "GET") {
    if (!freemiusConfigured()) return send(res, 503, { error: "Payments are not configured yet" });
    return send(res, 200, { productId: fsProductId(), publicKey: fsPublicKey(), checkouts: fsCheckouts() });
  }
  //    POST /api/freemius/webhook — Freemius event. Verify the x-signature HMAC,
  //         claim the event id (idempotency), then fulfil. On a fulfilment error
  //         we release the claim and 500 so Freemius retries.
  if (req.url?.startsWith("/api/freemius/webhook") && req.method === "POST") {
    const raw = await readBody(req);
    if (!freemiusConfigured()) return send(res, 503, { error: "Payments are not configured yet" });
    if (!fsVerifyWebhook(raw, req.headers["x-signature"])) {
      console.warn("⚠ rejected Freemius webhook: invalid signature");
      return send(res, 401, { error: "invalid signature" });
    }
    let evt; try { evt = JSON.parse(raw || "{}"); } catch { return send(res, 400, { error: "bad JSON" }); }
    const parsed = fsParseEvent(evt);
    // TEMP diagnostic (remove after go-live): log the real Freemius payload shape
    // so parseEvent field paths can be confirmed against a live sandbox delivery.
    console.error("☰ [freemius] raw:", raw.slice(0, 1800));
    console.error("☰ [freemius] parsed:", JSON.stringify(parsed));
    // Only act on the events we handle; ack the rest so Freemius stops retrying.
    const HANDLED = new Set(["payment.created", "subscription.cancelled", "subscription.renewal.failed"]);
    if (!HANDLED.has(parsed.type)) return send(res, 200, { ok: true, ignored: parsed.type });
    if (!db) return send(res, 503, { error: "Database not configured" });
    let claimed = false;
    try {
      claimed = await db.recordFreemiusEvent(parsed.id);
      if (!claimed) return send(res, 200, { ok: true, duplicate: true }); // already handled
      await fulfilFreemius(parsed);
      return send(res, 200, { ok: true });
    } catch (e) {
      if (claimed) await db.unrecordFreemiusEvent(parsed.id); // let Freemius retry
      console.error("[freemius] fulfil failed:", e.message);
      return send(res, 500, { error: "fulfilment failed" });
    }
  }

  // 2c) Admin (Control Hub) auth — gates the dashboard behind a password.
  if (req.url?.startsWith("/api/admin/")) {
    if (req.url.startsWith("/api/admin/login") && req.method === "POST") {
      if (!ADMIN_PASSWORD) return send(res, 503, { error: "Admin login is not configured" });
      const body = await readBody(req);
      let pw = ""; try { pw = JSON.parse(body || "{}").password || ""; } catch { /* ignore */ }
      const ok = pw.length > 0 && timingSafeEqual(adminHmac(pw), adminHmac(ADMIN_PASSWORD));
      if (!ok) return send(res, 401, { error: "Invalid admin password" });
      return send(res, 200, { token: signAdminToken() });
    }
    if (req.url.startsWith("/api/admin/verify") && req.method === "GET") {
      return send(res, 200, { ok: verifyAdminToken(bearer(req)), role: "admin" });
    }
    // Team (agent) management — admin only.
    if (req.url.startsWith("/api/admin/agents")) {
      if (!verifyAdminToken(bearer(req))) return send(res, 401, { error: "Not authenticated" });
      if (!db) return send(res, 503, { error: "Database not configured" });
      if (req.method === "GET") { try { return send(res, 200, { agents: await db.listAgents() }); } catch (e) { return send(res, 500, { error: e.message }); } }
      if (req.method === "POST") {
        const body = await readBody(req); let d; try { d = JSON.parse(body || "{}"); } catch { d = {}; }
        try { const agent = await db.createAgent({ name: d.name, email: d.email, password: d.password }); return send(res, 200, { ok: true, agent }); }
        catch (e) { return send(res, e.status || 500, { error: e.message }); }
      }
      if (req.method === "DELETE") {
        const id = Number(new URL(req.url, "http://x").searchParams.get("id")) || 0;
        if (id) { try { await db.deleteAgent(id); } catch (e) { return send(res, 500, { error: e.message }); } }
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: "Method not allowed" });
    }
    return send(res, 404, { error: "Unknown admin route" });
  }

  // 2d) Team member (agent) auth — individual logins for the support console.
  if (req.url?.startsWith("/api/agent/")) {
    if (!db) return send(res, 503, { error: "Database not configured" });
    if (req.url.startsWith("/api/agent/login") && req.method === "POST") {
      const body = await readBody(req); let d; try { d = JSON.parse(body || "{}"); } catch { d = {}; }
      try { return send(res, 200, await db.loginAgent(d.email, d.password)); }
      catch (e) { return send(res, e.status || 401, { error: e.message }); }
    }
    if (req.url.startsWith("/api/agent/verify") && req.method === "GET") {
      const aid = db.verifyAgentToken(bearer(req));
      if (!aid) return send(res, 200, { ok: false });
      const a = await db.getAgent(aid).catch(() => null);
      return send(res, 200, { ok: !!a, role: "agent", name: a?.name || "Agent", agentId: aid });
    }
    return send(res, 404, { error: "Unknown agent route" });
  }

  // 2e) Live support chat. Customers (user token) talk to the team; the Control
  //     Hub / team members (admin or agent token) answer.
  if (req.url?.startsWith("/api/support")) {
    if (!db) return send(res, 503, { error: "Database not configured" });
    // Customer side — their own thread.
    if (req.url.startsWith("/api/support/messages")) {
      const uid = db.verifyToken(bearer(req));
      if (!uid) return send(res, 401, { error: "Not authenticated" });
      if (req.method === "GET") {
        try { return send(res, 200, { messages: await db.getSupportMessages(uid, { markReadFor: "user" }) }); }
        catch (e) { return send(res, 500, { error: e.message }); }
      }
      if (req.method === "POST") {
        const body = await readBody(req); let d; try { d = JSON.parse(body || "{}"); } catch { d = {}; }
        if (!d.body || !String(d.body).trim()) return send(res, 400, { error: "Message required" });
        try {
          await db.addSupportMessage(uid, { sender: "user", body: String(d.body).trim() });
          return send(res, 200, { ok: true, messages: await db.getSupportMessages(uid, { markReadFor: "user" }) });
        } catch (e) { return send(res, 500, { error: e.message }); }
      }
      return send(res, 405, { error: "Method not allowed" });
    }
    // Staff side — requires an admin or agent token.
    const staff = verifyAdminToken(bearer(req)) ? { role: "admin", agentId: null }
      : (db.verifyAgentToken(bearer(req)) ? { role: "agent", agentId: db.verifyAgentToken(bearer(req)) } : null);
    if (!staff) return send(res, 401, { error: "Not authenticated" });
    if (req.url.startsWith("/api/support/threads")) {
      try { return send(res, 200, { threads: await db.listSupportThreads() }); }
      catch (e) { return send(res, 500, { error: e.message }); }
    }
    if (req.url.startsWith("/api/support/thread")) {
      const userId = Number(new URL(req.url, "http://x").searchParams.get("userId")) || 0;
      if (!userId) return send(res, 400, { error: "userId required" });
      if (req.method === "GET") {
        try { return send(res, 200, { messages: await db.getSupportMessages(userId, { markReadFor: "agent" }) }); }
        catch (e) { return send(res, 500, { error: e.message }); }
      }
      if (req.method === "POST") {
        const body = await readBody(req); let d; try { d = JSON.parse(body || "{}"); } catch { d = {}; }
        if (!d.body || !String(d.body).trim()) return send(res, 400, { error: "Message required" });
        try {
          await db.addSupportMessage(userId, { sender: "agent", agentId: staff.agentId, body: String(d.body).trim() });
          try { await db.logActivity(userId, { kind: "system", title: "Support replied", body: String(d.body).trim().slice(0, 140) }); } catch { /* best effort */ }
          return send(res, 200, { ok: true, messages: await db.getSupportMessages(userId, { markReadFor: "agent" }) });
        } catch (e) { return send(res, 500, { error: e.message }); }
      }
      return send(res, 405, { error: "Method not allowed" });
    }
    return send(res, 404, { error: "Unknown support route" });
  }

  // 3) Auth + wallet (DB-backed): real register/login and persistent wallet.
  if (req.url?.startsWith("/api/auth/") || req.url?.startsWith("/api/wallet") || req.url?.startsWith("/api/subscription") || req.url?.startsWith("/api/activity")) {
    if (!db) return send(res, 503, { error: "Database not configured" });
    try {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      if (req.method === "POST" && req.url.startsWith("/api/auth/register")) {
        const result = await db.registerUser(data.email, data.password, data.name);
        // Email a verification link (best-effort — don't fail signup if mail is down).
        if (result.verifyToken) {
          const base = `https://${req.headers.host}`;
          try { await sendVerifyEmail(result.user.email, result.user.name, `${base}/?verify=${result.verifyToken}`); }
          catch (e) { console.error("verify email failed:", e.message); }
        }
        const { verifyToken, ...safe } = result; // never expose the token to the client
        return send(res, 200, safe);
      }
      if (req.method === "POST" && req.url.startsWith("/api/auth/verify")) {
        return send(res, 200, await db.verifyEmail(data.token));
      }
      if (req.method === "POST" && req.url.startsWith("/api/auth/login")) {
        return send(res, 200, await db.loginUser(data.email, data.password));
      }
      if (req.method === "POST" && req.url.startsWith("/api/auth/forgot")) {
        const r = await db.createResetToken(data.email);
        if (r) {
          const base = `https://${req.headers.host}`;
          try { await sendResetEmail(r.user.email, r.user.name, `${base}/?reset=${r.token}`); }
          catch (e) { console.error("reset email failed:", e.message); }
        }
        return send(res, 200, { ok: true }); // always 200 — don't reveal whether the email exists
      }
      if (req.method === "POST" && req.url.startsWith("/api/auth/reset")) {
        return send(res, 200, await db.resetPassword(data.token, data.password));
      }
      // Routes below require a valid token.
      const uid = db.verifyToken(bearer(req));
      if (!uid) return send(res, 401, { error: "Not authenticated" });
      if (req.method === "GET" && req.url.startsWith("/api/auth/me")) {
        return send(res, 200, await db.getUser(uid));
      }
      if (req.method === "POST" && req.url.startsWith("/api/auth/resend-verification")) {
        const r = await db.createVerifyToken(uid);
        if (r && r.token) {
          const base = `https://${req.headers.host}`;
          try { await sendVerifyEmail(r.user.email, r.user.name, `${base}/?verify=${r.token}`); }
          catch (e) { console.error("verify email failed:", e.message); }
        }
        return send(res, 200, { ok: true, alreadyVerified: !!(r && r.alreadyVerified) });
      }
      if (req.method === "GET" && req.url.startsWith("/api/wallet")) {
        return send(res, 200, await db.getWallet(uid));
      }
      if (req.method === "POST" && req.url.startsWith("/api/subscription/auto-renew")) {
        return send(res, 200, { subscription: await db.setAutoRenew(uid, data.on !== false) });
      }
      if (req.method === "GET" && req.url.startsWith("/api/subscription")) {
        return send(res, 200, { subscription: await db.getSubscription(uid) });
      }
      // Activity feed (persisted so it survives a refresh).
      if (req.method === "GET" && req.url.startsWith("/api/activity")) {
        return send(res, 200, { activity: await db.listActivity(uid) });
      }
      if (req.method === "POST" && req.url.startsWith("/api/activity/read")) {
        await db.markAllActivityRead(uid);
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && req.url.startsWith("/api/activity")) {
        await db.logActivity(uid, { kind: data.kind, title: data.title, body: data.body });
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "Unknown route" });
    } catch (e) {
      return send(res, e.status || 500, { error: e.message });
    }
  }

  // 3a) List the user's owned numbers + their plan's number-capacity.
  if (req.url?.startsWith("/api/numbers") && req.method === "GET") {
    if (!db) return send(res, 503, { error: "Database not configured" });
    const uid = db.verifyToken(bearer(req));
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    try {
      const [numbers, capacity] = await Promise.all([db.listNumbers(uid), db.numberCapacity(uid)]);
      return send(res, 200, { numbers, capacity });
    } catch (e) {
      return send(res, e.status || 500, { error: e.message });
    }
  }

  // 3b) Buy a number — server-orchestrated so it can't be bypassed. A number
  //     ALWAYS belongs to a plan: the user must have an active bundle. The first
  //     number on a plan is FREE (included); extra numbers cost the flat rental
  //     (plans.mjs) up to the plan's cap; beyond the cap they must upgrade. The
  //     server decides free-vs-paid and the amount — the client price is ignored.
  if (req.url?.startsWith("/api/numbers/buy") && req.method === "POST") {
    if (!db) return send(res, 503, { error: "Database not configured" });
    if (!KEY) return send(res, 503, { error: "Telephony not configured" });
    const uid = db.verifyToken(bearer(req));
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    const body = await readBody(req);
    let data; try { data = JSON.parse(body || "{}"); } catch { data = {}; }
    const phoneNumber = String(data.phoneNumber || "");
    const kind = data.kind === "tollfree" ? "tollfree" : "local";
    if (!phoneNumber) return send(res, 400, { error: "Invalid request" });

    // A plan is REQUIRED to hold a number. Enforce the plan's number-capacity:
    // first number free, extras at the rental rate, nothing beyond the cap.
    let cap;
    try { cap = await db.numberCapacity(uid); }
    catch (e) { return send(res, e.status || 500, { error: e.message }); }
    if (!cap.hasPlan) return send(res, 402, { error: "Choose a plan to get a number — every number belongs to a plan.", needsPlan: true });
    if (cap.atCap) return send(res, 403, { error: `You've reached your plan's limit of ${cap.max} numbers. Upgrade to add more.`, atCap: true });

    const free = !!cap.isFree;
    const amount = free ? 0 : numberPrice(kind);   // authoritative — never trust client
    const label = free ? `Number ${phoneNumber} (free with plan)` : `Extra number ${phoneNumber} (${kind})`;

    // 1) take payment for EXTRA numbers only (the included one is free). Extra
    //    numbers are billed to the WALLET — top it up via Freemius if it's short.
    let paid = { method: "included" };
    if (!free) {
      try { paid = await takePayment(uid, amount, label); }
      catch (e) { return send(res, e.status || 500, { error: e.message }); }
    }

    // 2) place the Telnyx order
    try {
      // Assign the number to the TeXML inbound app so incoming calls hit our
      // /webhooks/texml router (ring in-app → forward → voicemail). Falls back to
      // the WebRTC connection if the TeXML app can't be resolved.
      const voiceConn = await getTexmlAppId().catch(() =>
        getSipConnectionId().catch(() => process.env.VITE_TELNYX_CONNECTION_ID));
      const r = await telnyxFetch("/number_orders", { method: "POST", body: JSON.stringify({
        phone_numbers: [{ phone_number: phoneNumber }],
        messaging_profile_id: process.env.VITE_TELNYX_MESSAGING_PROFILE_ID,
        connection_id: voiceConn || process.env.VITE_TELNYX_CONNECTION_ID,
      }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.errors?.[0]?.detail || "Number order failed");
      // record ownership so plan-capacity counts this number
      const telnyxId = j?.data?.phone_numbers?.[0]?.id || "";
      try { await db.provisionNumber(uid, { e164: phoneNumber, kind, telnyxId, free }); } catch (e) { console.error("provisionNumber:", e.message); }
      await db.logActivity(uid, { kind: "number", title: "Number added", body: free ? `${phoneNumber} added free with your plan. Register it in Trust center to send SMS.` : `${phoneNumber} added for $${amount.toFixed(2)}/mo. Register it in Trust center to send SMS.` });
      const wallet = paid.wallet;
      const capacity = await db.numberCapacity(uid).catch(() => cap);
      return send(res, 200, { ok: true, order: j.data, wallet, free, capacity });
    } catch (e) {
      // 3) refund the paid extra number to the wallet if the order failed (free
      //    numbers took no money, so there's nothing to refund).
      let wallet;
      if (!free) { try { wallet = await db.creditWallet(uid, amount, `Refund — ${phoneNumber} order failed`); } catch { /* ignore */ } }
      return send(res, 502, { error: e.message, wallet });
    }
  }

  // 3c) Subscribe to a bundle (Starter/Business/Pro) FROM THE WALLET. Server sets
  //     the price from plans.mjs by tier+cycle and debits the prepaid wallet;
  //     auto-renew then draws from the wallet next cycle. Paying by CARD instead
  //     goes through Freemius's checkout (fulfilled by webhook → activateBundle),
  //     so this route is wallet-only. On activation failure the wallet is refunded.
  if (req.url?.startsWith("/api/bundles/subscribe") && req.method === "POST") {
    if (!db) return send(res, 503, { error: "Database not configured" });
    const uid = db.verifyToken(bearer(req));
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    const body = await readBody(req);
    let data; try { data = JSON.parse(body || "{}"); } catch { data = {}; }
    const cycle = data.cycle === "annual" ? "annual" : "monthly";
    const charge = bundleCharge(data.tier, cycle);  // authoritative price + bundle
    if (!charge) return send(res, 400, { error: "Unknown plan" });
    const { amount, bundle } = charge;
    const label = `${bundle.name} plan (${cycle})`;

    // 1) take payment from the wallet (402 if short → app prompts a Freemius top-up)
    let paid;
    try { paid = await takePayment(uid, amount, label); }
    catch (e) { return send(res, e.status || 500, { error: e.message }); }

    // 2) activate the subscription (wallet-funded, so it auto-renews from wallet)
    try {
      const subscription = await db.activateBundle(uid, {
        tier: bundle.id, cycle, minutes: bundle.minutes, sms: bundle.sms,
        payMethod: "wallet", autoRenew: data.autoRenew !== false, amount,
      });
      await db.logActivity(uid, { kind: "wallet", title: "Plan activated", body: `Your ${bundle.name} plan (${cycle}) is now active.` });
      return send(res, 200, { ok: true, subscription, wallet: paid.wallet });
    } catch (e) {
      // refund on activation failure
      let wallet;
      try { wallet = await db.creditWallet(uid, amount, `Refund — ${bundle.name} plan`); } catch { /* ignore */ }
      return send(res, 500, { error: e.message || "Could not activate plan", wallet });
    }
  }

  // 3d) WebRTC login token for the browser softphone. Auth required; mints an
  //     ephemeral JWT (SIP password stays server-side) + returns the user's own
  //     number to use as caller ID.
  if (req.url?.startsWith("/api/telnyx/rtc-token") && req.method === "POST") {
    if (!KEY) return send(res, 503, { error: "Telephony not configured" });
    const uid = db ? db.verifyToken(bearer(req)) : null;
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    try {
      let callerNumber = null, callerName = null;
      try {
        const nums = await db.listNumbers(uid);
        if (nums && nums[0]) callerNumber = nums[0].e164;
      } catch { /* no numbers yet — caller id falls back to connection default */ }
      try { const u = await db.getUser?.(uid); callerName = u?.name || null; } catch { /* optional */ }
      // Per-user CREDENTIAL CONNECTION login (static user/pass) so the client
      // both places AND receives calls — inbound rings the right user's app.
      try {
        const { sipUsername, password } = await ensureUserSipCredential(uid);
        console.error(`☎ RTC-TOKEN uid=${uid} sip=${sipUsername} caller=${callerNumber}`); // TEMP diagnostic
        return send(res, 200, { login: sipUsername, password, sipUsername, callerNumber, callerName });
      } catch (e) {
        // Fallback to the shared static credential so voice still works at all.
        console.error("rtc per-user cred failed, using shared:", e.message);
        const creds = await ensureSipCreds();
        return send(res, 200, { login: creds.login, password: creds.password, sipUsername: creds.login, callerNumber, callerName });
      }
    } catch (e) {
      return send(res, e.status || 502, { error: e.message || "Could not start voice session" });
    }
  }

  // 3e) Call history — persisted per-user so Recents survive a refresh (WebRTC
  //     calls aren't reliably in Telnyx CDRs). GET lists; POST logs one call.
  if (req.url?.startsWith("/api/calls")) {
    if (!db) return send(res, 503, { error: "Database not configured" });
    const uid = db.verifyToken(bearer(req));
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    if (req.method === "GET") {
      try { return send(res, 200, { calls: await db.listCalls(uid) }); }
      catch (e) { return send(res, 500, { error: e.message }); }
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      let d; try { d = JSON.parse(body || "{}"); } catch { d = {}; }
      try {
        const r = await db.logCall(uid, { contact: d.contact, direction: d.direction, status: d.status, duration: d.duration, via: d.via });
        // Meter connected-call minutes against the plan (overflow billed to wallet
        // by applyUsage). Missed/failed calls carry no duration → nothing metered.
        const mins = callMinutes(d.duration);
        let usage = null;
        if (mins > 0) { try { usage = await db.applyUsage(uid, { minutes: mins }); } catch (e) { console.error("applyUsage(call):", e.message); } }
        return send(res, 200, { ok: true, id: r.id, minutes: mins, usage });
      } catch (e) { return send(res, 500, { error: e.message }); }
    }
    return send(res, 405, { error: "Method not allowed" });
  }

  // 3f) Incoming-call delivery settings — the user's forwarding cellphone +
  //     voicemail toggle. GET reads; POST updates.
  if (req.url?.startsWith("/api/user/forward")) {
    if (!db) return send(res, 503, { error: "Database not configured" });
    const uid = db.verifyToken(bearer(req));
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    if (req.method === "GET") {
      try { const v = await db.getVoiceSettings(uid); return send(res, 200, { forwardNumber: v.forwardNumber, voicemailEnabled: v.voicemailEnabled }); }
      catch (e) { return send(res, 500, { error: e.message }); }
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      let d; try { d = JSON.parse(body || "{}"); } catch { d = {}; }
      try { const v = await db.setVoiceSettings(uid, { forwardNumber: d.forwardNumber, voicemailEnabled: d.voicemailEnabled }); return send(res, 200, { ok: true, ...v }); }
      catch (e) { return send(res, 500, { error: e.message }); }
    }
    return send(res, 405, { error: "Method not allowed" });
  }

  // 3g) Voicemails left when a call wasn't answered.
  if (req.url?.startsWith("/api/voicemails") && req.method === "GET") {
    if (!db) return send(res, 503, { error: "Database not configured" });
    const uid = db.verifyToken(bearer(req));
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    try { return send(res, 200, { voicemails: await db.listVoicemails(uid) }); }
    catch (e) { return send(res, 500, { error: e.message }); }
  }

  // 3h) Web Push — public VAPID key (for the browser to subscribe) + save the
  //     subscription. Lets a backgrounded browser tab get incoming-call alerts.
  if (req.url?.startsWith("/api/push/vapid") && req.method === "GET") {
    return send(res, 200, { publicKey: vapidPublicKey(), enabled: webPushConfigured() });
  }
  if (req.url?.startsWith("/api/push/subscribe") && req.method === "POST") {
    if (!db) return send(res, 503, { error: "Database not configured" });
    const uid = db.verifyToken(bearer(req));
    if (!uid) return send(res, 401, { error: "Not authenticated" });
    const body = await readBody(req);
    let d; try { d = JSON.parse(body || "{}"); } catch { d = {}; }
    const sub = d.subscription || d;
    const keys = sub.keys || {};
    if (!sub.endpoint || !keys.p256dh || !keys.auth) return send(res, 400, { error: "Invalid subscription" });
    try { await db.savePushSubscription(uid, { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }); return send(res, 200, { ok: true }); }
    catch (e) { return send(res, 500, { error: e.message }); }
  }

  // Anything that isn't an API/webhook route → serve the built front-end.
  if (!req.url?.startsWith(PREFIX)) return serveStatic(req, res);

  if (!KEY) return send(res, 503, { errors: [{ detail: "Telephony not configured (set TELNYX_API_KEY)" }] });

  // Require a valid user (or admin) token on the telephony proxy — without this,
  // anyone could call /api/telnyx/* and spend the PLATFORM's Telnyx money.
  const tnToken = bearer(req);
  const tnUid = db ? db.verifyToken(tnToken) : null;
  if (!tnUid && !verifyAdminToken(tnToken)) {
    return send(res, 401, { errors: [{ detail: "Authentication required" }] });
  }

  const path = req.url.slice(PREFIX.length); // e.g. "/messages" or "/messaging/conversations"

  // Block direct number ordering on the raw proxy — purchases MUST go through the
  // billed /api/numbers/buy route (which debits the wallet first, refunds on fail).
  if (req.method === "POST" && path.startsWith("/number_orders")) {
    return send(res, 403, { errors: [{ detail: "Use /api/numbers/buy to purchase numbers." }] });
  }

  // 2) Inbox: serve conversations from the store (DB when available)
  if (req.method === "GET" && path.startsWith("/messaging/conversations")) {
    return send(res, 200, await conversationsPayload());
  }

  // Mark a thread's inbound messages read (clears the unread badge).
  if (req.method === "POST" && path.startsWith("/messaging/read")) {
    const rb = await readBody(req);
    let d = {}; try { d = JSON.parse(rb || "{}"); } catch { /* ignore */ }
    if (db && d.owned && d.contact) await db.markThreadRead(d.owned, d.contact).catch(() => {});
    return send(res, 200, { ok: true });
  }

  // 2b) Document upload (regulatory KYC). The browser POSTs the raw file bytes
  //     (Content-Type = the file's type, ?filename=…); we wrap them in multipart
  //     form-data and forward to Telnyx /documents with the secret key injected.
  if (req.method === "POST" && path.startsWith("/documents")) {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const buf = Buffer.concat(chunks);
      const u = new URL(req.url, "http://x");
      const filename = u.searchParams.get("filename") || "document";
      const ctype = req.headers["content-type"] || "application/octet-stream";
      const fd = new FormData();
      fd.append("file", new Blob([buf], { type: ctype }), filename);
      const r = await fetch(`${TELNYX}/documents`, { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: fd });
      return send(res, r.status, (await r.text()) || "{}");
    } catch (e) {
      return send(res, 502, { errors: [{ detail: `Document upload failed: ${e.message}` }] });
    }
  }

  const body = await readBody(req);

  // 3) Everything else → forward to Telnyx with the secret key
  try {
    const r = await telnyxFetch(path, {
      method: req.method,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body || undefined,
    });
    const text = await r.text();

    // record outbound sends so they appear in the inbox immediately
    if (req.method === "POST" && path.startsWith("/messages") && r.ok) {
      try {
        const j = JSON.parse(text);
        const d = j.data ?? {};
        recordMessage({
          owned: d.from?.phone_number ?? JSON.parse(body || "{}").from,
          contact: d.to?.[0]?.phone_number ?? JSON.parse(body || "{}").to,
          direction: "outbound",
          text: d.text ?? JSON.parse(body || "{}").text,
          status: d.to?.[0]?.status ?? "queued",
          telnyxId: d.id,
        });
      } catch { /* ignore record errors */ }
      // Meter the send against the plan's SMS pool (overflow billed to wallet).
      // Best-effort — never blocks or fails the send.
      if (db && tnUid) db.applyUsage(tnUid, { sms: 1 }).catch(() => {});
    }
    send(res, r.status, text || "{}");
  } catch (e) {
    send(res, 502, { errors: [{ detail: `Proxy error: ${e.message}` }] });
  }
}).listen(PORT, () => {
  console.log(`DGRINGO server listening on :${PORT}`);
  console.log(`  site     : http://localhost:${PORT}/         (marketing)`);
  console.log(`  app      : http://localhost:${PORT}/app      (mobile app)`);
  console.log(`  admin    : http://localhost:${PORT}/admin    (Control Hub)`);
  console.log(`  app API  : http://localhost:${PORT}${PREFIX}  → ${TELNYX}`);
  console.log(`  webhooks : http://localhost:${PORT}/webhooks/telnyx`);

  // Auto-renew engine: charge due bundle subscriptions from the wallet, at boot
  // and hourly thereafter. Lazy renewal on access (getSubscription) covers the
  // gaps between ticks for active users.
  if (db?.renewDueSubscriptions) {
    const runRenewals = () => db.renewDueSubscriptions()
      .then((n) => { if (n) console.log(`↻ auto-renewed ${n} subscription(s)`); })
      .catch((e) => console.error("renewal sweep failed:", e.message));
    runRenewals();
    setInterval(runRenewals, 60 * 60 * 1000).unref?.();
  }
});
