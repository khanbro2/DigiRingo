/**
 * DIGIRINGO — database layer (MySQL/MariaDB) for real auth + persistent wallet.
 *
 * The only external dependency in the whole backend. Everything else (password
 * hashing, auth tokens) uses Node's built-in `node:crypto` — no bcrypt/jwt deps.
 *
 * Tables (created once via SQL):
 *   users(id, email UNIQUE, password_hash, name, wallet_balance, created_at)
 *   wallet_transactions(id, user_id, amount, label, kind, ref, created_at)
 *   subscriptions(id, user_id, tier, cycle, minutes_included, sms_included,
 *                 minutes_used, sms_used, status, period_end, pay_method,
 *                 auto_renew, renew_amount, created_at)
 *
 * Env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, AUTH_SECRET
 */
import mysql from "mysql2/promise";
import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from "node:crypto";
import { PAYG_RELOAD, OVERFLOW_RATES, NUMBER_RENTAL, bundleFor } from "./plans.mjs";
import { chargeOffSession, stripeConfigured } from "./stripe.mjs";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  charset: "utf8mb4_general_ci",
});

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-insecure-change-me";

/** Throws an Error carrying an HTTP status the router can use. */
function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function dbHealth() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

/* ----------------------------------------------------------- password hashing */
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(pw, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return test.length === orig.length && timingSafeEqual(test, orig);
}

/* --------------------------------------------------- stateless HMAC auth token */
const b64u = (s) => Buffer.from(s).toString("base64url");
function signToken(uid, days = 30) {
  const payload = b64u(JSON.stringify({ uid, exp: Date.now() + days * 86400000 }));
  const sig = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
/** Returns the user id from a valid token, or null. */
export function verifyToken(token) {
  if (!token) return null;
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!uid || Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ shaping */
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  walletBalance: Number(u.wallet_balance),
  emailVerified: !!Number(u.email_verified),
});

function relTime(d) {
  const t = d instanceof Date ? d : new Date(d);
  const diff = Date.now() - t.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return t.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* -------------------------------------------------------------------- auth */
export async function registerUser(email, password, name) {
  email = String(email || "").trim().toLowerCase();
  if (!email || !password) throw httpErr(400, "Email and password are required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpErr(400, "Enter a valid email");
  if (String(password).length < 6) throw httpErr(400, "Password must be at least 6 characters");

  const [dup] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
  if (dup.length) throw httpErr(409, "An account with this email already exists");

  const [r] = await pool.query(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    [email, hashPassword(password), String(name || "").trim()]
  );
  // Issue an email-verification token (valid 24h) so the caller can email a link.
  const verifyToken = randomBytes(32).toString("hex");
  await pool.query(
    "UPDATE users SET verify_token_hash = ?, verify_expires = ? WHERE id = ?",
    [sha256(verifyToken), Date.now() + 24 * 60 * 60 * 1000, r.insertId]
  );
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [r.insertId]);
  return { token: signToken(r.insertId), user: publicUser(rows[0]), verifyToken };
}

/* ------------------------------------------------------ email verification */
/** Consume a verification token and mark the email verified (expiry-checked). */
export async function verifyEmail(rawToken) {
  if (!rawToken) throw httpErr(400, "Invalid verification link");
  const [rows] = await pool.query(
    "SELECT id, email FROM users WHERE verify_token_hash = ? AND verify_expires > ?",
    [sha256(rawToken), Date.now()]
  );
  if (!rows[0]) throw httpErr(400, "This verification link is invalid or has expired");
  await pool.query(
    "UPDATE users SET email_verified = 1, verify_token_hash = '', verify_expires = 0 WHERE id = ?",
    [rows[0].id]
  );
  return { ok: true, email: rows[0].email };
}

/** Create a fresh verification token for a user (resend). Returns {user, token},
 *  or {alreadyVerified:true} if the email is already verified, or null if no user. */
export async function createVerifyToken(uid) {
  const [rows] = await pool.query("SELECT id, email, name, email_verified FROM users WHERE id = ?", [uid]);
  const u = rows[0];
  if (!u) return null;
  if (Number(u.email_verified)) return { alreadyVerified: true, user: { email: u.email, name: u.name } };
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "UPDATE users SET verify_token_hash = ?, verify_expires = ? WHERE id = ?",
    [sha256(token), Date.now() + 24 * 60 * 60 * 1000, uid]
  );
  return { user: { email: u.email, name: u.name }, token };
}

export async function loginUser(email, password) {
  email = String(email || "").trim().toLowerCase();
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  const u = rows[0];
  if (!u || !verifyPassword(password, u.password_hash)) {
    throw httpErr(401, "Invalid email or password");
  }
  if (String(u.status || "active") === "suspended") {
    throw httpErr(403, "This account has been suspended. Contact support.");
  }
  return { token: signToken(u.id), user: publicUser(u) };
}

export async function getUser(uid) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [uid]);
  if (!rows[0]) throw httpErr(404, "User not found");
  return publicUser(rows[0]);
}

/* ------------------------------------------------------ password reset */
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

/** Create a one-hour reset token for an email. Returns {user, token} or null if
 *  no such user (the caller still responds 200, to not reveal who has an account). */
export async function createResetToken(email) {
  email = String(email || "").trim().toLowerCase();
  const [rows] = await pool.query("SELECT id, email, name FROM users WHERE email = ?", [email]);
  const u = rows[0];
  if (!u) return null;
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE id = ?",
    [sha256(token), Date.now() + 60 * 60 * 1000, u.id]
  );
  return { user: { id: u.id, email: u.email, name: u.name }, token };
}

/** Consume a reset token and set a new password (one-time, expiry-checked). */
export async function resetPassword(rawToken, newPassword) {
  if (!rawToken) throw httpErr(400, "Invalid reset link");
  if (!newPassword || String(newPassword).length < 6) throw httpErr(400, "Password must be at least 6 characters");
  const [rows] = await pool.query(
    "SELECT id FROM users WHERE reset_token_hash = ? AND reset_expires > ?",
    [sha256(rawToken), Date.now()]
  );
  if (!rows[0]) throw httpErr(400, "This reset link is invalid or has expired");
  await pool.query(
    "UPDATE users SET password_hash = ?, reset_token_hash = '', reset_expires = 0 WHERE id = ?",
    [hashPassword(newPassword), rows[0].id]
  );
  return { ok: true };
}

/* ------------------------------------------------------------------ wallet */
export async function getWallet(uid) {
  const [u] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [uid]);
  const [tx] = await pool.query(
    "SELECT id, amount, label, kind, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 100",
    [uid]
  );
  return {
    balance: Number(u[0]?.wallet_balance ?? 0),
    txns: tx.map((t) => ({
      id: `tx_${t.id}`,
      amount: Number(t.amount),
      label: t.label,
      kind: t.kind,
      time: relTime(t.created_at),
    })),
  };
}

/** Credits the wallet atomically and records a transaction. Returns the wallet. */
export async function creditWallet(uid, amount, label = "Wallet top-up", ref = "") {
  amount = Number(amount);
  if (!(amount > 0)) throw httpErr(400, "Invalid amount");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, uid]);
    await conn.query(
      "INSERT INTO wallet_transactions (user_id, amount, label, kind, ref) VALUES (?, ?, ?, 'topup', ?)",
      [uid, amount, label, ref]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getWallet(uid);
}

