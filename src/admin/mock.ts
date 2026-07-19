/**
 * Control Hub mock dataset. In production these come from YOUR backend admin
 * API (which aggregates your user DB + Telnyx). Telnyx-derived figures (numbers,
 * balance, 10DLC) can also be pulled live via the shared telnyx service.
 */
export interface AdminUser {
  id: string; name: string; email: string; plan: "Starter" | "Pro" | "Business";
  numbers: number; balance: number; status: "active" | "suspended" | "trial"; joined: string;
}
export interface AdminNumber {
  number: string; flag: string; owner: string; type: string;
  status: "active" | "pending"; tenDlc: "verified" | "pending" | "unverified"; monthly: number;
}
export type TxnType = "top-up" | "sms" | "number" | "call" | "refund" | "subscription";
export interface Txn {
  id: string; date: string; user: string; type: TxnType; amount: number; status: "completed" | "pending" | "failed";
}
export interface Invoice { id: string; user: string; period: string; amount: number; status: "paid" | "due" | "overdue"; }
export interface Plan { name: string; price: number; numbers: string; sms: string; features: string[]; users: number; }

export const KPIS = {
  totalUsers: 1284,
  activeNumbers: 3791,
  mrr: 18420,
  smsSent: 128400,
  callMinutes: 9240,
};

export const MESSAGES_7D = [
  { d: "Mon", sms: 16200, mms: 1800 }, { d: "Tue", sms: 18900, mms: 2100 },
  { d: "Wed", sms: 17400, mms: 1600 }, { d: "Thu", sms: 21200, mms: 2400 },
  { d: "Fri", sms: 24800, mms: 2900 }, { d: "Sat", sms: 14100, mms: 1200 },
  { d: "Sun", sms: 11800, mms: 980 },
];
export const REVENUE_6M = [
  { m: "Jan", rev: 12400 }, { m: "Feb", rev: 13800 }, { m: "Mar", rev: 14900 },
  { m: "Apr", rev: 16100 }, { m: "May", rev: 17300 }, { m: "Jun", rev: 18420 },
];

export const USERS: AdminUser[] = [
  { id: "u1", name: "Ali Hassan",      email: "ali@digiringo.app",     plan: "Pro",      numbers: 7, balance: 24.50, status: "active",    joined: "May 1, 2026" },
  { id: "u2", name: "Sarah Chen",      email: "sarah@brightmail.io",  plan: "Business", numbers: 22, balance: 142.10, status: "active",   joined: "Apr 12, 2026" },
  { id: "u3", name: "Marcus Wright",   email: "m.wright@acme.co",     plan: "Starter",  numbers: 2, balance: 4.20,  status: "trial",     joined: "Jun 9, 2026" },
  { id: "u4", name: "Yuki Tanaka",     email: "yuki@tokyodesk.jp",    plan: "Pro",      numbers: 9, balance: 61.75, status: "active",    joined: "Mar 3, 2026" },
  { id: "u5", name: "Emma Müller",     email: "emma@digitalatlas.de", plan: "Business", numbers: 31, balance: 0.00,  status: "suspended", joined: "Feb 18, 2026" },
  { id: "u6", name: "Diego Santos",    email: "diego@outbound.br",    plan: "Starter",  numbers: 1, balance: 9.99,  status: "active",    joined: "Jun 11, 2026" },
];

export const NUMBERS: AdminNumber[] = [
  { number: "+1 (415) 555-0182", flag: "🇺🇸", owner: "Ali Hassan",    type: "Local",    status: "active",  tenDlc: "verified",   monthly: 2.99 },
  { number: "+44 7700 900142",   flag: "🇬🇧", owner: "Ali Hassan",    type: "Mobile",   status: "active",  tenDlc: "unverified", monthly: 3.49 },
  { number: "+1 (628) 555-0231", flag: "🇺🇸", owner: "Sarah Chen",    type: "Local",    status: "active",  tenDlc: "verified",   monthly: 2.99 },
  { number: "+1 (888) 200-7711", flag: "🇺🇸", owner: "Sarah Chen",    type: "Toll-free",status: "active",  tenDlc: "pending",    monthly: 4.99 },
  { number: "+81 3-1234-5678",   flag: "🇯🇵", owner: "Yuki Tanaka",   type: "Local",    status: "active",  tenDlc: "verified",   monthly: 5.99 },
  { number: "+49 30 901820",     flag: "🇩🇪", owner: "Emma Müller",   type: "Local",    status: "pending", tenDlc: "unverified", monthly: 4.99 },
];

export const TXNS: Txn[] = [
  { id: "tx_8821", date: "Jun 15, 2026", user: "Sarah Chen",    type: "subscription", amount:  79.00, status: "completed" },
  { id: "tx_8820", date: "Jun 15, 2026", user: "Ali Hassan",    type: "top-up",       amount:  20.00, status: "completed" },
  { id: "tx_8819", date: "Jun 14, 2026", user: "Yuki Tanaka",   type: "number",       amount:  -5.99, status: "completed" },
  { id: "tx_8818", date: "Jun 14, 2026", user: "Marcus Wright", type: "sms",          amount:  -3.20, status: "completed" },
  { id: "tx_8817", date: "Jun 13, 2026", user: "Diego Santos",  type: "top-up",       amount:  10.00, status: "pending"   },
  { id: "tx_8816", date: "Jun 13, 2026", user: "Sarah Chen",    type: "call",         amount:  -1.85, status: "completed" },
  { id: "tx_8815", date: "Jun 12, 2026", user: "Emma Müller",   type: "refund",       amount:   4.99, status: "completed" },
  { id: "tx_8814", date: "Jun 12, 2026", user: "Ali Hassan",    type: "number",       amount:  -2.99, status: "failed"    },
];

export const INVOICES: Invoice[] = [
  { id: "INV-2026-061", user: "Sarah Chen",  period: "Jun 2026", amount: 79.00, status: "paid" },
  { id: "INV-2026-060", user: "Ali Hassan",  period: "Jun 2026", amount: 29.00, status: "paid" },
  { id: "INV-2026-059", user: "Yuki Tanaka", period: "Jun 2026", amount: 29.00, status: "due" },
  { id: "INV-2026-058", user: "Emma Müller", period: "Jun 2026", amount: 79.00, status: "overdue" },
];

export const PLANS: Plan[] = [
  { name: "Starter",  price: 9,  numbers: "1 number",   sms: "500 SMS/mo",      users: 412, features: ["1 phone number", "500 SMS / month", "Email support"] },
  { name: "Pro",      price: 29, numbers: "10 numbers", sms: "5,000 SMS/mo",    users: 638, features: ["10 phone numbers", "5,000 SMS / month", "Voice + recording", "Priority support"] },
  { name: "Business", price: 79, numbers: "Unlimited",  sms: "25,000 SMS/mo",   users: 234, features: ["Unlimited numbers", "25,000 SMS / month", "10DLC included", "Dedicated manager"] },
];
