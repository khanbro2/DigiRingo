/**
 * Stripe integration — hosted Checkout + webhook verification. Zero dependencies
 * (Stripe's REST API via fetch, form-encoded). Replaces Freemius as the card rail
 * so we can charge ANY amount: arbitrary wallet top-ups, a plan, a plan + number
 * in one payment, or an extra number.
 *
 * Env (server .env — SECRETS never reach the browser):
 *   STRIPE_SECRET_KEY       sk_test_… / sk_live_…   (API auth)
 *   STRIPE_PUBLISHABLE_KEY  pk_test_… / pk_live_…   (public; sent to the browser)
 *   STRIPE_WEBHOOK_SECRET   whsec_…                 (webhook signature)
 */
import crypto from "node:crypto";

// Read lazily — this module is imported before the server calls loadEnvFile().
const secret = () => process.env.STRIPE_SECRET_KEY || "";
export const publishableKey = () => process.env.STRIPE_PUBLISHABLE_KEY || "";
const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || "";
export const stripeConfigured = () => !!secret();

/** Flatten a nested object into Stripe's bracketed form-encoding. */
function toForm(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) toForm(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === "object") toForm(item, `${key}[${i}]`, out);
      else out.append(`${key}[${i}]`, String(item));
    });
    else out.append(key, String(v));
  }
  return out;
}

async function stripeApi(path, params) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: toForm(params).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Stripe error (${r.status})`);
  return j;
}

/**
 * Create a hosted Checkout Session.
 *   lineItems: [{ name, amountCents, quantity? }]
 *   metadata:  string map carried to the webhook (uid, kind, …)
 */
export async function createCheckoutSession({ lineItems, metadata, successUrl, cancelUrl, customerEmail }) {
  if (!stripeConfigured()) throw new Error("Stripe is not configured");
  const params = {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    payment_intent_data: { metadata },
    line_items: lineItems.map((li) => ({
      quantity: li.quantity || 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(li.amountCents),
        product_data: { name: li.name },
      },
    })),
  };
  if (customerEmail) params.customer_email = customerEmail;
  const session = await stripeApi("/checkout/sessions", params);
  return { id: session.id, url: session.url };
}

/** Verify a Stripe webhook signature (Stripe-Signature: t=…,v1=…). Returns the
 *  parsed event, or null if the signature/timestamp is invalid. */
export function verifyWebhook(rawBody, sigHeader) {
  const wh = webhookSecret();
  if (!wh || !sigHeader) return null;
  const parts = Object.fromEntries(String(sigHeader).split(",").map((p) => p.split("=")));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return null;
  // reject if the timestamp is older than 5 minutes (replay protection)
  const age = Math.floor(Date.now() / 1000) - Number(t);
  if (!(age < 300 && age > -300)) return null;
  const expected = crypto.createHmac("sha256", wh).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(v1), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(rawBody); } catch { return null; }
}
