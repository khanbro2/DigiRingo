/**
 * DGRINGO — Control Hub persistent settings + encrypted secret store.
 *
 * Backs the admin Payments / Integrations / Settings pages with REAL storage:
 *   - JSON config  → platform_settings key `cfg:<name>`   (plaintext JSON)
 *   - secrets      → platform_settings key `secret:<NAME>` (AES-256-GCM blob)
 *
 * Everything is cached in memory so reads are synchronous (getSecret/getJSON) —
 * this lets the live server prefer a DB-managed key over the env var WITHOUT an
 * async hop on the hot path. Until load() runs (or if the DB is down) the cache
 * is empty and callers fall back to process.env — i.e. exactly today's behaviour.
 *
 * Zero deps beyond mysql2 (already used by auth-db) + node:crypto. Standalone —
 * imports nothing from ours, so it can be imported by stripe.mjs / telnyx-proxy
 * without a cycle.
 */
import mysql from "mysql2/promise";
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// This module is imported STATICALLY (via stripe.mjs / telnyx-proxy) which runs
// BEFORE the server's process.loadEnvFile() — so read DB creds + AUTH_SECRET
// LAZILY (on first use), by which point the env is loaded. Creating the pool /
// deriving the key at module load would capture empty creds → "Access denied".
let _pool = null;
function pool() {
  if (!_pool) {
    _pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 2,
      charset: "utf8mb4_general_ci",
    });
  }
  return _pool;
}

// 32-byte key derived from AUTH_SECRET (lazy — see above). Changing AUTH_SECRET
// invalidates stored secrets (they fail to decrypt → treated as unset → env fallback).
let _encKey = null;
function encKey() {
  if (!_encKey) _encKey = scryptSync(process.env.AUTH_SECRET || "dev-insecure-change-me", "dg-settings-v1", 32);
  return _encKey;
}

function enc(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return "v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
}
function dec(blob) {
  try {
    if (!blob || !String(blob).startsWith("v1:")) return null;
    const raw = Buffer.from(String(blob).slice(3), "base64");
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
    const d = createDecipheriv("aes-256-gcm", encKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch { return null; }
}

/* In-memory cache of the whole tiny table (key → raw stored value). */
const cache = new Map();
let loaded = false;

/** Load (or reload) the settings table into the cache. Safe to call repeatedly. */
export async function load() {
  try {
    const [rows] = await pool().query("SELECT k, v FROM platform_settings");
    cache.clear();
    for (const r of rows) cache.set(r.k, r.v);
    loaded = true;
  } catch (e) {
    // DB not ready / table missing — leave cache empty so callers use env.
    console.error("settings-store load:", e.message);
  }
  return loaded;
}

async function setRaw(k, v) {
  await pool().query(
    "INSERT INTO platform_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
    [k, v]
  );
  cache.set(k, v);
}
async function delRaw(k) {
  await pool().query("DELETE FROM platform_settings WHERE k = ?", [k]);
  cache.delete(k);
}

/* ------------------------------------------------------------------ secrets */
/** Decrypted secret override (synchronous, from cache), or null if unset. */
export function getSecret(name) {
  return dec(cache.get(`secret:${name}`));
}
/** Store/replace an encrypted secret. Empty string clears it. */
export async function setSecret(name, plaintext) {
  const p = String(plaintext || "");
  if (!p) return delRaw(`secret:${name}`);
  return setRaw(`secret:${name}`, enc(p));
}
/** Non-sensitive metadata about a secret override: whether set + last 4 chars. */
export function secretMeta(name) {
  const v = getSecret(name);
  return v ? { set: true, last4: v.replace(/\s/g, "").slice(-4) } : { set: false };
}

/* --------------------------------------------------------------- json config */
export function getJSON(name, fallback = null) {
  const raw = cache.get(`cfg:${name}`);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
export async function setJSON(name, obj) {
  await setRaw(`cfg:${name}`, JSON.stringify(obj));
  return obj;
}

export function isLoaded() { return loaded; }
