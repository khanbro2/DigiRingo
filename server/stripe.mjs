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
import * as settings from "./settings-store.mjs";

// Read lazily — this module is imported before the server calls loadEnvFile().
// A key saved via the Control Hub (encrypted in the DB) takes precedence over the
// env var; if none is saved (cache empty / DB down) we fall back to env — i.e.
// today's behaviour, so this can never take a working key away.
const secret = () => settings.getSecret("STRIPE_SECRET_KEY") || process.env.STRIPE_SECRET_KEY || "";
export const publishableKey = () => settings.getSecret("STRIPE_PUBLISHABLE_KEY") || process.env.STRIPE_PUBLISHABLE_KEY || "";
const webhookSecret = () => settings.getSecret("STRIPE_WEBHOOK_SECRET") || process.env.STRIPE_WEBHOOK_SECRET || "";
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

/** GET a Stripe object (payment intent, payment method, setup intent, …). */
export async function stripeGet(path) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Stripe error (${r.status})`);
  return j;
}

/** Create (or reuse) a Stripe Customer so cards can be saved against them. */
export async function createCustomer({ email, name, metadata }) {
  return stripeApi("/customers", { email, name, metadata });
}

/** Hosted Checkout in SETUP mode — saves/replaces a card, charges nothing. */
export async function createSetupSession({ customerId, metadata, successUrl, cancelUrl }) {
  if (!stripeConfigured()) throw new Error("Stripe is not configured");
  const session = await stripeApi("/checkout/sessions", {
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
  return { id: session.id, url: session.url };
}

/** Charge a saved card off-session (renewals). Throws if the charge fails. */
export async function chargeOffSession({ customerId, paymentMethodId, amountCents, description, metadata }) {
  if (!stripeConfigured()) throw new Error("Stripe is not configured");
  return stripeApi("/payment_intents", {
    amount: Math.round(amountCents),
    currency: "usd",
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: "true",
    confirm: "true",
    description,
    metadata,
  });
}

/** Masked card details {brand,last4,expMonth,expYear,pmId} from a PaymentIntent
 *  or SetupIntent id — for showing "VISA •••• 4242" and saving the default card. */
export async function cardFromIntent(intentId) {
  const isSetup = String(intentId).startsWith("seti_");
  const intent = await stripeGet(`/${isSetup ? "setup_intents" : "payment_intents"}/${intentId}`);
  const pmId = intent.payment_method;
  if (!pmId) return null;
  const pm = await stripeGet(`/payment_methods/${pmId}`);
  const c = pm.card || {};
  return { pmId, brand: c.brand || "", last4: c.last4 || "", expMonth: c.exp_month || 0, expYear: c.exp_year || 0 };
}

/**
 * Create a hosted Checkout Session.
 *   lineItems: [{ name, amountCents, quantity? }]
 *   metadata:  string map carried to the webhook (uid, kind, …)
 */
export async function createCheckoutSession({ lineItems, metadata, successUrl, cancelUrl, customerEmail, customerId }) {
  if (!stripeConfigured()) throw new Error("Stripe is not configured");
  const params = {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    // save the card for off-session renewals (auto-renew charges it directly)
    payment_intent_data: { metadata, setup_future_usage: "off_session" },
    line_items: lineItems.map((li) => ({
      quantity: li.quantity || 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(li.amountCents),
        product_data: { name: li.name },
      },
    })),
  };
  if (customerId) params.customer = customerId;         // reuse the saved customer
  else {
    params.customer_creation = "always";                // create one to attach the card to
    if (customerEmail) params.customer_email = customerEmail;
  }
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
