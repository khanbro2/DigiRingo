import {
  createContext, useContext, useReducer, useCallback, useState, useEffect, useRef, type ReactNode,
} from "react";
import type {
  AppState, User, PhoneNumber, NumberSettings, ActivityItem, CallLog, Preferences, BrandInfo,
  Message, MessageDeliveryStatus, Conversation, WalletTxn, Subscription,
  BrandRegistration, CampaignRegistration, RegulatoryRequirement,
} from "../core/types";
import { initialState } from "./seed";
import { telnyx } from "../services/telnyx";
import { toAppNumber, ownedToAppNumber, toAppConversation, toAppCall, availableToApp } from "../services/telnyx/adapt";
import type { ConversationThread } from "../services/telnyx/types";
import { retailPrice } from "../core/pricing";
import { getBundle, NUMBER_RENTAL } from "../core/plans";
import type { BillingCycle, NumberKind, PayMethod } from "../core/plans";
import {
  apiLogin, apiRegister, apiMe, apiWallet, apiBuyNumber, apiReleaseNumber, apiSubscribe, apiGetSubscription, apiSetAutoRenew, apiCancelSubscription,
  apiResendVerification, apiGetCalls, apiGetNumbers, apiLogCall,
  apiGetActivity, apiLogActivity, apiMarkActivityRead, saveToken, clearToken, getToken, isNetworkError,
  type ApiUser, type ApiWallet, type ApiSubscription, type ApiCallLog, type ApiOwnedNumber, type ApiActivityItem,
} from "../services/api";
import { loadStripeConfig, startCheckout } from "../services/stripe";
import {
  startCall as voiceStart, hangupCall as voiceHangup, toggleMute as voiceToggleMute,
  answerCall as voiceAnswer, register as voiceRegister, unregister as voiceUnregister,
  subscribeCall, clearCall as voiceClear, type CallSnapshot,
} from "../services/voice";
import { initWebPush } from "../services/push";
import { playMessageChime, getSmsSoundOn } from "../services/ringtone";

/** Map the backend user/wallet shapes onto the app's domain types. */
const toAppUser = (u: ApiUser): User => {
  const name = u.name?.trim() || u.email.split("@")[0] || "User";
  return { id: String(u.id), name, email: u.email, workspace: `${name}'s Workspace`, initial: name.charAt(0).toUpperCase(), emailVerified: !!u.emailVerified };
};
const toAppTxns = (w: ApiWallet): WalletTxn[] =>
  w.txns.map((t) => ({ id: t.id, label: t.label, amount: t.amount, time: t.time }));
const toAppSub = (s: ApiSubscription | null): Subscription | null => {
  if (!s || !(s.status === "active" || s.status === "past_due")) return null;
  const b = getBundle(s.tier);
  return {
    tier: s.tier, cycle: s.cycle, minutesIncluded: s.minutesIncluded, smsIncluded: s.smsIncluded,
    minutesUsed: s.minutesUsed, smsUsed: s.smsUsed, status: s.status, periodEnd: s.periodEnd,
    payMethod: s.payMethod === "card" ? "card" : "wallet", autoRenew: !!s.autoRenew, renewAmount: s.renewAmount || 0,
    numbersUsed: s.numbersUsed ?? 0,
    numbersIncluded: s.numbersIncluded ?? b?.numbersIncluded ?? 1,
    numbersMax: s.numbersMax ?? b?.maxNumbers ?? 1,
  };
};

/** A purchasable number returned by search (retail-priced). */
export interface AvailableNumber { e164: string; number: string; price: number; sms: boolean; voice: boolean; }

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

/** Adapt server threads → app conversations, matching each thread to its owned
 *  number by DIGITS (server phone_number_id ≠ app number id — different Telnyx
 *  resources; the phone number itself is the only stable key). */
const mapThreadsToConvos = (threads: ConversationThread[], numbers: PhoneNumber[]): Conversation[] =>
  threads.map((t) => {
    const c = toAppConversation(t);
    const match = t.owned ? numbers.find((n) => onlyDigits(n.number) === onlyDigits(t.owned!)) : undefined;
    return match ? { ...c, numberId: match.id } : c;
  });

/** Stable identity for a thread across id namespaces: owned-number digits + contact digits. */
const convoKey = (c: Conversation, numbers: PhoneNumber[]) => {
  const num = numbers.find((n) => n.id === c.numberId);
  return `${onlyDigits(num?.number ?? c.numberId)}|${onlyDigits(c.contact)}`;
};

const toE164 = (display: string) => {
  const d = display.replace(/[^\d+]/g, "");
  return d.startsWith("+") ? d : `+${d}`;
};

/** Map a persisted server call-log row onto the app's CallLog shape. */
const apiCallToApp = (c: ApiCallLog, numbers: PhoneNumber[]): CallLog => {
  const via = numbers.find((n) => toE164(n.number) === c.via) ?? numbers[0];
  return {
    id: c.id, numberId: via?.id ?? "n1", contactFlag: "📞",
    contact: c.contact, direction: c.direction, status: c.status, duration: c.duration, time: c.time,
  };
};

/**
 * The app's single store. All business logic lives here (auth, messaging,
 * verification, wallet) so screens stay presentational and platform-agnostic.
 * Swapping this for a real backend later means changing only this file.
 */

