/**
 * In-memory mock of the Telnyx API, returning the real wire shapes.
 * Used when VITE_TELNYX_MODE !== "live" so the app runs with no backend/key.
 * Phone-number ids mirror the app seed (n1…n7) so conversations/calls line up.
 */
import type {
  AvailablePhoneNumber, NumberOrder, PhoneNumberDetailed, Message,
  Brand, Campaign, PhoneNumberCampaign, Verification, VerifyResult,
  Call, DetailRecord, Balance, ConversationThread, MessagingProfile,
} from "./types";
import { DEFAULT_MESSAGING_PROFILE_ID } from "./config";

let seq = 1000;
const id = (p: string) => `${p}_${++seq}`;

/* canonical owned numbers (mirror the app seed) */
const OWNED: PhoneNumberDetailed[] = [
  { id: "n1", record_type: "phone_number", phone_number: "+14155550182", country_iso_alpha2: "US", status: "active", phone_number_type: "local",    messaging_profile_id: DEFAULT_MESSAGING_PROFILE_ID, purchased_at: "2026-05-01T10:00:00Z" },
  { id: "n2", record_type: "phone_number", phone_number: "+447700900142", country_iso_alpha2: "GB", status: "active", phone_number_type: "mobile",   purchased_at: "2026-05-03T10:00:00Z" },
  { id: "n3", record_type: "phone_number", phone_number: "+4930901820",   country_iso_alpha2: "DE", status: "active", phone_number_type: "local",    purchased_at: "2026-05-04T10:00:00Z" },
  { id: "n4", record_type: "phone_number", phone_number: "+33170189900",  country_iso_alpha2: "FR", status: "active", phone_number_type: "local",    purchased_at: "2026-05-06T10:00:00Z" },
  { id: "n5", record_type: "phone_number", phone_number: "+17785550199",  country_iso_alpha2: "CA", status: "active", phone_number_type: "local",    purchased_at: "2026-05-08T10:00:00Z" },
  { id: "n6", record_type: "phone_number", phone_number: "+81312345678",  country_iso_alpha2: "JP", status: "active", phone_number_type: "local",    purchased_at: "2026-05-10T10:00:00Z" },
  { id: "n7", record_type: "phone_number", phone_number: "+61298765432",  country_iso_alpha2: "AU", status: "active", phone_number_type: "local",    purchased_at: "2026-05-12T10:00:00Z" },
];

/* messaging profile */
const PROFILE: MessagingProfile = { id: DEFAULT_MESSAGING_PROFILE_ID, record_type: "messaging_profile", name: "DIGIRINGO Default", enabled: true };

/* backend messaging store: threads grouped per owned number + contact */
const THREADS: ConversationThread[] = [
  { id: "c1", phone_number_id: "n1", contact: "+1 (847) 793-1243", contact_flag: "🇺🇸", unread: 3, time: "2m", messages: [
    { id: "tm1", direction: "outbound", text: "Hi, I need help verifying my account.", status: "delivered", time: "10:21 AM" },
    { id: "tm2", direction: "inbound",  text: "Your verification code is 847291",       status: "delivered", time: "10:22 AM" },
    { id: "tm3", direction: "outbound", text: "Thank you so much!",                      status: "delivered", time: "10:23 AM" },
    { id: "tm4", direction: "inbound",  text: "This code expires in 10 minutes.",        status: "delivered", time: "10:23 AM" },
  ]},
  { id: "c2", phone_number_id: "n1", contact: "+1 (307) 433-8101", contact_flag: "🇺🇸", unread: 0, time: "Jun 4", messages: [
    { id: "tm1", direction: "inbound",  text: "Are you available for a quick call?", status: "delivered", time: "9:00 AM" },
    { id: "tm2", direction: "outbound", text: "Sure, calling now.",                   status: "delivered", time: "9:01 AM" },
  ]},
  { id: "c3", phone_number_id: "n2", contact: "+44 7700 118822", contact_flag: "🇬🇧", unread: 1, time: "14m", messages: [
    { id: "tm1", direction: "inbound",  text: "Hello! Is this number still available?", status: "delivered", time: "9:46 AM" },
    { id: "tm2", direction: "outbound", text: "Yes, it's active!",                       status: "delivered", time: "9:48 AM" },
  ]},
  { id: "c4", phone_number_id: "n3", contact: "+49 151 23456789", contact_flag: "🇩🇪", unread: 0, time: "1h", messages: [
    { id: "tm1", direction: "inbound", text: "Danke für Ihre Bestellung!", status: "delivered", time: "9:05 AM" },
  ]},
  { id: "c5", phone_number_id: "n5", contact: "+1 (778) 200-7788", contact_flag: "🇨🇦", unread: 0, time: "5h", messages: [
    { id: "tm1", direction: "outbound", text: "Can we confirm meeting tomorrow at 3pm?", status: "delivered", time: "5:00 AM" },
    { id: "tm2", direction: "inbound",  text: "Meeting confirmed for tomorrow at 3pm.",  status: "delivered", time: "5:12 AM" },
  ]},
];