/* ------------------------------------------------------------------- inbox */
const digits = (s) => (s ?? "").toString().replace(/\D/g, "");
const shortTimeOf = (d) => {
  const t = d instanceof Date ? d : new Date(d);
  return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** Persist a single SMS (inbound or outbound) so the inbox survives restarts. */
export async function recordMessage({ owned, contact, direction, body, status, telnyxId }) {
  if (!owned || !contact) return;
  await pool.query(
    "INSERT INTO messages (owned, contact, direction, body, status, telnyx_id) VALUES (?, ?, ?, ?, ?, ?)",
    [owned, contact, direction, body || "", status || (direction === "inbound" ? "delivered" : "sent"), telnyxId || ""]
  );
}

/** Update a message's delivery status by its Telnyx id (DLR webhook). */
export async function updateMessageStatus(telnyxId, status) {
  if (!telnyxId) return;
  await pool.query("UPDATE messages SET status = ? WHERE telnyx_id = ?", [status, telnyxId]);
}

/** Mark a thread's inbound messages as read (clears the unread badge). Matches on
 *  digits only so "+44 7700…" and "447700…" are treated the same. */
export async function markThreadRead(owned, contact) {
  await pool.query(
    `UPDATE messages SET status = 'read'
       WHERE REGEXP_REPLACE(owned, '[^0-9]', '') = REGEXP_REPLACE(?, '[^0-9]', '')
         AND REGEXP_REPLACE(contact, '[^0-9]', '') = REGEXP_REPLACE(?, '[^0-9]', '')
         AND direction = 'inbound' AND status <> 'read'`,
    [owned, contact]
  );
}

/** Group all messages into conversation threads (owned number ↔ contact). */
export async function getThreads() {
  const [rows] = await pool.query(
    "SELECT owned, contact, direction, body, status, telnyx_id, created_at FROM messages ORDER BY id ASC"
  );
  const map = new Map();
  for (const m of rows) {
    const k = `${m.owned}|${m.contact}`;
    let t = map.get(k);
    if (!t) { t = { owned: m.owned, contact: m.contact, unread: 0, time: "", messages: [] }; map.set(k, t); }
    t.messages.push({
      id: m.telnyx_id || `db_${digits(m.created_at)}_${t.messages.length}`,
      direction: m.direction, text: m.body || "", status: m.status, time: shortTimeOf(m.created_at),
    });
    t.time = shortTimeOf(m.created_at);
    if (m.direction === "inbound" && m.status !== "read") t.unread += 1;
  }
  return [...map.values()];
}

/** Record a card (PayPal) purchase in the history WITHOUT touching the wallet
 *  balance — the money went straight to the purchase, never into the wallet.
 *  Shows up as a spend in the transaction list. Returns the wallet. */
export async function recordCardCharge(uid, amount, label = "Card payment") {
  amount = Math.abs(Number(amount));
  if (!(amount > 0)) throw httpErr(400, "Invalid amount");
  await pool.query(
    "INSERT INTO wallet_transactions (user_id, amount, label, kind) VALUES (?, ?, ?, 'card')",
    [uid, -amount, label]
  );
  return getWallet(uid);
}

/* ----------------------------------------------------------- subscriptions */
const CYCLE_MS = { monthly: 30 * 86400000, annual: 365 * 86400000 };

const shapeSub = (s) => s ? {
  tier: s.tier,
  cycle: s.cycle,
  minutesIncluded: Number(s.minutes_included),
  smsIncluded: Number(s.sms_included),
  minutesUsed: Number(s.minutes_used),
  smsUsed: Number(s.sms_used),
  status: s.status,
  periodEnd: Number(s.period_end),
  payMethod: s.pay_method || "wallet",
  autoRenew: !!Number(s.auto_renew),
  renewAmount: Number(s.renew_amount || 0),
} : null;

/**
 * Try to auto-renew a due subscription by debiting the wallet for its renewal
 * amount. On success the period rolls forward and included-usage resets; on
 * failure (or if the wallet is short) the plan is marked 'past_due'. Returns the
 * refreshed row, or null if it could not be renewed.
 *
 * NOTE: renewals are funded from the WALLET. Unattended card charging needs a
 * PayPal billing agreement / Subscriptions API (a future upgrade); until then
 * users keep the wallet topped up (by card) and renewals draw from it.
 */
/* ------------------------------------------------------------ card on file */
/** The user's saved Stripe customer + masked default card (or null). */
export async function getBillingProfile(uid) {
  const [rows] = await pool.query("SELECT * FROM billing_profiles WHERE user_id = ?", [uid]);
  const r = rows[0];
  if (!r) return null;
  return {
    customerId: r.stripe_customer_id || "",
    paymentMethodId: r.payment_method_id || "",
    brand: r.brand || "", last4: r.last4 || "",
    expMonth: Number(r.exp_month) || 0, expYear: Number(r.exp_year) || 0,
  };
}

/** Upsert the saved customer/card. Card fields optional (customer-only save). */
export async function saveBillingProfile(uid, { customerId, paymentMethodId, brand, last4, expMonth, expYear } = {}) {
  await pool.query(
    `INSERT INTO billing_profiles (user_id, stripe_customer_id, payment_method_id, brand, last4, exp_month, exp_year)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         stripe_customer_id = IF(VALUES(stripe_customer_id) <> '', VALUES(stripe_customer_id), stripe_customer_id),
         payment_method_id  = IF(VALUES(payment_method_id)  <> '', VALUES(payment_method_id),  payment_method_id),
         brand     = IF(VALUES(payment_method_id) <> '', VALUES(brand),     brand),
         last4     = IF(VALUES(payment_method_id) <> '', VALUES(last4),     last4),
         exp_month = IF(VALUES(payment_method_id) <> '', VALUES(exp_month), exp_month),
         exp_year  = IF(VALUES(payment_method_id) <> '', VALUES(exp_year),  exp_year)`,
    [uid, customerId || "", paymentMethodId || "", brand || "", last4 || "", Number(expMonth) || 0, Number(expYear) || 0]
  );
}

/** Charge the user's saved card off-session. Returns true when the charge
 *  succeeded, false when there's no usable card or Stripe declined it. */
async function chargeSavedCard(uid, amount, description) {
  if (!stripeConfigured()) return false;
  const bp = await getBillingProfile(uid);
  if (!bp?.customerId || !bp?.paymentMethodId) return false;
  try {
    await chargeOffSession({
      customerId: bp.customerId, paymentMethodId: bp.paymentMethodId,
      amountCents: Math.round(amount * 100), description,
      metadata: { uid: String(uid), kind: "renewal" },
    });
    return true;
  } catch (e) {
    console.error(`[billing] off-session charge failed for uid=${uid}:`, e.message);
    return false;
  }
}

/** Atomic wallet debit; returns true when the balance covered it. */
async function debitIfEnough(uid, amount, label) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      "UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ? AND wallet_balance >= ?",
      [amount, uid, amount]
    );
    if (r.affectedRows === 0) { await conn.rollback(); return false; }
    await conn.query(
      "INSERT INTO wallet_transactions (user_id, amount, label, kind) VALUES (?, ?, ?, 'charge')",
      [uid, -amount, label]
    );
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Renew one due subscription. CARD-paid plans charge the saved card DIRECTLY
 *  (wallet untouched); wallet-paid plans debit the wallet. Either path falls
 *  back to the other before going past_due. */