type Action =
  | { t: "LOGIN"; user: User }
  | { t: "LOGOUT" }
  | { t: "SELECT_NUMBER"; id: string }
  | { t: "APPEND_MESSAGE"; convoId: string; message: Message }
  | { t: "UPDATE_MSG_STATUS"; convoId: string; messageId: string; status: MessageDeliveryStatus; telnyxId?: string }
  | { t: "SET_CONVERSATIONS"; conversations: Conversation[] }
  | { t: "MERGE_CONVERSATIONS"; conversations: Conversation[] }
  | { t: "ADD_CONVERSATION"; conversation: Conversation }
  | { t: "SET_CALLS"; calls: CallLog[] }
  | { t: "MARK_READ"; convoId: string }
  | { t: "ADD_BALANCE"; amount: number }
  | { t: "SET_WALLET"; balance: number; txns: WalletTxn[] }
  | { t: "SET_SUBSCRIPTION"; subscription: Subscription | null }
  | { t: "CHARGE_WALLET"; amount: number; label: string }
  | { t: "BUY_NUMBER"; number: PhoneNumber }
  | { t: "SET_VERIFICATION"; id: string; status: PhoneNumber["verification"] }
  | { t: "UPDATE_SETTINGS"; id: string; patch: Partial<NumberSettings> }
  | { t: "LOG_CALL"; call: CallLog }
  | { t: "SET_NUMBERS"; numbers: PhoneNumber[] }
  | { t: "REMOVE_NUMBER"; id: string }
  | { t: "SET_BALANCE"; balance: number }
  | { t: "SET_BRAND"; brand: BrandInfo | null }
  | { t: "UPDATE_USER"; patch: Partial<User> }
  | { t: "TOGGLE_PREF"; key: keyof Preferences }
  | { t: "BLOCK"; num: string }
  | { t: "UNBLOCK"; num: string }
  | { t: "PUSH_ACTIVITY"; item: ActivityItem }
  | { t: "SET_ACTIVITY"; activity: ActivityItem[] }
  | { t: "READ_ALL_ACTIVITY" };

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function reducer(s: AppState, a: Action): AppState {
  switch (a.t) {
    case "LOGIN":
      return { ...s, user: a.user };

    case "LOGOUT":
      return { ...s, user: null };

    case "SELECT_NUMBER":
      return { ...s, activeNumberId: a.id };

    case "APPEND_MESSAGE":
      return {
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === a.convoId
            ? { ...c, preview: a.message.text, time: "now", messages: [...c.messages, a.message] }
            : c,
        ),
      };

    case "UPDATE_MSG_STATUS":
      return {
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === a.convoId
            ? { ...c, messages: c.messages.map((m) => m.id === a.messageId ? { ...m, status: a.status, telnyxId: a.telnyxId ?? m.telnyxId } : m) }
            : c,
        ),
      };

    case "SET_CONVERSATIONS":
      return { ...s, conversations: a.conversations };

    case "MERGE_CONVERSATIONS": {
      // Fold a fresh server snapshot into local state WITHOUT clobbering
      // optimistic sends, just-read state, or a not-yet-persisted new thread.
      const byKey = new Map(s.conversations.map((c) => [convoKey(c, s.numbers), c]));
      const seen = new Set<string>();
      const merged = a.conversations.map((inc) => {
        const key = convoKey(inc, s.numbers);
        seen.add(key);
        const local = byKey.get(key);
        if (!local) return inc; // brand-new inbound thread
        const grew = inc.messages.length > local.messages.length;
        // Keep local outbound messages the server hasn't echoed yet (still sending/failed).
        const echoed = new Set(inc.messages.filter((m) => m.sent).map((m) => m.text));
        const pending = local.messages.filter((m) => m.sent && (m.status === "sending" || m.status === "failed") && !echoed.has(m.text));
        return {
          ...inc,
          id: local.id, // preserve local id so the open thread (activeConvoId) stays valid
          messages: [...inc.messages, ...pending],
          // Never silently re-flag a thread the user already read; only surface
          // unread when genuinely new messages arrived.
          unread: grew ? inc.unread : Math.min(local.unread, inc.unread),
        };
      });
      // Preserve purely-local threads (e.g. a brand-new compose not yet on the server).
      const localOnly = s.conversations.filter((c) => !seen.has(convoKey(c, s.numbers)));
      return { ...s, conversations: [...localOnly, ...merged] };
    }

    case "ADD_CONVERSATION":
      return { ...s, conversations: [a.conversation, ...s.conversations] };

    case "SET_CALLS":
      return { ...s, calls: a.calls };

    case "MARK_READ":
      return {
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === a.convoId ? { ...c, unread: 0 } : c,
        ),
      };

    case "ADD_BALANCE":
      return {
        ...s,
        wallet: {
          balance: +(s.wallet.balance + a.amount).toFixed(2),
          txns: [
            { id: `t${Date.now()}`, label: "Wallet top-up", amount: a.amount, time: "now" },
            ...s.wallet.txns,
          ],
        },
      };

    case "SET_WALLET":
      // Replace the whole wallet from the server (source of truth in live mode).
      return { ...s, wallet: { balance: a.balance, txns: a.txns } };

    case "SET_SUBSCRIPTION":
      return { ...s, subscription: a.subscription };

    case "CHARGE_WALLET":
      return {
        ...s,
        wallet: {
          balance: +(s.wallet.balance - a.amount).toFixed(2),
          txns: [
            { id: `t${Date.now()}`, label: a.label, amount: -a.amount, time: "now" },
            ...s.wallet.txns,
          ],
        },
      };

    case "BUY_NUMBER":
      return { ...s, numbers: [a.number, ...s.numbers] };

    case "REMOVE_NUMBER":
      return { ...s, numbers: s.numbers.filter((n) => n.id !== a.id) };

    case "SET_VERIFICATION":
      return {
        ...s,
        numbers: s.numbers.map((n) =>
          n.id === a.id ? { ...n, verification: a.status } : n,
        ),
      };

    case "UPDATE_SETTINGS":
      return {
        ...s,
        numbers: s.numbers.map((n) =>
          n.id === a.id ? { ...n, settings: { ...n.settings, ...a.patch } } : n,
        ),
      };

    case "LOG_CALL":
      return { ...s, calls: [a.call, ...s.calls] };

    case "SET_NUMBERS":
      return { ...s, numbers: a.numbers };

    case "SET_BALANCE":
      return { ...s, wallet: { ...s.wallet, balance: a.balance } };

    case "SET_BRAND":
      return { ...s, brand: a.brand };

    case "UPDATE_USER":
      return { ...s, user: s.user ? { ...s.user, ...a.patch, initial: (a.patch.name ?? s.user.name).charAt(0).toUpperCase() } : s.user };

    case "TOGGLE_PREF":
      return { ...s, preferences: { ...s.preferences, [a.key]: !s.preferences[a.key] } };

    case "BLOCK":
      return s.blocked.includes(a.num) ? s : { ...s, blocked: [a.num, ...s.blocked] };

    case "UNBLOCK":
      return { ...s, blocked: s.blocked.filter((b) => b !== a.num) };

    case "PUSH_ACTIVITY":
      return { ...s, activity: [a.item, ...s.activity] };

    case "SET_ACTIVITY":
      return { ...s, activity: a.activity };

    case "READ_ALL_ACTIVITY":
      return { ...s, activity: s.activity.map((x) => ({ ...x, read: true })) };

    default:
      return s;
  }
}

export interface Toast { id: number; message: string; type: "success" | "error"; }