/* call detail records (CDRs) */
const CDRS: DetailRecord[] = [
  { id: "k1", record_type: "call-control", direction: "incoming", from: "+1 (847) 793-1243", to: "+14155550182", duration_secs: 252, status: "completed", cost: "0.012", started_at: "Tue" },
  { id: "k2", record_type: "call-control", direction: "outgoing", from: "+14155550182", to: "+1 (307) 433-8101", duration_secs: 98,  status: "completed", cost: "0.009", started_at: "Jun 4" },
  { id: "k3", record_type: "call-control", direction: "incoming", from: "+1 (307) 632-1553", to: "+14155550182", duration_secs: 0,   status: "missed",    cost: "0.000", started_at: "Jun 4" },
  { id: "k4", record_type: "call-control", direction: "outgoing", from: "+4930901820", to: "+49 151 23456789",   duration_secs: 46,  status: "completed", cost: "0.020", started_at: "Jun 3" },
  { id: "k5", record_type: "call-control", direction: "incoming", from: "+1 (307) 773-3838", to: "+14155550182", duration_secs: 21,  status: "voicemail", cost: "0.004", started_at: "Jun 2" },
  { id: "k6", record_type: "call-control", direction: "outgoing", from: "+81312345678", to: "+81 90-1234-5678",  duration_secs: 485, status: "completed", cost: "0.085", started_at: "Jun 1" },
];

/* account-level 10DLC brand + a default campaign */
let brand: Brand | null = null;
let campaign: Campaign | null = null;

const wait = <T>(value: T, ms = 350): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const COUNTRY_DIAL: Record<string, string> = { US: "+1", CA: "+1", GB: "+44", DE: "+49", FR: "+33", JP: "+81", AU: "+61", BR: "+55" };