async function tryRenew(s) {
  const amount = Number(s.renew_amount || 0);
  const c = s.cycle === "annual" ? "annual" : "monthly";
  const label = `Auto-renew — ${s.tier} plan (${c})`;

  let paid = false, how = "";
  const cardFirst = s.pay_method === "card";
  if (cardFirst && await chargeSavedCard(s.user_id, amount, label)) { paid = true; how = "card"; }
  if (!paid && await debitIfEnough(s.user_id, amount, label)) { paid = true; how = "wallet"; }
  if (!paid && !cardFirst && await chargeSavedCard(s.user_id, amount, label)) { paid = true; how = "card"; }

  if (!paid) {
    await pool.query("UPDATE subscriptions SET status = 'past_due' WHERE id = ?", [s.id]);
    await logActivity(s.user_id, { kind: "wallet", title: "Plan renewal failed", body: `We couldn't renew your ${s.tier} plan — your card was declined or missing and the wallet is short. Top up or update your card to restore service.` }).catch(() => {});
  } else {
    const nextEnd = Number(s.period_end) + (CYCLE_MS[c] || CYCLE_MS.monthly);
    await pool.query(
      "UPDATE subscriptions SET status = 'active', period_end = ?, minutes_used = 0, sms_used = 0 WHERE id = ?",
      [nextEnd, s.id]
    );
    const bp = how === "card" ? await getBillingProfile(s.user_id) : null;
    await logActivity(s.user_id, { kind: "wallet", title: "Plan auto-renewed", body: how === "card"
      ? `Your ${s.tier} plan renewed — $${amount.toFixed(2)} charged to your ${bp?.brand || "card"} •••• ${bp?.last4 || ""}.`
      : `Your ${s.tier} plan renewed — $${amount.toFixed(2)} paid from your wallet.` }).catch(() => {});
  }
  // Always return the refreshed row (active if renewed, past_due if it failed).
  const [rows] = await pool.query("SELECT * FROM subscriptions WHERE id = ?", [s.id]);
  return rows[0] || null;
}

/** Attach the plan's number-capacity (used / free-included / max) to a shaped
 *  subscription so the app knows whether the next number is free, a rental, or
 *  over the cap. No-op for a null subscription. */
async function attachCapacity(uid, shaped) {
  if (!shaped) return null;
  const b = bundleFor(shaped.tier);
  const used = await countNumbers(uid);
  return {
    ...shaped,
    numbersUsed: used,
    numbersIncluded: b ? b.numbersIncluded : 0,
    numbersMax: b ? b.maxNumbers : 0,
  };
}

/** The user's current subscription (active or past_due), or null. Active plans
 *  whose period has lapsed are auto-renewed from the wallet lazily on access. */
export async function getSubscription(uid) {
  const [rows] = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active','past_due') ORDER BY id DESC LIMIT 1",
    [uid]
  );
  const s = rows[0];
  if (!s) return null;
  // Only an ACTIVE plan whose period has lapsed triggers a renewal attempt. A
  // past_due plan is surfaced as-is so the app can prompt a top-up (recovery is
  // by re-subscribing, which supersedes the past_due row).
  if (s.status === "active" && Number(s.period_end) > 0 && Date.now() > Number(s.period_end)) {
    if (Number(s.auto_renew)) {
      const renewed = await tryRenew(s).catch(() => null);
      return attachCapacity(uid, shapeSub(renewed)); // active (rolled) or past_due
    }
    await pool.query("UPDATE subscriptions SET status = 'expired' WHERE id = ?", [s.id]);
    return null;
  }
  return attachCapacity(uid, shapeSub(s));
}

/** The raw ACTIVE subscription row (no renewal side-effects), or null. */
async function getActiveSubRow(uid) {
  const [rows] = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [uid]
  );
  return rows[0] || null;
}

/** The latest ACTIONABLE subscription (active/past_due/paused) — for the admin
 *  view + status changes, which need to see paused plans that getSubscription hides. */
async function latestActionableSub(uid) {
  const [rows] = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active','past_due','paused') ORDER BY id DESC LIMIT 1",
    [uid]
  );
  return rows[0] || null;
}

/**
 * Change a subscription's lifecycle state. `action`:
 *   cancel  → ends the plan now (→ pay-as-you-go); from active/past_due/paused
 *   pause   → temporarily suspends benefits (reversible); from active
 *   resume  → re-activates a paused plan
 * `by` ('user' | 'admin') only affects the activity-log wording. Returns the
 * user's subscription as the app would see it (null once cancelled/paused).
 */
export async function setSubscriptionStatus(uid, action, by = "user") {
  uid = Number(uid);
  if (action === "cancel") {
    const [r] = await pool.query(
      "UPDATE subscriptions SET status = 'cancelled', auto_renew = 0 WHERE user_id = ? AND status IN ('active','past_due','paused')",
      [uid]
    );
    if (r.affectedRows) await logActivity(uid, { kind: "system", title: "Plan cancelled", body: by === "admin" ? "Your plan was cancelled by support — you're now on pay-as-you-go." : "You cancelled your plan — you're now on pay-as-you-go." });
  } else if (action === "pause") {
    const [r] = await pool.query("UPDATE subscriptions SET status = 'paused' WHERE user_id = ? AND status = 'active'", [uid]);
    if (r.affectedRows) await logActivity(uid, { kind: "system", title: "Plan paused", body: "Your plan was paused by support. Contact us to resume it." });
  } else if (action === "resume") {
    const [r] = await pool.query("UPDATE subscriptions SET status = 'active' WHERE user_id = ? AND status = 'paused'", [uid]);
    if (r.affectedRows) await logActivity(uid, { kind: "system", title: "Plan resumed", body: "Your plan was resumed — benefits restored." });
  } else {
    throw httpErr(400, "Unknown action");
  }
  return getSubscription(uid);
}

/** Convenience: user-initiated self-cancel. */
export async function cancelSubscription(uid) {
  return setSubscriptionStatus(uid, "cancel", "user");
}

/* --------------------------------------------------------------- owned numbers */
/** How many active numbers the user owns (for plan-capacity enforcement). */
export async function countNumbers(uid) {
  const [r] = await pool.query("SELECT COUNT(*) AS c FROM numbers WHERE user_id = ? AND status = 'active'", [uid]);
  return Number(r[0]?.c || 0);
}

/** List the user's active numbers. */
export async function listNumbers(uid) {
  const [rows] = await pool.query(
    "SELECT id, e164, kind, telnyx_id, free, created_at FROM numbers WHERE user_id = ? AND status = 'active' ORDER BY id ASC",
    [uid]
  );
  return rows.map((n) => ({
    id: `num_${n.id}`, e164: n.e164, kind: n.kind,
    telnyxId: n.telnyx_id, free: !!Number(n.free), time: relTime(n.created_at),
  }));
}

/** Record a provisioned number against the user (idempotent on the E.164).
 *  The monthly rental renews 30 days out (see renewDueNumbers). */
export async function provisionNumber(uid, { e164, kind = "local", telnyxId = "", free = false }) {
  const renewsAt = Date.now() + 30 * 24 * 3600 * 1000;
  await pool.query(
    `INSERT INTO numbers (user_id, e164, kind, telnyx_id, free, status, renews_at) VALUES (?, ?, ?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), kind = VALUES(kind),
         telnyx_id = VALUES(telnyx_id), free = VALUES(free), status = 'active', renews_at = VALUES(renews_at)`,
    [uid, String(e164), kind === "tollfree" ? "tollfree" : "local", String(telnyxId || ""), free ? 1 : 0, renewsAt]
  );
}

/**
 * Release a number the user owns: marks it 'released' (dropped from the app,
 * stops the monthly rental) and returns its stored telnyx_id so the caller can
 * also free it on Telnyx. Matches on digits so formatting differences don't miss.
 * `by` ('user' | 'admin') only tunes the activity-log wording. Throws 404 if the
 * user doesn't own an active number matching `e164`.
 */
