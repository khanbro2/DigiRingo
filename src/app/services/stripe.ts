/**
 * Stripe (card rail) — CLIENT. Replaces the Freemius overlay with Stripe's hosted
 * Checkout: we ask the server for a Checkout Session URL (server sets all prices)
 * and redirect to it. All fulfilment (credit wallet / activate plan / provision
 * number) happens SERVER-SIDE via the webhook, so on return we just refresh state.
 */
import { API_ORIGIN } from "./origin";
import { getToken } from "./api";

export interface CheckoutGrant {
  kind: "topup" | "plan" | "plan_number" | "number";
  amount?: number;
  tier?: string;
  cycle?: "monthly" | "annual";
  phone?: string;
  numberKind?: "local" | "tollfree";
}

/** Start a Stripe Checkout and REDIRECT the browser to it. Resolves only if the
 *  session couldn't be created (otherwise the page navigates away). */
export async function startCheckout(g: CheckoutGrant): Promise<void> {
  const token = getToken();
  const r = await fetch(`${API_ORIGIN}/api/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(g),
  });
  const j = await r.json().catch(() => ({} as { url?: string; error?: string }));
  if (!r.ok || !j.url) throw new Error(j.error || "Could not start checkout");
  window.location.href = j.url;
}

let cachedReady = false;
let configPromise: Promise<boolean> | null = null;

/** Fetch Stripe availability once (cached). */
export function loadStripeConfig(): Promise<boolean> {
  if (configPromise) return configPromise;
  configPromise = fetch(`${API_ORIGIN}/api/stripe/config`)
    .then((r) => r.json())
    .then((c) => { cachedReady = !!c.enabled; return cachedReady; })
    .catch(() => false);
  return configPromise;
}

export const stripeReady = (): boolean => cachedReady;
