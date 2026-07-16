/**
 * Backend API client for real auth + persistent wallet (DGRINGO server,
 * `/api/auth/*` and `/api/wallet`). The auth token is stored in localStorage and
 * sent as `Authorization: Bearer <token>` on every request.
 *
 * Network failures (e.g. running the app locally with no backend) are flagged
 * with `isNetwork` so the store can gracefully fall back to a mock login in dev.
 */
import { API_ORIGIN } from "./origin";

const TOKEN_KEY = "dg-token";

export const saveToken = (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } };
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

export interface ApiUser { id: number; email: string; name: string; walletBalance: number; emailVerified: boolean; }
export interface ApiWalletTxn { id: string; amount: number; label: string; kind: string; time: string; }
export interface ApiWallet { balance: number; txns: ApiWalletTxn[]; }
export interface AuthResult { token: string; user: ApiUser; }

interface NetError extends Error { isNetwork?: boolean; status?: number; }

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  let r: Response;
  try {
    r = await fetch(API_ORIGIN + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
  } catch {
    const e: NetError = new Error("Can't reach the server — check your connection");
    e.isNetwork = true;
    throw e;
  }
  const j = await r.json().catch(() => ({} as Record<string, unknown>));
  if (!r.ok) {
    const e: NetError = new Error((j as { error?: string }).error || `Request failed (${r.status})`);
    e.status = r.status;
    throw e;
  }
  return j as T;
}

export const apiRegister = (email: string, password: string, name: string) =>
  req<AuthResult>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) });

export const apiLogin = (email: string, password: string) =>
  req<AuthResult>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const apiMe = () => req<ApiUser>("/api/auth/me");

/** Resend the signup verification email to the logged-in user. */
export const apiResendVerification = () =>
  req<{ ok: boolean; alreadyVerified?: boolean }>("/api/auth/resend-verification", { method: "POST" });

export const apiForgotPassword = (email: string) =>
  req<{ ok: boolean }>("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });

export const apiWallet = () => req<ApiWallet>("/api/wallet");

export type PayMethod = "wallet" | "card";
export type NumberKind = "local" | "tollfree";
export type BillingCycle = "monthly" | "annual";

export interface ApiSubscription {
  tier: string; cycle: BillingCycle;
  minutesIncluded: number; smsIncluded: number;
  minutesUsed: number; smsUsed: number;
  status: string; periodEnd: number;
  payMethod: PayMethod; autoRenew: boolean; renewAmount: number;
  // Plan number-capacity (attached by the server): how many numbers the plan
  // holds vs. how many are free-included.
  numbersUsed?: number; numbersIncluded?: number; numbersMax?: number;
}

/** A plan's number-capacity snapshot (also returned by /api/numbers). */
export interface ApiCapacity {
  hasPlan: boolean; tier?: string; used?: number; included?: number; max?: number;
  isFree?: boolean; atCap?: boolean; numberType?: NumberKind;
}
export interface ApiOwnedNumber { id: string; e164: string; kind: NumberKind; telnyxId: string; free: boolean; time: string; }

/** List the user's owned numbers + their plan's number-capacity. */
export const apiGetNumbers = () => req<{ numbers: ApiOwnedNumber[]; capacity: ApiCapacity }>("/api/numbers");

export interface ApiCallLog { id: string; contact: string; direction: "outgoing" | "incoming" | "missed"; status: string; duration: string; via: string; time: string; }

/** Persisted call history (survives refresh). */
export const apiGetCalls = () => req<{ calls: ApiCallLog[] }>("/api/calls");
export const apiLogCall = (c: { contact: string; direction: string; status: string; duration: string; via: string }) =>
  req<{ ok: boolean; id: string }>("/api/calls", { method: "POST", body: JSON.stringify(c) });

export interface BuyResult {
  ok: boolean; order?: { id?: string; phone_numbers?: { id?: string }[] };
  wallet?: ApiWallet; free?: boolean; capacity?: ApiCapacity;
}

/**
 * Buy a number through server-orchestrated billing. Every number belongs to a
 * plan: the SERVER requires an active bundle, makes the first number free, and
 * bills extras at the flat rental (from the WALLET) up to the plan cap. Paying
 * by card = topping the wallet up via Stripe first.
 */
export const apiBuyNumber = (phoneNumber: string, kind: NumberKind) =>
  req<BuyResult>("/api/numbers/buy", { method: "POST", body: JSON.stringify({ phoneNumber, kind }) });

export interface SubscribeResult { ok: boolean; subscription?: ApiSubscription; wallet?: ApiWallet; }

/**
 * Subscribe to a bundle FROM THE WALLET. Server sets the price by tier+cycle and
 * debits the wallet. Paying by CARD goes through the Stripe hosted checkout
 * instead (fulfilled server-side by webhook), so this route is wallet-only.
 */
export const apiSubscribe = (tier: string, cycle: BillingCycle) =>
  req<SubscribeResult>("/api/bundles/subscribe", { method: "POST", body: JSON.stringify({ tier, cycle }) });

export const apiGetSubscription = () => req<{ subscription: ApiSubscription | null }>("/api/subscription");

/** Turn auto-renew (wallet-funded) on or off for the active plan. */
export const apiSetAutoRenew = (on: boolean) =>
  req<{ subscription: ApiSubscription | null }>("/api/subscription/auto-renew", { method: "POST", body: JSON.stringify({ on }) });

export interface ApiActivityItem { id: string; kind: string; title: string; body: string; time: string; read: boolean; }

/** The user's persisted activity feed (survives refresh). */
export const apiGetActivity = () => req<{ activity: ApiActivityItem[] }>("/api/activity");
/** Persist a client-generated activity item (calls, verification, etc.). */
export const apiLogActivity = (a: { kind: string; title: string; body: string }) =>
  req<{ ok: boolean }>("/api/activity", { method: "POST", body: JSON.stringify(a) });
/** Mark all activity as read (clears the badge, server-side). */
export const apiMarkActivityRead = () =>
  req<{ ok: boolean }>("/api/activity/read", { method: "POST" });

export interface ApiForwarding { forwardNumber: string; voicemailEnabled: boolean; }

/** Incoming-call delivery: the user's forwarding cellphone + voicemail toggle. */
export const apiGetForwarding = () => req<ApiForwarding>("/api/user/forward");
export const apiSetForwarding = (f: ApiForwarding) =>
  req<{ ok: boolean } & ApiForwarding>("/api/user/forward", { method: "POST", body: JSON.stringify(f) });

export interface ApiVoicemail { id: string; from: string; to: string; url: string; duration: number; read: boolean; time: string; }
/** Voicemails left when an incoming call wasn't answered. */
export const apiGetVoicemails = () => req<{ voicemails: ApiVoicemail[] }>("/api/voicemails");

export interface ApiSupportMessage { id: string; sender: "user" | "agent"; agentName: string | null; body: string; time: string; }
/** The customer's live support thread + send a message to the team. */
export const apiGetSupport = () => req<{ messages: ApiSupportMessage[] }>("/api/support/messages");
export const apiSendSupport = (body: string) =>
  req<{ ok: boolean; messages: ApiSupportMessage[] }>("/api/support/messages", { method: "POST", body: JSON.stringify({ body }) });

export const isNetworkError = (e: unknown): boolean => !!(e as NetError)?.isNetwork;