export async function releaseNumber(uid, e164, by = "user") {
  uid = Number(uid);
  const [rows] = await pool.query(
    `SELECT id, telnyx_id FROM numbers
       WHERE user_id = ? AND REGEXP_REPLACE(e164, '[^0-9]', '') = REGEXP_REPLACE(?, '[^0-9]', '')
         AND status IN ('active','past_due') ORDER BY id DESC LIMIT 1`,
    [uid, String(e164)]
  );
  const row = rows[0];
  if (!row) throw httpErr(404, "Number not found");
  await pool.query("UPDATE numbers SET status = 'released', renews_at = 0 WHERE id = ?", [row.id]);
  await logActivity(uid, { kind: "number", title: "Number released", body: by === "admin" ? `${e164} was released by support.` : `${e164} was released.` });
  return { ok: true, telnyxId: row.telnyx_id || "" };
}

/**
 * Monthly number rentals: every ACTIVE number whose renews_at has passed is
 * billed for the next month — saved card FIRST (direct), wallet as fallback.
 * NOTE: no plan includes a free number any more (numbersIncluded: 0 across all
 * bundles), so EVERY number is billed — including legacy rows still flagged
 * free=1. When neither payment rail works the number goes 'past_due': it
 * disappears from the app and stops receiving calls until the user pays
 * (support can reactivate).
 */
export async function renewDueNumbers() {
  const [due] = await pool.query(
    "SELECT * FROM numbers WHERE status = 'active' AND renews_at > 0 AND renews_at < ?",
    [Date.now()]
  );
  let renewed = 0;
  for (const n of due) {
    try {
      const nextAt = Number(n.renews_at) + 30 * 24 * 3600 * 1000;
      const amount = NUMBER_RENTAL[n.kind] ?? NUMBER_RENTAL.local;
      const label = `Number rental — ${n.e164}`;
      let paid = await chargeSavedCard(n.user_id, amount, label);
      if (!paid) paid = await debitIfEnough(n.user_id, amount, label);
      if (paid) {
        await pool.query("UPDATE numbers SET renews_at = ? WHERE id = ?", [nextAt, n.id]);
        await logActivity(n.user_id, { kind: "number", title: "Number renewed", body: `${n.e164} renewed for $${amount.toFixed(2)}/mo.` }).catch(() => {});
        renewed++;
      } else {
        await pool.query("UPDATE numbers SET status = 'past_due' WHERE id = ?", [n.id]);
        await logActivity(n.user_id, { kind: "number", title: "Number suspended — payment failed", body: `We couldn't collect $${amount.toFixed(2)} for ${n.e164}. Update your card or top up your wallet, then contact support to restore it.` }).catch(() => {});
      }
    } catch (e) { console.error("number renewal failed for", n.e164, e.message); }
  }
  return renewed;
}

/* -------------------------------------------------- incoming-call delivery */
const onlyDigitsPlus = (s) => { const d = String(s || "").replace(/[^\d+]/g, ""); return d ? (d.startsWith("+") ? d : `+${d}`) : ""; };

/** The user's incoming-call settings (forwarding number, voicemail, SIP id). */
export async function getVoiceSettings(uid) {
  const [rows] = await pool.query(
    "SELECT forward_number, voicemail_enabled, sip_username, sip_credential_id FROM users WHERE id = ?", [uid]
  );
  const r = rows[0] || {};
  return {
    forwardNumber: r.forward_number || "",
    voicemailEnabled: r.voicemail_enabled == null ? true : !!Number(r.voicemail_enabled),
    sipUsername: r.sip_username || "",
    sipCredentialId: r.sip_credential_id || "",
  };
}

/** Update the forwarding number + voicemail toggle. */
export async function setVoiceSettings(uid, { forwardNumber, voicemailEnabled }) {
  const fwd = onlyDigitsPlus(forwardNumber);
  await pool.query(
    "UPDATE users SET forward_number = ?, voicemail_enabled = ? WHERE id = ?",
    [fwd, voicemailEnabled === false ? 0 : 1, uid]
  );
  return { forwardNumber: fwd, voicemailEnabled: voicemailEnabled !== false };
}

/** Persist the user's per-user Telnyx SIP identity (WebRTC). */
export async function setSipCredential(uid, { sipUsername, sipCredentialId }) {
  await pool.query(
    "UPDATE users SET sip_username = ?, sip_credential_id = ? WHERE id = ?",
    [String(sipUsername || ""), String(sipCredentialId || ""), uid]
  );
}

/* ---------------------------------------------------- per-DEVICE SIP identities
 * Each signed-in device gets its OWN Telnyx credential connection so several can
 * stay registered at once (a single credential accepts only one registration and
 * the clients kick each other in a loop). The inbound TeXML then rings every
 * active device in parallel. See 014_sip_devices.sql. The table is self-created
 * on first use because Hostinger blocks the shell (migrations can't be run by hand). */