interface Store {
  state: AppState;
  toasts: Toast[];
  showToast: (message: string, type?: "success" | "error") => void;
  // auth
  login: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  // numbers / inboxes
  selectNumber: (id: string) => void;
  // 10DLC: assign a number to the campaign (creating it from `campaign` if needed).
  registerNumber: (id: string, campaign?: CampaignRegistration) => Promise<{ ok: boolean; error?: string }>;
  // 10DLC brand registration from the full business profile (A2P "KYC").
  registerBrand: (data: BrandRegistration) => Promise<{ ok: boolean; error?: string }>;
  // Number regulatory requirements (KYC documents for some countries).
  getNumberRequirements: (phoneNumber: string) => Promise<RegulatoryRequirement[]>;
  submitNumberDoc: (phoneNumber: string, requirementId: string, file: File) => Promise<{ ok: boolean; documentId?: string }>;
  markNumberVerified: (id: string) => void;
  updateSettings: (id: string, patch: Partial<NumberSettings>) => void;
  telnyxMode: "mock" | "live";
  // messaging (gated by verification)
  sendMessage: (convoId: string, text: string) => boolean;
  /** Start a NEW conversation to an arbitrary contact from the active number
   *  (or reuse an existing thread for that contact), then send the first text. */
  startConversation: (contact: string, text: string) => { ok: boolean; convoId?: string };
  markRead: (convoId: string) => void;
  // calls (real WebRTC softphone; see services/voice.ts)
  placeCall: (contact: string) => void;
  /** Live in-call state (null when idle). Drives the in-call overlay. */
  activeCall: CallSnapshot | null;
  /** Answer a ringing inbound call. */
  answerCall: () => void;
  hangupCall: () => void;
  toggleCallMute: () => void;
  /** Dismiss the ended/failed in-call overlay. */
  dismissCall: () => void;
  // profile & preferences
  updateUser: (patch: Partial<User>) => void;
  togglePref: (key: keyof Preferences) => void;
  block: (num: string) => void;
  unblock: (num: string) => void;
  // wallet
  addBalance: (amount: number) => void;
  setWallet: (balance: number, txns: WalletTxn[]) => void;
  /** Re-fetch the wallet balance + transactions from the server. */
  refreshWallet: () => Promise<void>;
  /** Poll wallet + subscription for a few seconds after a Stripe card payment,
   *  so the UI catches up once the fulfilment webhook lands. */
  syncBillingSoon: () => void;
  /** Buy/add a number. `free` claims the plan's included free number; otherwise
   *  it's a paid extra billed to the wallet. */
  buyNumber: (n: PhoneNumber, opts?: { kind?: NumberKind; free?: boolean }) => Promise<boolean>;
  releaseNumber: (id: string) => Promise<boolean>;
  /** Subscribe to a bundle from the wallet. (Card = Stripe checkout in the UI.) */
  subscribe: (tier: string, cycle: BillingCycle, opts?: { pay?: PayMethod }) => Promise<boolean>;
  /** Activate a plan (from wallet) and claim a number free in one flow. */
  subscribeAndBuy: (n: PhoneNumber, tier: string, cycle: BillingCycle, opts?: { pay?: PayMethod; kind?: NumberKind }) => Promise<boolean>;
  /** Activate a plan by CARD (Stripe) and claim a number free once it activates. */
  subscribeByCardAndBuy: (n: PhoneNumber, tier: string, cycle: BillingCycle) => Promise<boolean>;
  /** Toggle wallet-funded auto-renew for the active plan. */
  setAutoRenew: (on: boolean) => Promise<void>;
  cancelSubscription: () => Promise<boolean>;
  /** Resend the signup email-verification link. */
  resendVerification: () => Promise<void>;
  /** Re-fetch the current user (e.g. to refresh email-verified status). */
  refreshUser: () => Promise<void>;
  /** Re-fetch the subscription (usage + number-capacity) and raise limit alerts. */
  refreshSubscription: () => Promise<void>;
  searchNumbers: (countryIso: string, type: "local" | "mobile", areaCode?: string) => Promise<AvailableNumber[]>;
  readAllActivity: () => void;
}

