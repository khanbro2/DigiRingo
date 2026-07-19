/** Authed fetch for the Control Hub — attaches the admin/agent bearer token. */
import { getAdminToken } from "./adminAuth";

async function areq<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const r = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || "Request failed");
  return j as T;
}

/* ---- support chat ---- */
export interface AdminThread { userId: number; name: string; email: string; unread: number; lastSender: string; lastBody: string; time: string; }
export interface AdminSupportMessage { id: string; sender: "user" | "agent"; agentName: string | null; body: string; time: string; }

export const adminGetThreads = () => areq<{ threads: AdminThread[] }>("/api/support/threads");
export const adminGetThread = (userId: number) => areq<{ messages: AdminSupportMessage[] }>(`/api/support/thread?userId=${userId}`);
export const adminReply = (userId: number, body: string) =>
  areq<{ ok: boolean; messages: AdminSupportMessage[] }>(`/api/support/thread?userId=${userId}`, { method: "POST", body: JSON.stringify({ body }) });

/* ---- team (agents) ---- */
export interface AdminAgent { id: number; name: string; email: string; active: boolean; time: string; }
export const adminGetAgents = () => areq<{ agents: AdminAgent[] }>("/api/admin/agents");
export const adminCreateAgent = (a: { name: string; email: string; password: string }) =>
  areq<{ ok: boolean; agent: AdminAgent }>("/api/admin/agents", { method: "POST", body: JSON.stringify(a) });
export const adminDeleteAgent = (id: number) =>
  areq<{ ok: boolean }>(`/api/admin/agents?id=${id}`, { method: "DELETE" });

/* ---- client management (real DB data) ---- */
export interface AdminUserRow {
  id: number; name: string; email: string; plan: string;
  numbers: number; balance: number; status: string; verified: boolean; joined: string;
}
export interface WalletTxn { id: string; amount: number; label: string; kind: string; time: string; }
export interface AdminUserNumber { id: string; e164: string; kind: string; free: boolean; time: string; }
export interface AdminActivity { id: string; kind: string; title: string; body: string; time: string; read: boolean; }
export interface AdminSubscription { tier: string; cycle: string; status: string; minutesIncluded: number; smsIncluded: number; minutesUsed: number; smsUsed: number; renewAmount: number; }
export interface AdminUserDetail {
  id: number; name: string; email: string; status: string; verified: boolean; joined: string;
  wallet: { balance: number; txns: WalletTxn[] };
  numbers: AdminUserNumber[];
  activity: AdminActivity[];
  subscription: AdminSubscription | null;
}
export interface AdminNumberRow { id: string; number: string; owner: string; email: string; kind: string; status: string; free: boolean; time: string; }
export interface AdminTxnRow { id: string; user: string; email: string; label: string; kind: string; amount: number; time: string; }
export interface AdminKpis {
  totalUsers: number; activeNumbers: number; mrr: number; smsSent7d: number; walletTotal: number; suspended: number;
  messages7d: Array<{ d: string; sms: number }>;
  revenue6m: Array<{ m: string; rev: number }>;
}

export const adminListUsers = (q = "") => areq<{ users: AdminUserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
export const adminGetUser = (id: number) => areq<{ user: AdminUserDetail }>(`/api/admin/user?id=${id}`);
export const adminSetStatus = (userId: number, status: "active" | "suspended") =>
  areq<{ ok: boolean; status: string }>("/api/admin/user/status", { method: "POST", body: JSON.stringify({ userId, status }) });
export const adminAdjustWallet = (userId: number, amount: number, label: string) =>
  areq<{ ok: boolean; wallet: { balance: number; txns: WalletTxn[] } }>("/api/admin/wallet", { method: "POST", body: JSON.stringify({ userId, amount, label }) });
export const adminSetSubscription = (userId: number, action: "cancel" | "pause" | "resume") =>
  areq<{ subscription: AdminSubscription | null }>("/api/admin/user/subscription", { method: "POST", body: JSON.stringify({ userId, action }) });
export const adminReleaseNumber = (userId: number, e164: string) =>
  areq<{ ok: boolean; released: boolean; telnyxReleased: boolean }>("/api/admin/user/number", { method: "POST", body: JSON.stringify({ userId, e164 }) });
export const adminListNumbers = (q = "") => areq<{ numbers: AdminNumberRow[] }>(`/api/admin/numbers?q=${encodeURIComponent(q)}`);
export const adminListTransactions = () => areq<{ txns: AdminTxnRow[] }>("/api/admin/transactions");
export const adminGetKpis = () => areq<AdminKpis>("/api/admin/kpis");

/* ---- billing ---- */
export interface AdminInvoice { id: string; user: string; email: string; period: string; amount: number; status: string; }
export interface AdminBilling { planCounts: Record<string, number>; invoices: AdminInvoice[]; }
export const adminGetBilling = () => areq<AdminBilling>("/api/admin/billing");

/* ---- config (Payments / Integrations / Settings) ---- */
export interface ConfigProvider { id: string; name: string; blurb: string; connected: boolean; enabled: boolean; secretLast4?: string; account?: string; }
export interface ConfigCredential { id: string; service: string; blurb: string; status: "set" | "missing"; last4?: string; source?: "dashboard" | "env"; }
export interface ConfigWebhook { id: string; label: string; url: string; enabled: boolean; secretSet: boolean; }
export interface ConfigPlatformKey { id: string; name: string; masked: string; created: string; lastUsed: string; }
export interface ConfigGeneral {
  platformName: string; supportEmail: string; currency: string; platformFeePct: number;
  payoutSchedule: string; payoutDestination: string;
  alerts?: { newUsers: boolean; failedPayments: boolean; lowBalance: boolean };
}
export interface AdminConfig {
  providers: ConfigProvider[]; credentials: ConfigCredential[];
  platformKeys: ConfigPlatformKey[]; webhooks: ConfigWebhook[]; general: ConfigGeneral;
}

export const adminGetConfig = () => areq<AdminConfig>("/api/admin/config");
export const adminSaveSecret = (name: string, value: string) =>
  areq<AdminConfig>("/api/admin/config/secret", { method: "POST", body: JSON.stringify({ name, value }) });
export const adminSaveGeneral = (patch: Partial<ConfigGeneral>) =>
  areq<AdminConfig>("/api/admin/config/general", { method: "POST", body: JSON.stringify({ patch }) });
export const adminSaveProvider = (p: { id: string; enabled?: boolean; account?: string; secret?: string }) =>
  areq<AdminConfig>("/api/admin/config/provider", { method: "POST", body: JSON.stringify(p) });
export const adminSaveWebhook = (w: { action: "add" | "toggle"; id?: string; label?: string; url?: string }) =>
  areq<AdminConfig>("/api/admin/config/webhook", { method: "POST", body: JSON.stringify(w) });
export const adminCreateKey = (name: string) =>
  areq<{ ok: boolean; key: string; config: AdminConfig }>("/api/admin/config/key", { method: "POST", body: JSON.stringify({ name }) });
export const adminRevokeKey = (id: string) =>
  areq<AdminConfig>(`/api/admin/config/key?id=${encodeURIComponent(id)}`, { method: "DELETE" });