let sipDevicesReady = false;
async function ensureSipDevicesTable() {
  if (sipDevicesReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS sip_devices (
    id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT       NOT NULL,
    device_id         VARCHAR(64)  NOT NULL,
    sip_username      VARCHAR(64)  NOT NULL,
    sip_credential_id VARCHAR(64)  NOT NULL,
    platform          VARCHAR(16)  NOT NULL DEFAULT '',
    last_seen         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_device (user_id, device_id),
    UNIQUE KEY uq_sip_username (sip_username),
    INDEX idx_sipdev_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  sipDevicesReady = true;
}

/** The device's stored SIP identity, if we've already provisioned one. */
export async function getSipDevice(uid, deviceId) {
  await ensureSipDevicesTable();
  const [rows] = await pool.query(
    "SELECT device_id, sip_username, sip_credential_id, platform FROM sip_devices WHERE user_id = ? AND device_id = ? LIMIT 1",
    [uid, String(deviceId)]
  );
  const r = rows[0];
  return r ? { deviceId: r.device_id, sipUsername: r.sip_username, sipCredentialId: r.sip_credential_id, platform: r.platform || "" } : null;
}

/** Create/refresh a device's SIP identity and bump last_seen (registration ping). */
export async function upsertSipDevice(uid, { deviceId, sipUsername, sipCredentialId, platform }) {
  await ensureSipDevicesTable();
  await pool.query(
    `INSERT INTO sip_devices (user_id, device_id, sip_username, sip_credential_id, platform, last_seen)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE sip_username = VALUES(sip_username), sip_credential_id = VALUES(sip_credential_id),
       platform = VALUES(platform), last_seen = CURRENT_TIMESTAMP`,
    [uid, String(deviceId), String(sipUsername), String(sipCredentialId), String(platform || "")]
  );
}

/** All of a user's devices, most-recently-seen first (for LRU eviction + reuse). */
export async function listSipDevices(uid) {
  await ensureSipDevicesTable();
  const [rows] = await pool.query(
    "SELECT device_id, sip_username, sip_credential_id, platform, last_seen FROM sip_devices WHERE user_id = ? ORDER BY last_seen DESC",
    [uid]
  );
  return rows.map((r) => ({ deviceId: r.device_id, sipUsername: r.sip_username, sipCredentialId: r.sip_credential_id, platform: r.platform || "", lastSeen: r.last_seen }));
}

/** Drop a device row (used when evicting the least-recently-used credential). */
export async function deleteSipDevice(uid, deviceId) {
  await ensureSipDevicesTable();
  await pool.query("DELETE FROM sip_devices WHERE user_id = ? AND device_id = ?", [uid, String(deviceId)]);
}

/** SIP usernames to ring for an inbound call: every device seen recently, newest
 *  first, capped so a pile of stale devices can't bloat the parallel <Dial>. */
export async function getActiveSipUsernames(uid, { withinDays = 45, limit = 5 } = {}) {
  await ensureSipDevicesTable();
  const [rows] = await pool.query(
    `SELECT sip_username FROM sip_devices
       WHERE user_id = ? AND last_seen >= (NOW() - INTERVAL ? DAY)
       ORDER BY last_seen DESC LIMIT ?`,
    [uid, Number(withinDays), Number(limit)]
  );
  return rows.map((r) => r.sip_username).filter(Boolean);
}

/** Resolve who owns a DIGIRINGO number + their call-routing settings, for inbound
 *  TeXML routing. Matches on the E.164 of an active number. */
export async function findNumberOwner(e164) {
  const norm = onlyDigitsPlus(e164);
  if (!norm) return null;
  const [rows] = await pool.query(
    `SELECT u.id AS user_id, u.forward_number, u.voicemail_enabled, u.sip_username, u.name
       FROM numbers n JOIN users u ON u.id = n.user_id
      WHERE n.e164 = ? AND n.status = 'active' LIMIT 1`, [norm]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    userId: r.user_id,
    forwardNumber: r.forward_number || "",
    voicemailEnabled: r.voicemail_enabled == null ? true : !!Number(r.voicemail_enabled),
    sipUsername: r.sip_username || "",
    name: r.name || "",
  };
}

/** Store a voicemail recording + surface it as an activity item. */
export async function addVoicemail(uid, { fromNumber = "", toNumber = "", recordingUrl = "", duration = 0 }) {
  const [r] = await pool.query(
    "INSERT INTO voicemails (user_id, from_number, to_number, recording_url, duration) VALUES (?, ?, ?, ?, ?)",
    [uid, String(fromNumber), String(toNumber), String(recordingUrl || ""), Number(duration) || 0]
  );
  return { id: `vm_${r.insertId}` };
}

/** The user's voicemails, newest first. */
export async function listVoicemails(uid, limit = 100) {
  const [rows] = await pool.query(
    "SELECT id, from_number, to_number, recording_url, duration, is_read, created_at FROM voicemails WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    [uid, limit]
  );
  return rows.map((v) => ({
    id: `vm_${v.id}`, from: v.from_number, to: v.to_number,
    url: v.recording_url || "", duration: Number(v.duration) || 0,
    read: !!Number(v.is_read), time: relTime(v.created_at),
  }));
}

/* ------------------------------------------------------------------- calls */
/** Persist a finished call so the Calls log survives a refresh. */
export async function logCall(uid, { contact, direction = "outgoing", status = "", duration = "", via = "" }) {
  const [r] = await pool.query(
    "INSERT INTO call_logs (user_id, contact, direction, status, duration, via_e164) VALUES (?, ?, ?, ?, ?, ?)",
    [uid, String(contact || ""), direction, String(status || ""), String(duration || ""), String(via || "")]
  );
  return { id: `call_${r.insertId}` };
}

/** The user's recent calls, newest first. */
export async function listCalls(uid, limit = 100) {
  const [rows] = await pool.query(
    "SELECT id, contact, direction, status, duration, via_e164, created_at FROM call_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    [uid, limit]
  );
  return rows.map((c) => ({
    id: `call_${c.id}`, contact: c.contact, direction: c.direction,
    status: c.status, duration: c.duration, via: c.via_e164, time: relTime(c.created_at),
  }));
}

/**
 * Number capacity for the user's ACTIVE plan. Returns whether they can add a
 * number, and whether the NEXT one is free (included) or a paid rental.
 *   { hasPlan, tier, used, included, max, isFree, atCap, numberType }
 * hasPlan=false means no active bundle — a plan is required to hold a number.
 */
export async function numberCapacity(uid) {
  const sub = await getActiveSubRow(uid);
  if (!sub) return { hasPlan: false };
  const b = bundleFor(sub.tier);
  if (!b) return { hasPlan: false };
  const used = await countNumbers(uid);
  return {
    hasPlan: true, tier: sub.tier, used,
    included: b.numbersIncluded, max: b.maxNumbers,
    isFree: used < b.numbersIncluded,
    atCap: used >= b.maxNumbers,
    numberType: b.numberType,
  };
}

/* --------------------------------------------------------------- usage metering */
/**
 * Record usage against the active plan and bill any overflow (beyond the
 * included pool) to the wallet at pay-as-you-go rates. Best-effort: never throws
 * for a caller in a hot path. Returns flags the app uses to alert the user.
 *   { hasPlan, nearLimit, overLimit, walletShort, cost }
 *
 * NOTE: overflow is drawn from the WALLET. When the wallet can't cover it we set
 * walletShort — that's where a card auto-reload (PAYG_RELOAD) will kick in once
 * card-on-file billing (PayPal Business) is live; until then the app alerts the
 * user to top up / upgrade.
 */
export async function applyUsage(uid, { minutes = 0, sms = 0 } = {}) {
  const sub = await getActiveSubRow(uid);
  if (!sub) {
    // No plan → PURE pay-as-you-go: every unit billed to the wallet (previously
    // un-metered — free calls). walletShort mirrors the overflow path below.
    const cost = +(Number(minutes || 0) * OVERFLOW_RATES.voice + Number(sms || 0) * OVERFLOW_RATES.sms).toFixed(2);
    let walletShort = false;
    if (cost > 0) {
      const bits = [minutes ? `${minutes} min` : "", sms ? `${sms} SMS` : ""].filter(Boolean).join(" + ");
      try { await debitWallet(uid, cost, `Pay-as-you-go — ${bits}`); }
      catch {
        // Wallet short → auto-reload from the saved card, then retry the debit.
        try { await reloadWalletFromCard(uid); await debitWallet(uid, cost, `Pay-as-you-go — ${bits}`); }
        catch { walletShort = true; }
      }
    }
    return { hasPlan: false, nearLimit: false, overLimit: false, walletShort, cost };
  }
  const prevMin = Number(sub.minutes_used), prevSms = Number(sub.sms_used);
  const incMin = Number(sub.minutes_included), incSms = Number(sub.sms_included);
  const newMin = prevMin + Number(minutes || 0);
  const newSms = prevSms + Number(sms || 0);
  await pool.query("UPDATE subscriptions SET minutes_used = ?, sms_used = ? WHERE id = ?", [newMin, newSms, sub.id]);

  // Charge only the NEW overflow units this call added (units past the pool).
  const chargeMin = Math.max(0, newMin - incMin) - Math.max(0, prevMin - incMin);
  const chargeSms = Math.max(0, newSms - incSms) - Math.max(0, prevSms - incSms);
  const cost = +(chargeMin * OVERFLOW_RATES.voice + chargeSms * OVERFLOW_RATES.sms).toFixed(2);
  let walletShort = false;
  if (cost > 0) {
    const bits = [chargeMin ? `${chargeMin} min` : "", chargeSms ? `${chargeSms} SMS` : ""].filter(Boolean).join(" + ");
    try { await debitWallet(uid, cost, `Pay-as-you-go — ${bits}`); }
    catch {
      // Wallet short → auto-reload from the saved card, then retry the debit.
      try { await reloadWalletFromCard(uid); await debitWallet(uid, cost, `Pay-as-you-go — ${bits}`); }
      catch { walletShort = true; }
    }
  }
  const pctMin = incMin > 0 ? newMin / incMin : 0;
  const pctSms = incSms > 0 ? newSms / incSms : 0;
  const nearLimit = (pctMin >= 0.8 && pctMin < 1) || (pctSms >= 0.8 && pctSms < 1);
  const overLimit = newMin > incMin || newSms > incSms;
  return { hasPlan: true, nearLimit, overLimit, walletShort, cost };
}

/**
 * How many more seconds of talk-time this account can AFFORD right now, pooled
 * across every concurrent call/profile: plan minutes left + wallet-funded
 * overflow minutes (at the PAYG voice rate). `liveSec` is the elapsed time of
 * calls currently in progress (all browsers/profiles), so two simultaneous
 * calls drain the same pool. Used to gate new calls and to cut running ones.
 */
export async function voiceRemainingSec(uid, liveSec = 0) {
  const sub = await getActiveSubRow(uid);
  const planSec = sub
    ? Math.max(0, (Number(sub.minutes_included) - Number(sub.minutes_used))) * 60
    : 0;
  const [u] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [uid]);
  const balance = Number(u[0]?.wallet_balance ?? 0);
  const walletSec = Math.max(0, Math.floor((balance / OVERFLOW_RATES.voice) * 60));
  // A saved card extends the budget by one auto-reload — the overflow engine
  // recharges the wallet from it, so don't cut callers who CAN pay.
  let cardSec = 0;
  try {
    const bp = await getBillingProfile(uid);
    if (bp?.paymentMethodId) cardSec = Math.floor((PAYG_RELOAD / OVERFLOW_RATES.voice) * 60);
  } catch { /* card check is best-effort */ }
  return Math.max(0, planSec + walletSec + cardSec - Math.max(0, Math.floor(liveSec)));
}

/**
 * Auto-reload the wallet from the user's saved card when overflow can't be
 * covered (wired to PAYG_RELOAD). Uses the card-on-file; throws when there is
 * no saved card or Stripe declines, so callers fall back to alerting the user.
 */
export async function reloadWalletFromCard(uid, amount = PAYG_RELOAD) {
  const ok = await chargeSavedCard(uid, amount, `Wallet auto-reload $${Number(amount).toFixed(2)}`);
  if (!ok) throw httpErr(402, "Card auto-reload failed — top up your wallet or update your card");
  return creditWallet(uid, amount, `Auto-reload from card $${Number(amount).toFixed(2)}`);
}

/**
 * Batch renewal: charge every active auto-renew subscription whose period has
 * ended. Called on a timer + at boot by the server. Returns the number renewed.
 */
export async function renewDueSubscriptions() {
  const [due] = await pool.query(
    "SELECT * FROM subscriptions WHERE status = 'active' AND auto_renew = 1 AND period_end > 0 AND period_end < ?",
    [Date.now()]
  );
  let renewed = 0;
  for (const s of due) {
    try { const r = await tryRenew(s); if (r && r.status === "active") renewed++; }
    catch (e) { console.error("renew failed for sub", s.id, e.message); }
  }
  return renewed;
}

/** Turn auto-renew on/off for the user's active (or past_due) plan. */
export async function setAutoRenew(uid, on) {
  await pool.query(
    "UPDATE subscriptions SET auto_renew = ? WHERE user_id = ? AND status IN ('active','past_due')",
    [on ? 1 : 0, uid]
  );
  return getSubscription(uid);
}

/** Activate (or replace) the user's bundle. Any prior active plan is superseded.
 *  Does NOT charge — the caller charges (wallet or card) first. Stores the pay
 *  method + renewal amount so the plan can auto-renew from the wallet. */
export async function activateBundle(uid, { tier, cycle, minutes, sms, payMethod = "wallet", autoRenew = true, amount = 0 }) {
  const c = cycle === "annual" ? "annual" : "monthly";
  const periodEnd = Date.now() + (CYCLE_MS[c] || CYCLE_MS.monthly);
  const pm = payMethod === "card" ? "card" : "wallet";
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE subscriptions SET status = 'replaced' WHERE user_id = ? AND status IN ('active','past_due')", [uid]);
    await conn.query(
      `INSERT INTO subscriptions
         (user_id, tier, cycle, minutes_included, sms_included, status, period_end, pay_method, auto_renew, renew_amount)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [uid, String(tier), c, Number(minutes) || 0, Number(sms) || 0, periodEnd, pm, autoRenew ? 1 : 0, Number(amount) || 0]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getSubscription(uid);
}

/** Debits the wallet if funds suffice (atomic). Throws 402 if insufficient. */
export async function debitWallet(uid, amount, label = "Charge") {
  amount = Number(amount);
  if (!(amount > 0)) throw httpErr(400, "Invalid amount");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      "UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ? AND wallet_balance >= ?",
      [amount, uid, amount]
    );
    if (r.affectedRows === 0) {
      await conn.rollback();
      throw httpErr(402, "Insufficient wallet balance");
    }
    await conn.query(
      "INSERT INTO wallet_transactions (user_id, amount, label, kind) VALUES (?, ?, ?, 'charge')",
      [uid, -amount, label]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getWallet(uid);
}

/* ------------------------------------------------------------ Freemius (MoR) */
/** Look up a user id by email (Freemius webhooks identify the buyer by email). */
export async function getUserByEmail(email) {
  email = String(email || "").trim().toLowerCase();
  if (!email) return null;
  const [rows] = await pool.query("SELECT id, email, name FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

/**
 * Idempotency guard for Freemius webhooks — Freemius may deliver the same event
 * more than once. Returns TRUE the first time an event id is seen (caller should
 * process it) and FALSE on any repeat (caller should skip). Relies on the
 * PRIMARY KEY of freemius_events to reject duplicates atomically.
 */
export async function recordFreemiusEvent(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return true; // unidentifiable event — process but can't dedupe
  try {
    const [r] = await pool.query("INSERT INTO freemius_events (event_id) VALUES (?)", [id]);
    return r.affectedRows === 1;
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") return false; // already handled
    throw e;
  }
}

/** Release a claimed event id so a failed fulfilment can be retried by Freemius. */
export async function unrecordFreemiusEvent(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return;
  try { await pool.query("DELETE FROM freemius_events WHERE event_id = ?", [id]); } catch { /* best-effort */ }
}

/** Flag the user's active plan past-due (Freemius cancel / renewal failure). */
export async function markSubscriptionPastDue(uid) {
  await pool.query(
    "UPDATE subscriptions SET status = 'past_due' WHERE user_id = ? AND status = 'active'",
    [uid]
  );
  return getSubscription(uid);
}

/* --------------------------------------------------------------- activity feed */
/** Append an activity item for a user (persisted so it survives a refresh).
 *  Best-effort for callers in hot paths — swallow errors, never block the action. */
export async function logActivity(uid, { kind = "system", title, body = "" } = {}) {
  if (!uid || !title) return;
  try {
    await pool.query(
      "INSERT INTO activity_log (user_id, kind, title, body) VALUES (?, ?, ?, ?)",
      [uid, String(kind).slice(0, 32), String(title).slice(0, 191), String(body || "")]
    );
  } catch (e) { console.error("logActivity:", e.message); }
}

/** The user's recent activity, newest first (shaped for the app). */
export async function listActivity(uid, limit = 100) {
  const [rows] = await pool.query(
    "SELECT id, kind, title, body, is_read, created_at FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    [uid, limit]
  );
  return rows.map((a) => ({
    id: `act_${a.id}`, kind: a.kind, title: a.title, body: a.body || "",
    time: relTime(a.created_at), read: !!Number(a.is_read),
  }));
}

/** Mark all of the user's activity as read (clears the badge). */
export async function markAllActivityRead(uid) {
  await pool.query("UPDATE activity_log SET is_read = 1 WHERE user_id = ? AND is_read = 0", [uid]);
}

/* ------------------------------------------------------ live support chat */
/** Append a message to a customer's support thread. `sender` is 'user' or
 *  'agent'; agent messages carry the replying agent's id. */
export async function addSupportMessage(userId, { sender = "user", agentId = null, body }) {
  if (!userId || !body) return null;
  const isAgent = sender === "agent";
  const [r] = await pool.query(
    "INSERT INTO support_messages (user_id, sender, agent_id, body, read_by_user, read_by_agent) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, isAgent ? "agent" : "user", isAgent ? agentId : null, String(body).slice(0, 4000), isAgent ? 0 : 1, isAgent ? 1 : 0]
  );
  return { id: `sm_${r.insertId}` };
}

/** A customer's full support thread (oldest first). `markReadFor` clears unread
 *  from the other party's perspective ('user' clears agent msgs, 'agent' clears
 *  the customer's msgs). */
export async function getSupportMessages(userId, { markReadFor } = {}) {
  const [rows] = await pool.query(
    `SELECT m.id, m.sender, m.agent_id, m.body, m.created_at, a.name AS agent_name
       FROM support_messages m LEFT JOIN agents a ON a.id = m.agent_id
      WHERE m.user_id = ? ORDER BY m.id ASC`, [userId]
  );
  if (markReadFor === "user") await pool.query("UPDATE support_messages SET read_by_user = 1 WHERE user_id = ? AND sender = 'agent' AND read_by_user = 0", [userId]);
  if (markReadFor === "agent") await pool.query("UPDATE support_messages SET read_by_agent = 1 WHERE user_id = ? AND sender = 'user' AND read_by_agent = 0", [userId]);
  return rows.map((m) => ({
    id: `sm_${m.id}`, sender: m.sender, agentName: m.agent_name || null,
    body: m.body, time: relTime(m.created_at),
  }));
}

/** Unread agent replies for a customer (app badge). */
export async function supportUnreadForUser(userId) {
  const [r] = await pool.query("SELECT COUNT(*) AS c FROM support_messages WHERE user_id = ? AND sender = 'agent' AND read_by_user = 0", [userId]);
  return Number(r[0]?.c || 0);
}

/** All support threads for the Control Hub inbox — one row per customer, newest
 *  activity first, with the last message + how many of their messages are unread. */
export async function listSupportThreads() {
  const [rows] = await pool.query(
    `SELECT m.user_id, u.name, u.email, MAX(m.id) AS last_id,
            SUM(CASE WHEN m.sender = 'user' AND m.read_by_agent = 0 THEN 1 ELSE 0 END) AS unread
       FROM support_messages m JOIN users u ON u.id = m.user_id
      GROUP BY m.user_id, u.name, u.email
      ORDER BY last_id DESC`
  );
  const out = [];
  for (const r of rows) {
    const [last] = await pool.query("SELECT sender, body, created_at FROM support_messages WHERE id = ?", [r.last_id]);
    const l = last[0] || {};
    out.push({
      userId: r.user_id, name: r.name || "Customer", email: r.email || "",
      unread: Number(r.unread) || 0, lastSender: l.sender || "user",
      lastBody: l.body || "", time: relTime(l.created_at),
    });
  }
  return out;
}

/* ------------------------------------------------------ team (agent) accounts */
function signAgentToken(aid, days = 30) {
  const payload = b64u(JSON.stringify({ aid, exp: Date.now() + days * 86400000 }));
  const sig = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
/** Returns the agent id from a valid agent token, or null. */
export function verifyAgentToken(token) {
  if (!token) return null;
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { aid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!aid || Date.now() > exp) return null;
    return aid;
  } catch { return null; }
}

export async function createAgent({ name, email, password }) {
  email = String(email || "").trim().toLowerCase();
  if (!email || !password) throw httpErr(400, "Email and password are required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpErr(400, "Enter a valid email");
  if (String(password).length < 6) throw httpErr(400, "Password must be at least 6 characters");
  const [dup] = await pool.query("SELECT id FROM agents WHERE email = ?", [email]);
  if (dup.length) throw httpErr(409, "A team member with this email already exists");
  const [r] = await pool.query("INSERT INTO agents (name, email, password_hash) VALUES (?, ?, ?)",
    [String(name || "").slice(0, 120), email, hashPassword(password)]);
  return { id: r.insertId, name: name || "", email };
}

export async function listAgents() {
  const [rows] = await pool.query("SELECT id, name, email, active, created_at FROM agents ORDER BY id ASC");
  return rows.map((a) => ({ id: a.id, name: a.name, email: a.email, active: !!Number(a.active), time: relTime(a.created_at) }));
}

export async function setAgentActive(id, active) {
  await pool.query("UPDATE agents SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
}

export async function deleteAgent(id) {
  await pool.query("DELETE FROM agents WHERE id = ?", [id]);
}

export async function loginAgent(email, password) {
  email = String(email || "").trim().toLowerCase();
  const [rows] = await pool.query("SELECT * FROM agents WHERE email = ?", [email]);
  const a = rows[0];
  if (!a || !Number(a.active) || !verifyPassword(password, a.password_hash)) throw httpErr(401, "Invalid email or password");
  return { token: signAgentToken(a.id), agent: { id: a.id, name: a.name, email: a.email } };
}

export async function getAgent(id) {
  const [rows] = await pool.query("SELECT id, name, email, active FROM agents WHERE id = ?", [id]);
  const a = rows[0];
  if (!a) return null;
  return { id: a.id, name: a.name, email: a.email, active: !!Number(a.active) };
}

/* ------------------------------------------------- web push subscriptions */
export async function savePushSubscription(uid, { endpoint, p256dh, auth } = {}) {
  if (!uid || !endpoint || !p256dh || !auth) return;
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [uid, String(endpoint).slice(0, 512), String(p256dh).slice(0, 191), String(auth).slice(0, 191)]
  );
}

export async function getPushSubscriptions(uid) {
  const [rows] = await pool.query("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", [uid]);
  return rows.map((r) => ({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
}

export async function deletePushSubscription(endpoint) {
  if (!endpoint) return;
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [String(endpoint)]);
}

/* --------------------------------------- native (FCM) device push tokens */
export async function savePushToken(uid, token, platform = "android") {
  if (!uid || !token) return;
  await pool.query(
    `INSERT INTO device_tokens (user_id, token, platform) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)`,
    [uid, String(token).slice(0, 255), String(platform || "android").slice(0, 16)]
  );
}

export async function getPushTokens(uid) {
  const [rows] = await pool.query("SELECT token, platform FROM device_tokens WHERE user_id = ?", [uid]);
  return rows.map((r) => ({ token: r.token, platform: r.platform }));
}

/** Remove a dead token (FCM returned UNREGISTERED/NOT_FOUND). */
export async function deletePushToken(token) {
  if (!token) return;
  await pool.query("DELETE FROM device_tokens WHERE token = ?", [String(token)]);
}

/* ================================================================= *
 *  Control Hub (admin) — cross-user aggregates for managing clients. *
 *  Every function here is admin-only; the router gates them behind   *
 *  verifyAdminToken. They read the SAME tables the app writes, so    *
 *  the dashboard shows real customers, real wallets, real numbers.   *
 * ================================================================= */

/** All customer accounts (newest first) with plan, number count and balance.
 *  `q` filters by name/email; empty q returns everyone up to `limit`. */
export async function adminListUsers({ q = "", limit = 500 } = {}) {
  const like = `%${String(q || "").trim()}%`;
  const hasQ = String(q || "").trim() !== "";
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.name, u.wallet_balance, u.status, u.email_verified, u.created_at,
            (SELECT COUNT(*) FROM numbers n WHERE n.user_id = u.id AND n.status = 'active') AS numbers,
            (SELECT s.tier FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('active','past_due')
               ORDER BY s.id DESC LIMIT 1) AS tier
       FROM users u
      ${hasQ ? "WHERE u.email LIKE ? OR u.name LIKE ?" : ""}
      ORDER BY u.id DESC LIMIT ?`,
    hasQ ? [like, like, Number(limit)] : [Number(limit)]
  );
  return rows.map((u) => ({
    id: u.id,
    name: u.name || "—",
    email: u.email,
    plan: u.tier ? u.tier.charAt(0).toUpperCase() + u.tier.slice(1) : "Free",
    numbers: Number(u.numbers) || 0,
    balance: Number(u.wallet_balance) || 0,
    status: String(u.status || "active"),
    verified: !!Number(u.email_verified),
    joined: relTime(u.created_at),
  }));
}