const Ctx = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loadedFor = useRef<string | null>(null);
  // Inbound-SMS alerting: ids of inbound messages already seen (so we chime only
  // for genuinely new ones), and a flag that we've done the initial seed.
  const seenInbound = useRef<Set<string>>(new Set());
  const inboxSeeded = useRef(false);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  // Push an activity item into the feed. In live mode, `persist` writes it to the
  // server too so it survives a refresh — used ONLY for client-only events (calls,
  // verification). Server-side events (number added, plan activated, top-up) are
  // logged by the SERVER, so those pass persist:false to avoid a duplicate.
  const pushActivity = useCallback((item: Omit<ActivityItem, "id" | "read">, opts?: { persist?: boolean }) => {
    dispatch({ t: "PUSH_ACTIVITY", item: { ...item, id: `a${Date.now()}`, read: false } });
    if (opts?.persist && telnyx.mode === "live") {
      apiLogActivity({ kind: item.kind, title: item.title, body: item.body }).catch(() => {});
    }
  }, []);

  // Set the subscription AND raise a near-limit / over-limit alert (once per
  // crossing) so the user is nudged to upgrade before / when they run out and
  // fall back to pay-as-you-go. Shown in-app + the Activity feed (so it reaches
  // both the mobile app and the web app, which share this code).
  const usageAlerted = useRef({ near: false, over: false });
  const applySub = useCallback((sub: Subscription | null) => {
    dispatch({ t: "SET_SUBSCRIPTION", subscription: sub });
    if (!sub || sub.status !== "active") { usageAlerted.current = { near: false, over: false }; return; }
    const pMin = sub.minutesIncluded > 0 ? sub.minutesUsed / sub.minutesIncluded : 0;
    const pSms = sub.smsIncluded > 0 ? sub.smsUsed / sub.smsIncluded : 0;
    const over = sub.minutesUsed > sub.minutesIncluded || sub.smsUsed > sub.smsIncluded;
    const near = !over && (pMin >= 0.8 || pSms >= 0.8);
    if (over && !usageAlerted.current.over) {
      usageAlerted.current.over = true;
      pushActivity({ kind: "wallet", title: "Plan limit reached", body: "Your plan's included minutes/SMS are used up. Extra usage is now billed pay-as-you-go from your wallet — upgrade to avoid overage charges.", time: "just now" });
      showToast("Plan limit reached — now on pay-as-you-go", "error");
    }
    if (near && !usageAlerted.current.near) {
      usageAlerted.current.near = true;
      pushActivity({ kind: "wallet", title: "Approaching your plan limit", body: "You've used 80%+ of your plan. Upgrade now, or you'll move to pay-as-you-go (charged from your wallet) when it runs out.", time: "just now" });
      showToast("You're near your plan limit — consider upgrading");
    }
    if (!near) usageAlerted.current.near = false;
    if (!over) usageAlerted.current.over = false;
  }, [pushActivity, showToast]);

  // Mock login (dev fallback when no backend is reachable, e.g. local mock mode).
  const mockLogin = useCallback((email: string, name?: string) => {
    const display = name || email.split("@")[0] || "User";
    dispatch({ t: "LOGIN", user: {
      id: `u${Date.now()}`, name: display, email,
      workspace: `${display}'s Workspace`, initial: display.charAt(0).toUpperCase(), emailVerified: true,
    }});
  }, []);

  // Real auth: name present → register, else login. On success store the token,
  // set the user, and load the persistent wallet. Falls back to a mock login only
  // when the backend is unreachable (network error) so local dev still works.
  const login: Store["login"] = useCallback(async (email, password, name) => {
    // In mock mode (local dev, no backend) skip the API entirely.
    if (telnyx.mode === "mock") { mockLogin(email, name); return { ok: true }; }
    try {
      const res = name ? await apiRegister(email, password, name) : await apiLogin(email, password);
      saveToken(res.token);
      dispatch({ t: "LOGIN", user: toAppUser(res.user) });
      try {
        const w = await apiWallet();
        dispatch({ t: "SET_WALLET", balance: w.balance, txns: toAppTxns(w) });
      } catch { /* wallet load is non-fatal */ }
      try {
        const { subscription } = await apiGetSubscription();
        applySub(toAppSub(subscription));
      } catch { /* subscription load is non-fatal */ }
      return { ok: true };
    } catch (e) {
      if (isNetworkError(e)) { mockLogin(email, name); return { ok: true }; }
      return { ok: false, error: e instanceof Error ? e.message : "Login failed" };
    }
  }, [mockLogin, applySub]);

  const logout = useCallback(() => { loadedFor.current = null; clearToken(); dispatch({ t: "LOGOUT" }); }, []);
  const setWallet = useCallback((balance: number, txns: WalletTxn[]) => dispatch({ t: "SET_WALLET", balance, txns }), []);

  // Re-fetch the current user from the server (e.g. to pick up email_verified
  // after the user clicked the verification link on the web).
  const refreshUser: Store["refreshUser"] = useCallback(async () => {
    if (telnyx.mode === "mock") return;
    try { dispatch({ t: "LOGIN", user: toAppUser(await apiMe()) }); } catch { /* ignore */ }
  }, []);

  // Re-fetch the subscription (usage + number-capacity) and raise limit alerts.
  const refreshSubscription: Store["refreshSubscription"] = useCallback(async () => {
    if (telnyx.mode === "mock") return;
    try { const { subscription } = await apiGetSubscription(); applySub(toAppSub(subscription)); } catch { /* ignore */ }
  }, [applySub]);

  // Re-fetch the wallet balance + transactions from the server.
  const refreshWallet: Store["refreshWallet"] = useCallback(async () => {
    if (telnyx.mode === "mock") return;
    try { const w = await apiWallet(); dispatch({ t: "SET_WALLET", balance: w.balance, txns: toAppTxns(w) }); } catch { /* ignore */ }
  }, []);

  // After a Stripe card payment the wallet credit / plan activation happens via
  // an async webhook, so poll both a few times to let the UI catch up.
  const syncBillingSoon: Store["syncBillingSoon"] = useCallback(() => {
    if (telnyx.mode === "mock") return;
    let n = 0;
    const tick = async () => {
      n += 1;
      try { const w = await apiWallet(); dispatch({ t: "SET_WALLET", balance: w.balance, txns: toAppTxns(w) }); } catch { /* ignore */ }
      try { const { subscription } = await apiGetSubscription(); applySub(toAppSub(subscription)); } catch { /* ignore */ }
      if (n < 6) setTimeout(tick, 1500);
    };
    setTimeout(tick, 1200);
  }, [applySub]);

  // Resend the signup verification email to the logged-in user.
  const resendVerification: Store["resendVerification"] = useCallback(async () => {
    if (telnyx.mode === "mock") { showToast("Verification email sent (test)"); return; }
    try {
      const r = await apiResendVerification();
      showToast(r.alreadyVerified ? "Your email is already verified ✓" : "Verification email sent — check your inbox 📧");
    } catch (e) { showToast(e instanceof Error ? e.message : "Couldn't send email", "error"); }
  }, [showToast]);

  // Preload Stripe availability once so the checkout UIs know whether card
  // payments are ready. Also: if we're returning from a Stripe Checkout
  // (?pay=success), the webhook has fulfilled server-side — refresh + confirm.
  useEffect(() => {
    loadStripeConfig();
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("pay") === "success") {
        showToast("Payment received — updating your account…");
        syncBillingSoon();
        window.history.replaceState({}, "", window.location.pathname);
      }
      // Returning from the hosted change-card flow (?card=saved) — the webhook
      // stored the new card; the Wallet screen re-fetches it on mount.
      if (q.get("card") === "saved") {
        showToast("Card saved — future renewals will use it");
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the session on app start: if a saved token is valid, re-load the user
  // and wallet from the server (so a refresh keeps you logged in, balance intact).
  useEffect(() => {
    if (!getToken()) return;
    (async () => {
      try {
        const [me, w] = await Promise.all([apiMe(), apiWallet()]);
        dispatch({ t: "LOGIN", user: toAppUser(me) });
        dispatch({ t: "SET_WALLET", balance: w.balance, txns: toAppTxns(w) });
        try {
          const { subscription } = await apiGetSubscription();
          applySub(toAppSub(subscription));
        } catch { /* subscription load is non-fatal */ }
      } catch { clearToken(); /* expired/invalid token → stay logged out */ }
    })();
  }, [applySub]);
  const selectNumber = useCallback((id: string) => dispatch({ t: "SELECT_NUMBER", id }), []);

  // Load workspace data from Telnyx once per login (numbers, balance, brand).
  useEffect(() => {
    const uid = state.user?.id;
    if (!uid || loadedFor.current === uid) return;
    loadedFor.current = uid;
    (async () => {
      // Each call is independent: a failure in one (e.g. no 10DLC brand yet, or
      // an empty CDR feed) must NOT prevent the others (numbers, inbox) loading.
      // NOTE: we do NOT load the Telnyx account balance here — that is the
      // PLATFORM's wholesale balance and belongs only in the Control Hub. The
      // user's wallet (state.wallet.balance) is their own, funded by their top-ups.
      // Calls come from OUR persistent store in live mode (WebRTC calls aren't
      // reliably in Telnyx CDRs); mock mode uses the seeded CDRs.
      const loadCalls = telnyx.mode === "live" ? apiGetCalls().then((r) => r.calls) : telnyx.listDetailRecords();
      // LIVE: load the user's OWN numbers from our DB (/api/numbers) — NOT the
      // shared Telnyx account list, which would leak every workspace's numbers.
      // MOCK: keep the seeded Telnyx account list for the demo.
      const loadNumbers = telnyx.mode === "live" ? apiGetNumbers().then((r) => r.numbers) : telnyx.listPhoneNumbers();
      // Persisted activity feed (live only) — so it survives a refresh.
      const loadActivity = telnyx.mode === "live" ? apiGetActivity().then((r) => r.activity) : Promise.resolve(null);
      const [numsR, brandR, convosR, cdrsR, actR] = await Promise.allSettled([
        loadNumbers, telnyx.getBrand(),
        telnyx.listConversations(), loadCalls, loadActivity,
      ]);
      if (actR.status === "fulfilled" && actR.value) {
        const items = (actR.value as ApiActivityItem[]).map((a) => ({
          id: a.id, kind: a.kind as ActivityItem["kind"], title: a.title, body: a.body, time: a.time, read: a.read,
        }));
        dispatch({ t: "SET_ACTIVITY", activity: items });
      }

      let appNumbers = state.numbers;
      if (numsR.status === "fulfilled") {
        const prevById = new Map(state.numbers.map((n) => [n.id, n]));
        if (telnyx.mode === "live") {
          const owned = numsR.value as ApiOwnedNumber[];
          appNumbers = owned.map((o) => ownedToAppNumber(o, prevById.get(o.telnyxId || o.id)));
        } else {
          const nums = numsR.value as Awaited<ReturnType<typeof telnyx.listPhoneNumbers>>;
          const merged = nums.map((pn) => toAppNumber(pn, prevById.get(pn.id)));
          const extra = state.numbers.filter((n) => !nums.some((pn) => pn.id === n.id));
          appNumbers = [...merged, ...extra];
        }
        dispatch({ t: "SET_NUMBERS", numbers: appNumbers });
      }
      if (brandR.status === "fulfilled" && brandR.value) dispatch({ t: "SET_BRAND", brand: { id: brandR.value.brandId, displayName: brandR.value.displayName, status: brandR.value.status } });
      if (convosR.status === "fulfilled") {
        dispatch({ t: "SET_CONVERSATIONS", conversations: mapThreadsToConvos(convosR.value, appNumbers) });
        // Seed the "already seen" set so we don't chime for the whole backlog on
        // login — only messages that arrive AFTER this point trigger an alert.
        for (const t of convosR.value) for (const m of t.messages) if (m.direction === "inbound") seenInbound.current.add(m.id);
        inboxSeeded.current = true;
      }
      if (cdrsR.status === "fulfilled") {
        const calls = telnyx.mode === "live"
          ? (cdrsR.value as ApiCallLog[]).map((c) => apiCallToApp(c, appNumbers))
          : (cdrsR.value as Parameters<typeof toAppCall>[0][]).map((r) => toAppCall(r, appNumbers));
        dispatch({ t: "SET_CALLS", calls });
      }
    })();
  }, [state.user?.id, state.numbers]);

  // Live inbox: poll the inbox every 12s while signed in so inbound SMS appears
  // without a manual refresh. Skipped when the tab is hidden (and fired once on
  // re-focus) to avoid needless traffic. The merge preserves optimistic sends.
  useEffect(() => {
    if (telnyx.mode !== "live") return;
    const uid = state.user?.id;
    if (!uid || !state.user?.emailVerified) return;
    let stopped = false;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const threads = await telnyx.listConversations();
        if (stopped) return;
        dispatch({ t: "MERGE_CONVERSATIONS", conversations: mapThreadsToConvos(threads, numbersRef.current) });
        // Alert on genuinely-new inbound messages. (When the tab is hidden this
        // poll is skipped and the server's Web Push covers it instead, so there's
        // no double alert.)
        const fresh: { from: string; text: string }[] = [];
        for (const t of threads) for (const m of t.messages) {
          if (m.direction === "inbound" && !seenInbound.current.has(m.id)) {
            seenInbound.current.add(m.id);
            if (inboxSeeded.current) fresh.push({ from: t.contact, text: m.text || "" });
          }
        }
        inboxSeeded.current = true;
        if (fresh.length) {
          if (getSmsSoundOn()) playMessageChime();
          const f = fresh[0];
          showToast(fresh.length === 1 ? `New message from ${f.from}` : `${fresh.length} new messages`);
        }
      } catch { /* transient network error — the next tick retries */ }
    };
    const iv = setInterval(poll, 12_000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, [state.user?.id, state.user?.emailVerified]);

  // Register the 10DLC brand from the full business profile the form collects.
  const registerBrand: Store["registerBrand"] = useCallback(async (data) => {
    try {
      const b = await telnyx.registerBrand(data);
      dispatch({ t: "SET_BRAND", brand: { id: b.brandId, displayName: b.displayName, status: b.status } });
      pushActivity({ kind: "verification", title: "Brand submitted", body: `10DLC brand "${b.displayName}" is ${b.status.toLowerCase()}.`, time: "just now" }, { persist: true });
      showToast(b.status === "VERIFIED" ? "Brand verified ✓" : "Brand submitted for review");
      return { ok: true };
    } catch (e) {
      // Surface Telnyx/TCR's real rejection reason (e.g. "EIN does not match
      // business records") instead of a generic failure, so the user can fix it.
      const reason = e instanceof Error && e.message ? e.message : "Brand registration failed";
      showToast(reason, "error");
      return { ok: false, error: reason };
    }
  }, [pushActivity, showToast]);

  // Assign a number to the 10DLC campaign. Requires a VERIFIED brand; creates the
  // campaign from `campaignData` the first time, then assigns this number to it.
  const registerNumber: Store["registerNumber"] = useCallback(async (id, campaignData) => {
    const num = state.numbers.find((n) => n.id === id);
    if (!num) return { ok: false, error: "Number not found" };
    if (!state.brand || state.brand.status !== "VERIFIED") {
      showToast("Register your business brand first", "error");
      return { ok: false, error: "Brand not verified" };
    }
    dispatch({ t: "SET_VERIFICATION", id, status: "pending" });
    try {
      let brand = state.brand;
      let campaignId = brand.campaignId;
      if (!campaignId) {
        if (!campaignData) {
          dispatch({ t: "SET_VERIFICATION", id, status: "unverified" });
          return { ok: false, error: "Campaign details required" };
        }
        const c = await telnyx.createCampaign(brand.id, campaignData);
        campaignId = c.campaignId;
        brand = { ...brand, campaignId };
        dispatch({ t: "SET_BRAND", brand });
      }
      await telnyx.assignNumber(toE164(num.number), campaignId);
      dispatch({ t: "SET_VERIFICATION", id, status: "verified" });
      pushActivity({ kind: "verification", title: "Number registered", body: `${num.number} is assigned to your 10DLC campaign and can send SMS.`, time: "just now" }, { persist: true });
      showToast("Number registered ✓");
      return { ok: true };
    } catch (e) {
      dispatch({ t: "SET_VERIFICATION", id, status: "unverified" });
      showToast("Registration failed — try again", "error");
      return { ok: false, error: e instanceof Error ? e.message : "Registration failed" };
    }
  }, [state.numbers, state.brand, pushActivity, showToast]);

  // Number regulatory requirements (KYC documents for some countries).
  const getNumberRequirements: Store["getNumberRequirements"] = useCallback((phoneNumber) => telnyx.getNumberRequirements(phoneNumber), []);
  const submitNumberDoc: Store["submitNumberDoc"] = useCallback((phoneNumber, requirementId, file) => telnyx.submitRegulatoryDoc(phoneNumber, requirementId, file), []);
  const markNumberVerified: Store["markNumberVerified"] = useCallback((id) => {
    dispatch({ t: "SET_VERIFICATION", id, status: "verified" });
    pushActivity({ kind: "verification", title: "Documents verified", body: "Your regulatory documents were accepted — this number can send SMS.", time: "just now" }, { persist: true });
    showToast("Number verified ✓");
  }, [pushActivity, showToast]);

  const updateSettings: Store["updateSettings"] = useCallback((id, patch) => {
    dispatch({ t: "UPDATE_SETTINGS", id, patch });
    // Sync Telnyx-backed voice settings (call recording / forwarding).
    if (patch.autoRecord !== undefined || patch.forwardAll !== undefined) {
      const body: Record<string, unknown> = {};
      if (patch.autoRecord !== undefined) body.call_recording = { inbound_call_recording_enabled: patch.autoRecord };
      if (patch.forwardAll !== undefined) body.call_forwarding = { call_forwarding_enabled: patch.forwardAll };
      telnyx.updateNumberVoice(id, body).catch(() => {});
    }
  }, []);

  const markRead = useCallback((convoId: string) => {
    dispatch({ t: "MARK_READ", convoId });
    // Persist the read state server-side so the unread badge stays cleared.
    const convo = state.conversations.find((c) => c.id === convoId);
    const num = state.numbers.find((n) => n.id === convo?.numberId);
    if (convo && num) telnyx.markConversationRead(toE164(num.number), toE164(convo.contact)).catch(() => {});
  }, [state.conversations, state.numbers]);

  // Real in-browser calling (outbound + inbound). `placeCall` starts a WebRTC
  // call; inbound calls arrive via the background registration. The overlay
  // reads `activeCall`; each call is logged to history once when it ends.
  const [activeCall, setActiveCall] = useState<CallSnapshot | null>(null);
  const callLog = useRef<{ endLogged: boolean }>({ endLogged: true });
  const numbersRef = useRef(state.numbers);
  numbersRef.current = state.numbers;

  useEffect(() => {
    return subscribeCall((s) => {
      setActiveCall(s);
      if (!s) return;
      // A new call has begun → arm end-logging.
      if (s.phase === "incoming" || s.phase === "connecting") callLog.current.endLogged = false;
      if ((s.phase === "ended" || s.phase === "failed") && !callLog.current.endLogged) {
        callLog.current.endLogged = true;
        const durSec = s.startedAt ? Math.max(0, Math.round((Date.now() - s.startedAt) / 1000)) : 0;
        const duration = `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, "0")}`;
        const inbound = s.direction === "inbound";
        const dir: CallLog["direction"] = s.phase === "failed" || (inbound && !s.startedAt) ? "missed" : inbound ? "incoming" : "outgoing";
        const status = s.phase === "failed" ? "Failed" : !s.startedAt ? (inbound ? "Missed call" : "Not answered") : "Call ended";
        // "via" number = the owned number this call used.
        const viaNum = numbersRef.current.find((n) => toE164(n.number) === (s.callerNumber || "")) ?? numbersRef.current[0];
        const durText = s.startedAt ? duration : "";
        dispatch({ t: "LOG_CALL", call: {
          id: `k${Date.now()}`, numberId: viaNum?.id ?? "n1", contactFlag: "📞",
          contact: s.contact, direction: dir, status, duration: durText, time: "now",
        } });
        pushActivity({ kind: "call", title: dir === "missed" ? "Missed call" : dir === "incoming" ? "Incoming call" : "Call ended",
          body: `${inbound ? "Call from" : "Outgoing call to"} ${s.contact}${s.startedAt ? ` · ${duration}` : ""}.`, time: "just now" }, { persist: true });
        // Persist so the call survives a refresh (live mode).
        if (telnyx.mode === "live") {
          apiLogCall({ contact: s.contact, direction: dir, status, duration: durText, via: s.callerNumber || (viaNum ? toE164(viaNum.number) : "") }).catch(() => {});
        }
      }
    });
  }, [pushActivity]);

  // Register the softphone in the background whenever signed in + verified, so
  // inbound calls to the user's number ring the app. Unregister on sign-out.
  const authedForVoice = !!state.user && state.user.emailVerified !== false;
  useEffect(() => {
    if (authedForVoice) { voiceRegister(); initWebPush(); }
    else voiceUnregister();
  }, [authedForVoice]);

  const placeCall: Store["placeCall"] = useCallback((contact) => {
    const num = state.numbers.find((n) => n.id === state.activeNumberId) ?? state.numbers[0];
    voiceStart(toE164(contact), num ? toE164(num.number) : null);
    showToast(`Calling ${contact}…`);
  }, [state.numbers, state.activeNumberId, showToast]);

  const answerCall = useCallback(() => { voiceAnswer(); }, []);
  const hangupCall = useCallback(() => { voiceHangup(); }, []);
  const toggleCallMute = useCallback(() => { voiceToggleMute(); }, []);
  const dismissCall = useCallback(() => { voiceClear(); setActiveCall(null); }, []);

  const addBalance: Store["addBalance"] = useCallback((amount) => {
    dispatch({ t: "ADD_BALANCE", amount });
    pushActivity({ kind: "wallet", title: "Top-up successful", body: `$${amount.toFixed(2)} added to your wallet.`, time: "just now" });
    showToast(`$${amount.toFixed(2)} added to wallet`);
  }, [pushActivity, showToast]);

  // Buy a number. Every number belongs to a plan: the FIRST number on a plan is
  // free (pass opts.free), extras cost the flat rental billed to the WALLET. In
  // LIVE mode the server re-checks capacity and decides free-vs-paid — the client
  // price is a hint. A short wallet is topped up by card via Stripe elsewhere.
  const buyNumber: Store["buyNumber"] = useCallback(async (n, opts = {}) => {
    const kind: NumberKind = opts.kind ?? "local";
    const free = !!opts.free;
    const price = free ? 0 : NUMBER_RENTAL[kind];
    // Paid extras draw from the wallet, so they need funds up front; free ones don't.
    if (!free && state.wallet.balance < price) {
      showToast(`Top up your wallet — $${price.toFixed(2)} needed`, "error");
      return false;
    }
    if (telnyx.mode === "mock") {
      try {
        const order = await telnyx.createNumberOrder([toE164(n.number)]);
        const tid = order.phone_numbers[0]?.id ?? n.id;
        dispatch({ t: "BUY_NUMBER", number: { ...n, id: tid, price } });
        if (!free) dispatch({ t: "CHARGE_WALLET", amount: price, label: `Number ${n.number}` });
        pushActivity({ kind: "number", title: "Number added", body: free ? `${n.number} added free with your plan. Register it in Trust center to send SMS.` : `${n.number} added for $${price.toFixed(2)}/mo. Register it in Trust center to send SMS.`, time: "just now" });
        return true;
      } catch {
        showToast("Number order failed — try again", "error");
        return false;
      }
    }
    try {
      const res = await apiBuyNumber(toE164(n.number), kind);
      const tid = res.order?.phone_numbers?.[0]?.id ?? res.order?.id ?? n.id;
      const wasFree = res.free ?? free;
      dispatch({ t: "BUY_NUMBER", number: { ...n, id: tid, price: wasFree ? 0 : price } });
      if (res.wallet) dispatch({ t: "SET_WALLET", balance: res.wallet.balance, txns: toAppTxns(res.wallet) });
      pushActivity({ kind: "number", title: "Number added", body: wasFree ? `${n.number} added free with your plan. Register it in Trust center to send SMS.` : `${n.number} added for $${price.toFixed(2)}/mo. Register it in Trust center to send SMS.`, time: "just now" });
      // Refresh the plan so the number-capacity meter reflects the new number.
      refreshSubscription();
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't add number", "error");
      // Refresh the wallet from the DB (reflects any automatic refund).
      try { const w = await apiWallet(); dispatch({ t: "SET_WALLET", balance: w.balance, txns: toAppTxns(w) }); } catch { /* ignore */ }
      return false;
    }
  }, [state.wallet.balance, pushActivity, showToast, refreshSubscription]);

  // Release (give up) a number — frees it on Telnyx and stops its monthly rental.
  const releaseNumber: Store["releaseNumber"] = useCallback(async (id) => {
    const n = state.numbers.find((x) => x.id === id);
    if (!n) return false;
    if (telnyx.mode === "mock") {
      dispatch({ t: "REMOVE_NUMBER", id });
      showToast("Number released", "success");
      return true;
    }
    try {
      await apiReleaseNumber(toE164(n.number));
      dispatch({ t: "REMOVE_NUMBER", id });
      pushActivity({ kind: "number", title: "Number released", body: `${n.number} was released.`, time: "just now" });
      refreshSubscription(); // number-capacity meter reflects the freed slot
      showToast("Number released", "success");
      return true;
    } catch (e) { showToast(e instanceof Error ? e.message : "Couldn't release number", "error"); return false; }
  }, [state.numbers, pushActivity, showToast, refreshSubscription]);

  // Subscribe to a bundle. Pay from wallet (default) or by card. LIVE only — the
  // server sets the price by tier+cycle, charges, and activates the plan.
  const subscribe: Store["subscribe"] = useCallback(async (tier, cycle, opts = {}) => {
    const pay: PayMethod = opts.pay ?? "wallet";
    // Mock mode (local dev / demo, no backend): activate locally so the flow works.
    if (telnyx.mode === "mock") {
      const b = getBundle(tier);
      if (!b) { showToast("Unknown plan", "error"); return false; }
      const amount = cycle === "annual" ? b.annualTotal : b.monthly;
      if (pay === "wallet") {
        if (state.wallet.balance < amount) { showToast(`Top up your wallet — $${amount.toFixed(2)} needed`, "error"); return false; }
        dispatch({ t: "CHARGE_WALLET", amount, label: `${b.name} plan (${cycle})` });
      }
      applySub({
        tier: b.id, cycle, minutesIncluded: b.minutes, smsIncluded: b.sms,
        minutesUsed: 0, smsUsed: 0, status: "active",
        periodEnd: Date.now() + (cycle === "annual" ? 365 : 30) * 86400000,
        payMethod: pay, autoRenew: true, renewAmount: amount,
        numbersUsed: 0, numbersIncluded: b.numbersIncluded, numbersMax: b.maxNumbers,
      });
      pushActivity({ kind: "wallet", title: "Plan activated", body: `Your ${b.name} plan (${cycle}) is now active.`, time: "just now" });
      return true;
    }
    try {
      const res = await apiSubscribe(tier, cycle);
      if (res.subscription) applySub(toAppSub(res.subscription));
      if (res.wallet) dispatch({ t: "SET_WALLET", balance: res.wallet.balance, txns: toAppTxns(res.wallet) });
      pushActivity({ kind: "wallet", title: "Plan activated", body: `Your ${tier} plan (${cycle}) is now active.`, time: "just now" });
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't activate plan", "error");
      try { const w = await apiWallet(); dispatch({ t: "SET_WALLET", balance: w.balance, txns: toAppTxns(w) }); } catch { /* ignore */ }
      return false;
    }
  }, [state.wallet.balance, pushActivity, showToast, applySub]);

  // Subscribe to a plan AND claim a number in one flow: the plan is charged, then
  // the number is charged (no number is free) — both from the wallet. Used by the
  // Buy-a-Number modal where picking a plan is required to get a number.
  const subscribeAndBuy: Store["subscribeAndBuy"] = useCallback(async (n, tier, cycle, opts = {}) => {
    const ok = await subscribe(tier, cycle, { pay: opts.pay ?? "wallet" });
    if (!ok) return false;
    // Numbers are never free — charge the rental (from the wallet).
    return buyNumber(n, { kind: opts.kind ?? "local", free: false });
  }, [subscribe, buyNumber]);

  // Pay for a NEW plan + number by CARD via Stripe Checkout. Stripe charges the
  // combined amount and the webhook activates the plan AND provisions the number
  // SERVER-SIDE; the browser redirects to Stripe and returns to ?pay=success.
  const subscribeByCardAndBuy: Store["subscribeByCardAndBuy"] = useCallback(async (n, tier, cycle) => {
    if (telnyx.mode === "mock") { // dev/demo: activate locally then charge the number
      const ok = await subscribe(tier, cycle, { pay: "card" });
      return ok ? buyNumber(n, { kind: "local", free: false }) : false;
    }
    try {
      // PhoneNumber has no `e164` field — derive strict E.164 from the formatted
      // display number (n.e164 was undefined here, so the webhook silently
      // skipped provisioning the paid number).
      await startCheckout({ kind: "plan_number", tier, cycle, phone: toE164(n.number), numberKind: "local" });
      return true; // page redirects to Stripe Checkout
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Checkout failed", "error");
      return false;
    }
  }, [subscribe, buyNumber, showToast]);

  // Toggle wallet-funded auto-renew for the active plan.
  const setAutoRenew: Store["setAutoRenew"] = useCallback(async (on) => {
    if (telnyx.mode === "mock") {
      dispatch({ t: "SET_SUBSCRIPTION", subscription: state.subscription ? { ...state.subscription, autoRenew: on } : null });
      return;
    }
    try {
      const { subscription } = await apiSetAutoRenew(on);
      applySub(toAppSub(subscription));
    } catch (e) { showToast(e instanceof Error ? e.message : "Couldn't update auto-renew", "error"); }
  }, [state.subscription, showToast, applySub]);

  // Cancel the active plan → revert to pay-as-you-go.
  const cancelSubscription: Store["cancelSubscription"] = useCallback(async () => {
    if (telnyx.mode === "mock") {
      dispatch({ t: "SET_SUBSCRIPTION", subscription: null });
      showToast("Plan cancelled", "success");
      return true;
    }
    try {
      const { subscription } = await apiCancelSubscription();
      applySub(toAppSub(subscription));
      showToast("Plan cancelled — you're now on pay-as-you-go", "success");
      return true;
    } catch (e) { showToast(e instanceof Error ? e.message : "Couldn't cancel plan", "error"); return false; }
  }, [showToast, applySub]);

  // Search Telnyx for purchasable numbers of a chosen type (local or mobile),
  // priced retail (wholesale + markup). The buy screen lets the user pick the
  // type and explains the difference (local = geographic/cheaper, often voice
  // only outside US/CA; mobile = voice + SMS everywhere, costs a bit more).
  const searchNumbers: Store["searchNumbers"] = useCallback(async (countryIso, type, areaCode) => {
    try {
      const list = await telnyx.searchAvailable({
        country_code: countryIso,
        // area code only applies to geographic (local) numbers
        national_destination_code: type === "local" ? areaCode?.trim() || undefined : undefined,
        features: ["voice"],
        phone_number_type: type,
        limit: 8,
      });
      return list.map((a) => {
        const { number, price, sms, voice } = availableToApp(a);
        return { e164: a.phone_number, number, price: retailPrice(price), sms, voice };
      });
    } catch {
      showToast("Couldn't load numbers — try again", "error");
      return [];
    }
  }, [showToast]);

  const readAllActivity = useCallback(() => {
    dispatch({ t: "READ_ALL_ACTIVITY" });
    if (telnyx.mode === "live") apiMarkActivityRead().catch(() => {});
  }, []);
  const updateUser = useCallback((patch: Partial<User>) => dispatch({ t: "UPDATE_USER", patch }), []);
  const togglePref = useCallback((key: keyof Preferences) => dispatch({ t: "TOGGLE_PREF", key }), []);
  const block = useCallback((num: string) => dispatch({ t: "BLOCK", num }), []);
  const unblock = useCallback((num: string) => dispatch({ t: "UNBLOCK", num }), []);

  // sendMessage is the key gated action: a number must be verified to send.
  const sendMessage: Store["sendMessage"] = useCallback((convoId, text) => {
    const convo = state.conversations.find((c) => c.id === convoId);
    const num = state.numbers.find((n) => n.id === convo?.numberId);
    if (num && num.verification !== "verified") {
      showToast("Register this number in Trust center to send SMS", "error");
      return false;
    }
    // Optimistic append, then reflect Telnyx delivery lifecycle: sending → sent → delivered.
    const msgId = `m${Date.now()}`;
    dispatch({ t: "APPEND_MESSAGE", convoId, message: { id: msgId, text, sent: true, time: now(), status: "sending" } });
    if (num && convo) {
      (async () => {
        try {
          const sent = await telnyx.sendMessage(toE164(num.number), toE164(convo.contact), text);
          dispatch({ t: "UPDATE_MSG_STATUS", convoId, messageId: msgId, status: "sent", telnyxId: sent.id });
          // The server meters this send against the plan's SMS pool — re-pull the
          // plan so usage + any near-limit alert reflect it.
          refreshSubscription();
          const dlr = await telnyx.getMessageStatus(sent.id);
          dispatch({ t: "UPDATE_MSG_STATUS", convoId, messageId: msgId, status: dlr === "delivered" ? "delivered" : "failed" });
        } catch {
          dispatch({ t: "UPDATE_MSG_STATUS", convoId, messageId: msgId, status: "failed" });
        }
      })();
    }
    return true;
  }, [state.conversations, state.numbers, showToast, refreshSubscription]);

  // Compose a brand-new message: pick the active (verified) number, resolve/create
  // the thread for the destination contact, then fire the same send pipeline. Used
  // by the "New message" button (web + mobile) — the app previously had no way to
  // start a conversation, only reply to existing ones.
  const startConversation: Store["startConversation"] = useCallback((contactRaw, text) => {
    const num = state.numbers.find((n) => n.id === state.activeNumberId) ?? state.numbers[0];
    if (!num) { showToast("Get a number first to send messages", "error"); return { ok: false }; }
    if (num.verification !== "verified") { showToast("Register this number in Trust center to send SMS", "error"); return { ok: false }; }
    const contact = toE164(contactRaw);
    if (contact.replace(/\D/g, "").length < 7) { showToast("Enter a valid phone number", "error"); return { ok: false }; }
    if (!text.trim()) return { ok: false };

    const existing = state.conversations.find((c) => c.numberId === num.id && toE164(c.contact) === contact);
    const convoId = existing?.id ?? `local_${Date.now()}`;
    if (!existing) {
      dispatch({ t: "ADD_CONVERSATION", conversation: {
        id: convoId, numberId: num.id, contactFlag: "💬", contact, preview: text.trim(), time: "now", unread: 0, messages: [],
      } });
    }
    const msgId = `m${Date.now()}`;
    dispatch({ t: "APPEND_MESSAGE", convoId, message: { id: msgId, text: text.trim(), sent: true, time: now(), status: "sending" } });
    (async () => {
      try {
        const sent = await telnyx.sendMessage(toE164(num.number), contact, text.trim());
        dispatch({ t: "UPDATE_MSG_STATUS", convoId, messageId: msgId, status: "sent", telnyxId: sent.id });
        refreshSubscription();
        const dlr = await telnyx.getMessageStatus(sent.id);
        dispatch({ t: "UPDATE_MSG_STATUS", convoId, messageId: msgId, status: dlr === "delivered" ? "delivered" : "failed" });
      } catch {
        dispatch({ t: "UPDATE_MSG_STATUS", convoId, messageId: msgId, status: "failed" });
      }
    })();
    return { ok: true, convoId };
  }, [state.numbers, state.activeNumberId, state.conversations, showToast, refreshSubscription]);

  return (
    <Ctx.Provider value={{
      state, toasts, showToast,
      login, logout, selectNumber, registerNumber, registerBrand, updateSettings,
      getNumberRequirements, submitNumberDoc, markNumberVerified,
      telnyxMode: telnyx.mode,
      sendMessage, startConversation, markRead, placeCall, activeCall, answerCall, hangupCall, toggleCallMute, dismissCall, addBalance, setWallet, refreshWallet, syncBillingSoon, buyNumber, releaseNumber, subscribe, subscribeAndBuy, subscribeByCardAndBuy, setAutoRenew, cancelSubscription, resendVerification, refreshUser, refreshSubscription, searchNumbers, readAllActivity,
      updateUser, togglePref, block, unblock,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}

/** Convenience selectors. */
export function useActiveNumber(): PhoneNumber | undefined {
  const { state } = useApp();
  return state.numbers.find((n) => n.id === state.activeNumberId) ?? state.numbers[0];
}
