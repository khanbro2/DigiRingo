/**
 * DGRINGO plan catalog — SERVER SIDE (authoritative pricing).
 *
 * Mirrors src/app/core/plans.ts. The backend NEVER trusts a price sent by the
 * client: it looks the amount up here. Keep the two files in sync.
 */

/** Flat monthly rental for EXTRA numbers on a plan (beyond the free one). */
export const NUMBER_RENTAL = { local: 2.99, tollfree: 4.99 };

/**
 * When a plan's included minutes/SMS run out and the wallet can't cover the
 * pay-as-you-go overflow, this is the amount we auto-reload onto the wallet from
 * the user's card (once card-on-file billing / PayPal Business is live).
 */
export const PAYG_RELOAD = 3.99;

/**
 * Pay-as-you-go unit rates used to bill usage BEYOND a plan's included pool
 * (drawn from the wallet). Mirrors USAGE_RATES in src/app/core/plans.ts.
 */
export const OVERFLOW_RATES = { voice: 0.015, sms: 0.015 };

// Each bundle includes ONE free number and allows a capped number of extra
// numbers (billed at NUMBER_RENTAL) that all share the plan's minute/SMS pool.
export const BUNDLES = {
  starter: { id: "starter", name: "Starter", monthly: 9.99, annualTotal: 99, numberType: "local", minutes: 300, sms: 300, numbersIncluded: 0, maxNumbers: 3 },
  business: { id: "business", name: "Business", monthly: 24.99, annualTotal: 249, numberType: "local", minutes: 1000, sms: 1000, numbersIncluded: 0, maxNumbers: 5 },
  pro: { id: "pro", name: "Pro", monthly: 49.99, annualTotal: 499, numberType: "tollfree", minutes: 3000, sms: 3000, numbersIncluded: 0, maxNumbers: 10 },
};

/** Look up a bundle by tier id. Returns the bundle or null. */
export function bundleFor(tier) {
  return BUNDLES[String(tier)] || null;
}

/** Authoritative flat rental price for a number kind. Returns null if unknown. */
export function numberPrice(kind) {
  const p = NUMBER_RENTAL[String(kind)];
  return p > 0 ? p : null;
}

/** Authoritative bundle price for a tier + cycle. Returns { amount, bundle } or null. */
export function bundleCharge(tier, cycle) {
  const b = BUNDLES[String(tier)];
  if (!b) return null;
  const amount = cycle === "annual" ? b.annualTotal : b.monthly;
  return { amount, bundle: b, cycle: cycle === "annual" ? "annual" : "monthly" };
}