/** Full detail for one customer — profile, wallet + ledger, numbers, plan,
 *  and recent activity. Powers the admin "View customer" drawer. */
export async function adminGetUser(uid) {
  uid = Number(uid);
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [uid]);
  const u = rows[0];
  if (!u) throw httpErr(404, "User not found");
  const [wallet, numbers, activity, subRow] = await Promise.all([
    getWallet(uid),
    listNumbers(uid),
    listActivity(uid, 50),
    latestActionableSub(uid),
  ]);
  return {
    id: u.id,
    name: u.name || "—",
    email: u.email,
    status: String(u.status || "active"),
    verified: !!Number(u.email_verified),
    joined: relTime(u.created_at),
    wallet,               // { balance, txns[] }
    numbers,              // [{ e164, kind, ... }]
    activity,             // [{ title, body, time, ... }]
    subscription: shapeSub(subRow),
  };
}

/** Admin wallet adjustment. `amount` > 0 credits, < 0 debits. Records a
 *  wallet_transaction AND an activity-log line the customer can see. */
export async function adminAdjustWallet(uid, amount, label = "") {
  uid = Number(uid);
  amount = Number(amount);
  if (!amount) throw httpErr(400, "Amount is required");
  const note = String(label || "").trim();
  let wallet;
  if (amount > 0) {
    wallet = await creditWallet(uid, amount, note || "Admin credit", "admin");
    await logActivity(uid, { kind: "wallet", title: `Wallet credited $${amount.toFixed(2)}`, body: note });
  } else {
    wallet = await debitWallet(uid, -amount, note || "Admin adjustment");
    await logActivity(uid, { kind: "wallet", title: `Wallet adjusted -$${(-amount).toFixed(2)}`, body: note });
  }
  return wallet;
}