export const mock = {
  /* §2 search */
  async searchAvailable(filter: { country_code?: string; national_destination_code?: string; features?: string[]; limit?: number }): Promise<AvailablePhoneNumber[]> {
    const cc = filter.country_code ?? "US";
    const dial = COUNTRY_DIAL[cc] ?? "+1";
    const ndc = filter.national_destination_code ?? (cc === "US" || cc === "CA" ? "628" : "20");
    const feats = (filter.features ?? ["sms", "voice"]).map((name) => ({ name }));
    const n = filter.limit ?? 6;
    const monthly = cc === "JP" ? "5.99" : cc === "DE" ? "4.99" : cc === "GB" ? "3.49" : "2.99";
    const out: AvailablePhoneNumber[] = [];
    for (let i = 0; i < n; i++) {
      const tail = String(1000 + Math.floor((seq + i * 37) % 8999)).padStart(4, "0");
      out.push({
        record_type: "available_phone_number",
        phone_number: `${dial}${ndc}555${tail}`,
        best_effort: false, quickship: true, reservable: true,
        region_information: [{ region_type: "country_code", region_name: cc }],
        cost_information: { upfront_cost: "1.00", monthly_cost: monthly, currency: "USD" },
        features: feats,
      });
    }
    return wait(out);
  },

  /* §3 order */
  async createNumberOrder(phoneNumbers: string[]): Promise<NumberOrder> {
    return wait({
      id: id("order"), record_type: "number_order", status: "success",
      phone_numbers_count: phoneNumbers.length, messaging_profile_id: DEFAULT_MESSAGING_PROFILE_ID,
      phone_numbers: phoneNumbers.map((pn) => ({ id: id("num"), phone_number: pn, phone_number_type: "local", status: "success" })),
      created_at: new Date().toISOString(),
    });
  },

  /* §4 owned */
  async listPhoneNumbers(): Promise<PhoneNumberDetailed[]> { return wait([...OWNED], 250); },

  /* §5 messaging */
  async listConversations(): Promise<ConversationThread[]> { return wait(THREADS.map((t) => ({ ...t })), 250); },
  async listMessagingProfiles(): Promise<MessagingProfile[]> { return wait([PROFILE]); },

  async sendMessage(body: { from: string; to: string; text: string }): Promise<Message> {
    return wait({
      id: id("msg"), record_type: "message", direction: "outbound", type: "SMS",
      messaging_profile_id: DEFAULT_MESSAGING_PROFILE_ID,
      from: { phone_number: body.from, line_type: "Wireless" },
      to: [{ phone_number: body.to, status: "sent", line_type: "Wireless" }],
      text: body.text, parts: 1, cost: { amount: "0.0040", currency: "USD" },
      sent_at: new Date().toISOString(),
    }, 200);
  },

  // Delivery receipt (DLR) — Telnyx normally pushes this via webhook; mock polls.
  async getMessageStatus(_id: string): Promise<"delivered" | "delivery_failed"> {
    void _id; return wait("delivered", 600);
  },

  /* §6 10DLC */
  async getBrand(): Promise<Brand | null> { return wait(brand, 150); },
  async registerBrand(displayName: string, entityType = "PRIVATE_PROFIT"): Promise<Brand> {
    brand = { brandId: id("brand"), tcrBrandId: id("BRAND"), displayName, entityType, status: "VERIFIED" };
    return wait(brand);
  },
  async createCampaign(usecase = "MIXED"): Promise<Campaign> {
    if (!brand) throw new Error("Register a brand first");
    campaign = { campaignId: id("camp"), tcrCampaignId: id("CAMP"), brandId: brand.brandId, usecase, status: "TCR_ACCEPTED" };
    return wait(campaign);
  },
  async assignNumber(phoneNumber: string): Promise<PhoneNumberCampaign> {
    if (!campaign) throw new Error("Create a campaign first");
    return wait({ phoneNumber, campaignId: campaign.campaignId, status: "ASSIGNED" });
  },

  /* §7 number regulatory requirements (mock: US/CA need nothing, others need docs) */
  async getNumberRequirements(phoneNumber: string) {
    const d = (phoneNumber || "").replace(/\D/g, "");
    const isNanp = d.startsWith("1");
    if (isNanp) return wait([], 200);
    return wait([
      { id: "proof_of_id", name: "Proof of identity", description: "Government-issued ID (passport or national ID).", type: "document" as const, required: true },
      { id: "proof_of_address", name: "Proof of address", description: "Utility bill or bank statement (last 3 months).", type: "document" as const, required: true },
      { id: "local_address", name: "Local address", description: "A registered address in the number's country.", type: "address" as const, required: true },
    ], 250);
  },
  async submitRegulatoryDoc(phoneNumber: string, requirementId: string, fileName: string) {
    void phoneNumber; void requirementId; void fileName;
    return wait({ ok: true }, 400);
  },

  /* §7 Verify (OTP) */
  async createVerification(phone_number: string): Promise<Verification> {
    return wait({ id: id("ver"), phone_number, type: "sms", verify_profile_id: "vp_mock", status: "pending" });
  },
  async verifyCode(phone_number: string, code: string): Promise<VerifyResult> {
    return wait({ phone_number, response_code: code.length === 6 ? "accepted" : "rejected" });
  },

  /* §8 voice */
  async createCall(to: string, from: string): Promise<Call> {
    void from;
    return wait({ record_type: "call", call_control_id: id("cc"), call_leg_id: id("leg"), call_session_id: id("sess"), is_alive: true }, 150);
  },
  async listDetailRecords(): Promise<DetailRecord[]> { return wait(CDRS.map((r) => ({ ...r })), 250); },

  /* §4 number sub-resources (settings sync) */
  async updateNumberMessaging(_id: string, _profileId: string): Promise<{ ok: true }> { void _id; void _profileId; return wait({ ok: true }, 120); },
  async updateNumberVoice(_id: string, _settings: Record<string, unknown>): Promise<{ ok: true }> { void _id; void _settings; return wait({ ok: true }, 120); },

  /* §9 balance */
  async getBalance(): Promise<Balance> {
    return wait({ record_type: "balance", balance: "24.50", credit_limit: "100.00", available_credit: "124.50", pending: "0.00", currency: "USD" }, 150);
  },
};
