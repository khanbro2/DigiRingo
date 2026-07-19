/**
 * DIGIRINGO plan catalog — the app's canonical pricing (mirrors server/plans.mjs
 * and the marketing site's src/site/data.ts). Prices are in USD.
 *
 * Two ways to pay for service:
 *   • A BUNDLE (Starter / Business / Pro) — a fixed monthly or annual fee that
 *     includes a number plus a pool of minutes + SMS.
 *   • PAY-AS-YOU-GO — no bundle: rent a number at the flat monthly rate and pay
 *     per use (USAGE_RATES), funded from the wallet.
 *
 * Either purchase can be paid two ways: from the prepaid wallet balance, or
 * directly by card (PayPal). The SERVER is the source of truth for the amount —
 * these values must match server/plans.mjs.
 */

export type BundleId = "starter" | "business" | "pro";
export type BillingCycle = "monthly" | "annual";
export type NumberKind = "local" | "tollfree";
export type PayMethod = "wallet" | "card";

export interface Bundle {
  id: BundleId;
  name: string;
  tagline: string;
  monthly: number;       // $/mo when billed monthly
  annualTotal: number;   // single upfront charge, billed yearly
  annualMonthly: number; // effective $/mo on the annual plan (display only)
  numberType: NumberKind; // the number type included
  minutes: number;        // included minutes / period
  sms: number;            // included SMS / period
  numbersIncluded: number;// free numbers included in the plan
  maxNumbers: number;     // total numbers this plan can hold (extras billed at rental)
  featured?: boolean;
  perks: string[];
}

export const BUNDLES: Bundle[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "A second line with room to grow.",
    monthly: 9.99,
    annualTotal: 99,
    annualMonthly: 8.25,
    numberType: "local",
    minutes: 300,
    sms: 300,
    numbersIncluded: 0,
    maxNumbers: 3,
    perks: ["1 number FREE (add up to 3)", "300 minutes / mo", "300 SMS / mo", "Overage at pay-as-you-go rates"],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For teams that live on calls & texts.",
    monthly: 24.99,
    annualTotal: 249,
    annualMonthly: 20.75,
    numberType: "local",
    minutes: 1000,
    sms: 1000,
    numbersIncluded: 0,
    maxNumbers: 5,
    featured: true,
    perks: ["1 number FREE (add up to 5)", "1,000 minutes / mo", "1,000 SMS / mo", "Priority support"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "High volume, toll-free ready.",
    monthly: 49.99,
    annualTotal: 499,
    annualMonthly: 41.58,
    numberType: "tollfree",
    minutes: 3000,
    sms: 3000,
    numbersIncluded: 0,
    maxNumbers: 10,
    perks: ["1 toll-free number FREE (add up to 10)", "3,000 minutes / mo", "3,000 SMS / mo", "Priority support"],
  },
];

/** Flat monthly rental for EXTRA numbers on a plan (beyond the free one). */
export const NUMBER_RENTAL: Record<NumberKind, number> = {
  local: 2.99,
  tollfree: 4.99,
};

/**
 * Auto-reload amount added to the wallet from the user's card when a plan's
 * included usage runs out and the wallet can't cover pay-as-you-go overflow.
 * (Card-on-file reload activates once PayPal Business billing is live; until
 * then overflow is drawn from the wallet balance directly.)
 */
export const PAYG_RELOAD = 3.99;

export interface UsageRate {
  key: string;
  label: string;
  price: number; // USD per unit
  unit: string;
}

/** Pay-as-you-go usage rates — pooled across every number on the account. */
export const USAGE_RATES: UsageRate[] = [
  { key: "voice", label: "Voice — in & out", price: 0.015, unit: "/min" },
  { key: "sms_local", label: "Local SMS", price: 0.015, unit: "/msg" },
  { key: "sms_tollfree", label: "Toll-free SMS", price: 0.02, unit: "/msg" },
  { key: "sms_shortcode", label: "Short-code SMS", price: 0.025, unit: "/msg" },
  { key: "mms_out", label: "MMS — outbound", price: 0.045, unit: "/msg" },
  { key: "mms_in", label: "MMS — inbound", price: 0.015, unit: "/msg" },
];

/** The price charged for a bundle on the given cycle. */
export function bundlePrice(b: Bundle, cycle: BillingCycle): number {
  return cycle === "annual" ? b.annualTotal : b.monthly;
}

export const getBundle = (id: string): Bundle | undefined => BUNDLES.find((b) => b.id === id);

/** A number's flat rental price by kind. */
export const numberPrice = (kind: NumberKind): number => NUMBER_RENTAL[kind];