/** Suspend or reactivate an account. A suspended account cannot sign in. */
export async function adminSetUserStatus(uid, status) {
  uid = Number(uid);
  status = status === "suspended" ? "suspended" : "active";
  await pool.query("UPDATE users SET status = ? WHERE id = ?", [status, uid]);
  await logActivity(uid, {
    kind: "system",
    title: status === "suspended" ? "Account suspended" : "Account reactivated",
    body: status === "suspended" ? "Sign-in disabled by an administrator." : "Access restored by an administrator.",
  });
  return { ok: true, status };
}

/** Every provisioned number across all users (with owner). */
export async function adminListNumbers({ q = "", limit = 1000 } = {}) {
  const like = `%${String(q || "").trim()}%`;
  const hasQ = String(q || "").trim() !== "";
  const [rows] = await pool.query(
    `SELECT n.id, n.e164, n.kind, n.status, n.free, n.created_at, u.name AS owner, u.email
       FROM numbers n JOIN users u ON u.id = n.user_id
      WHERE n.status IN ('active','past_due')
      ${hasQ ? "AND (n.e164 LIKE ? OR u.name LIKE ? OR u.email LIKE ?)" : ""}
      ORDER BY n.id DESC LIMIT ?`,
    hasQ ? [like, like, like, Number(limit)] : [Number(limit)]
  );
  return rows.map((n) => ({
    id: `num_${n.id}`,
    number: n.e164,
    owner: n.owner || "—",
    email: n.email,
    kind: n.kind === "tollfree" ? "Toll-free" : "Local",
    status: n.status === "active" ? "active" : "past_due",
    free: !!Number(n.free),
    time: relTime(n.created_at),
  }));
}

/** The full platform wallet ledger (all users), newest first. */
export async function adminListTransactions({ limit = 500 } = {}) {
  const [rows] = await pool.query(
    `SELECT t.id, t.amount, t.label, t.kind, t.created_at, u.name AS user, u.email
       FROM wallet_transactions t JOIN users u ON u.id = t.user_id
      ORDER BY t.id DESC LIMIT ?`,
    [Number(limit)]
  );
  return rows.map((t) => ({
    id: `tx_${t.id}`,
    user: t.user || "—",
    email: t.email,
    label: t.label || "",
    kind: t.kind || "charge",
    amount: Number(t.amount),
    time: relTime(t.created_at),
  }));
}

/** Billing detail — real subscriber counts per plan + recent plan activations
 *  (used in place of the old fake "invoices"). */
export async function adminBilling() {
  const [counts] = await pool.query(
    "SELECT tier, COUNT(*) AS c FROM subscriptions WHERE status = 'active' GROUP BY tier"
  );
  const planCounts = {};
  for (const r of counts) planCounts[String(r.tier || "").toLowerCase()] = Number(r.c) || 0;
  const [subs] = await pool.query(
    `SELECT s.id, s.tier, s.cycle, s.renew_amount, s.status, s.created_at, u.name, u.email
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      ORDER BY s.id DESC LIMIT 20`
  );
  const invoices = subs.map((s) => ({
    id: `SUB-${s.id}`,
    user: s.name || "—",
    email: s.email,
    period: `${(s.tier || "").charAt(0).toUpperCase() + (s.tier || "").slice(1)} · ${s.cycle || "monthly"}`,
    amount: Number(s.renew_amount) || 0,
    status: s.status || "active",
  }));
  return { planCounts, invoices };
}

/** Platform KPIs + chart series, all computed live from the DB. */
export async function adminKpis() {
  const [uRows] = await pool.query("SELECT COUNT(*) AS c FROM users");
  const [nRows] = await pool.query("SELECT COUNT(*) AS c FROM numbers WHERE status = 'active'");
  const [mRows] = await pool.query(
    "SELECT COALESCE(SUM(CASE WHEN cycle = 'yearly' THEN renew_amount/12 ELSE renew_amount END),0) AS v FROM subscriptions WHERE status = 'active'"
  );
  const [sRows] = await pool.query("SELECT COUNT(*) AS c FROM messages WHERE created_at >= (NOW() - INTERVAL 7 DAY)");
  const [bRows] = await pool.query("SELECT COALESCE(SUM(wallet_balance),0) AS v FROM users");
  const [spRows] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE status = 'suspended'");
  const users = uRows[0], nums = nRows[0], mrr = mRows[0], sms = sRows[0], bal = bRows[0], susp = spRows[0];
  const [msgSeries] = await pool.query(
    `SELECT DATE_FORMAT(created_at,'%a') AS d, DATE(created_at) AS day, COUNT(*) AS sms
       FROM messages WHERE created_at >= (NOW() - INTERVAL 7 DAY)
      GROUP BY day, d ORDER BY day ASC`
  );
  const [revSeries] = await pool.query(
    `SELECT DATE_FORMAT(created_at,'%b') AS m, DATE_FORMAT(created_at,'%Y-%m') AS ym, COALESCE(SUM(amount),0) AS rev
       FROM wallet_transactions WHERE kind = 'topup' AND created_at >= (NOW() - INTERVAL 6 MONTH)
      GROUP BY ym, m ORDER BY ym ASC`
  );
  return {
    totalUsers: Number(users.c) || 0,
    activeNumbers: Number(nums.c) || 0,
    mrr: Math.round(Number(mrr.v) || 0),
    smsSent7d: Number(sms.c) || 0,
    walletTotal: Number(bal.v) || 0,
    suspended: Number(susp.c) || 0,
    messages7d: msgSeries.map((r) => ({ d: r.d, sms: Number(r.sms) || 0 })),
    revenue6m: revSeries.map((r) => ({ m: r.m, rev: Math.round(Number(r.rev) || 0) })),
  };
}
