import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X, ShieldCheck, Building2, Megaphone, FileUp, Check, Loader2 } from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import type { BrandRegistration, CampaignRegistration, RegulatoryRequirement } from "../core/types";
import { useApp } from "../store/AppStore";

/* ============================================================================
   Verification forms — the real KYC/registration flows that gate SMS sending.
   - BrandForm:        10DLC business profile (A2P "KYC"; no document upload).
   - CampaignForm:     use case + sample messages + consent (opt-in) flow.
   - RegulatoryDocsForm: document upload for numbers whose country requires it.
   All run inside the app (no Telnyx popup); they submit to Telnyx via the store.
   ========================================================================== */

const ENTITY_TYPES = [
  { v: "PRIVATE_PROFIT", l: "Private company" },
  { v: "PUBLIC_PROFIT", l: "Public company" },
  { v: "NON_PROFIT", l: "Non-profit" },
  { v: "GOVERNMENT", l: "Government" },
  { v: "SOLE_PROPRIETOR", l: "Sole proprietor" },
];
// Full TCR industry list (Telnyx `vertical` enum).
const VERTICALS = ["PROFESSIONAL", "REAL_ESTATE", "HEALTHCARE", "HUMAN_RESOURCES", "ENERGY", "ENTERTAINMENT", "RETAIL", "TRANSPORTATION", "AGRICULTURE", "INSURANCE", "POSTAL", "EDUCATION", "HOSPITALITY", "FINANCIAL", "POLITICAL", "GAMBLING", "LEGAL", "CONSTRUCTION", "NGO", "MANUFACTURING", "GOVERNMENT", "TECHNOLOGY", "COMMUNICATION"];
// 10DLC brands are US/Canada only (TCR); EIN issuers can be either.
const COUNTRIES = ["US", "CA"];
// TCR stock-exchange enum (shown only for publicly-traded brands).
const STOCK_EXCHANGES = ["NASDAQ", "NYSE", "AMEX", "AMX", "ASX", "B3", "BME", "BSE", "FRA", "ICEX", "JPX", "JSE", "KRX", "LON", "NSE", "OMX", "SEHK", "SGX", "SSE", "STO", "SWX", "SZSE", "TSX", "TWSE", "VSE"];
const USECASES = [
  { v: "2FA", l: "2FA / OTP codes" },
  { v: "ACCOUNT_NOTIFICATION", l: "Account notifications" },
  { v: "CUSTOMER_CARE", l: "Customer care" },
  { v: "DELIVERY_NOTIFICATION", l: "Delivery notifications" },
  { v: "SECURITY_ALERT", l: "Security alert" },
  { v: "MARKETING", l: "Marketing (needs 2 samples)" },
  { v: "MIXED", l: "Mixed (multiple)" },
  { v: "LOW_VOLUME_MIXED", l: "Low volume mixed" },
];

/* ----------------------------------------------------------------- modal shell */
/* On the phone shell this is a bottom sheet; on the desktop dashboard it becomes
   a centered, max-width dialog (otherwise the fields stretch the full viewport). */
function Sheet({ title, icon, onClose, children, desktop = false }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode; desktop?: boolean }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: desktop ? "fixed" : "absolute", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.74)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: desktop ? "center" : "flex-end", justifyContent: "center", padding: desktop ? 24 : 0,
    }}>
      <div style={{
        width: desktop ? "min(600px, 96vw)" : "100%", maxHeight: desktop ? "90vh" : "92%",
        background: C.card, borderRadius: desktop ? 22 : "26px 26px 0 0", border: `1px solid ${C.line}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: desktop ? "0 30px 90px rgba(0,0,0,0.65)" : "0 -12px 60px rgba(0,0,0,0.6)",
      }}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 11, borderBottom: `1px solid ${C.lineSoft}`, flexShrink: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, background: "rgba(124,92,255,0.14)", display: "grid", placeItems: "center", color: C.blue }}>{icon}</span>
          <h2 style={{ flex: 1, color: C.text, fontSize: 17, fontWeight: 800 }}>{title}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: C.input, border: "none", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={15} color={C.muted} /></button>
        </div>
        <div style={{ padding: "18px 20px 24px", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = { display: "block", color: C.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 };
const inputStyle: CSSProperties = { width: "100%", padding: "12px 13px", background: C.input, border: `1px solid ${C.line}`, borderRadius: radius.md, color: C.text, fontSize: 14, outline: "none", fontFamily: font.sans };

function Text({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} style={inputStyle} />
    </div>
  );
}
function Area({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={labelStyle}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
        {options.map((o) => <option key={o.v} value={o.v} style={{ background: C.card, color: C.text }}>{o.l}</option>)}
      </select>
    </div>
  );
}
/** A yes/no attribute row (used for the campaign's content flags). */
function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: "100%", marginBottom: 10, padding: "11px 13px", borderRadius: radius.md, textAlign: "left",
      background: C.input, border: `1px solid ${value ? "rgba(124,92,255,0.5)" : C.line}`, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 11, fontFamily: font.sans,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center",
        background: value ? gradients.brand : "transparent", border: `1.5px solid ${value ? "transparent" : C.line}`,
      }}>{value && <Check size={13} color="#fff" />}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", color: C.text, fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ display: "block", color: C.muted, fontSize: 11.5, marginTop: 1 }}>{hint}</span>}
      </span>
    </button>
  );
}

/** Two-column layout helper that collapses to one column on the phone. */
function Row({ children, desktop }: { children: ReactNode; desktop: boolean }) {
  return <div style={{ display: "grid", gridTemplateColumns: desktop ? "1fr 1fr" : "1fr", gap: 10 }}>{children}</div>;
}

function SubmitBtn({ busy, label, onClick, disabled }: { busy: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy || disabled} style={{
      width: "100%", marginTop: 6, padding: "14px", borderRadius: radius.md, border: "none",
      background: disabled ? C.input : gradients.brand, color: disabled ? C.muted : "#fff",
      fontSize: 15, fontWeight: 800, cursor: busy ? "wait" : disabled ? "not-allowed" : "pointer",
      fontFamily: font.sans, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.75 : 1,
    }}>
      {busy ? <><Loader2 size={16} className="dg-spin" /> Submitting…</> : label}
    </button>
  );
}

/* ----------------------------------------------------------------- BRAND form */
export function BrandForm({ onClose, desktop = false }: { onClose: () => void; desktop?: boolean }) {
  const { registerBrand, state, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<BrandRegistration>({
    entityType: "PRIVATE_PROFIT",
    displayName: state.user?.workspace?.replace(/'s Workspace$/, "") || "",
    companyName: state.user?.company || "",
    ein: "", einIssuingCountry: "US", vertical: "TECHNOLOGY",
    email: state.user?.email || "", phone: "", website: "",
    street: "", city: "", state: "", postalCode: "", country: "US",
    stockSymbol: "", stockExchange: "NASDAQ",
  });
  const set = (k: keyof BrandRegistration) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const sole = f.entityType === "SOLE_PROPRIETOR";
  const isPublic = f.entityType === "PUBLIC_PROFIT";

  const submit = async () => {
    const need: [string, string][] = [["Legal business name", f.companyName], ["Display name", f.displayName], ["Contact email", f.email], ["Contact phone", f.phone], ["Street", f.street], ["City", f.city], ["State", f.state], ["Postal code", f.postalCode]];
    if (!sole) need.push(["EIN / Tax ID", f.ein]);
    if (isPublic) need.push(["Stock symbol", f.stockSymbol]);
    const missing = need.find(([, v]) => !v.trim());
    if (missing) { showToast(`${missing[0]} is required`, "error"); return; }
    setBusy(true);
    const res = await registerBrand(f);
    setBusy(false);
    if (res.ok) onClose();
    else if (res.error) showToast(res.error, "error");
  };

  return (
    <Sheet title="Register your business" icon={<Building2 size={17} />} onClose={onClose} desktop={desktop}>
      <p style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.55, marginBottom: 12 }}>
        Carriers (10DLC) require your business identity before you can send SMS to US/Canada. There are
        <b style={{ color: C.text }}> no documents to upload</b> — instead Telnyx checks these details against
        official IRS/business records.
      </p>
      <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.32)", borderRadius: radius.md, padding: "10px 12px", marginBottom: 16, display: "flex", gap: 8 }}>
        <ShieldCheck size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ color: C.text, fontSize: 11.5, lineHeight: 1.5 }}>
          Enter your <b>legal name, EIN and address exactly</b> as they appear on your EIN letter (IRS CP-575).
          Even a small mismatch (e.g. "St" vs "Street") makes carriers reject the brand.
        </p>
      </div>
      <Select label="Business type" value={f.entityType} onChange={(v) => set("entityType")(v)} options={ENTITY_TYPES} />
      <Text label="Legal business name" value={f.companyName} onChange={set("companyName")} placeholder="DIGIRINGO LLC" />
      <Text label="Brand / display name" value={f.displayName} onChange={set("displayName")} placeholder="DIGIRINGO" />
      {!sole && (
        <Row desktop={desktop}>
          <Text label="EIN / Tax ID" value={f.ein} onChange={set("ein")} placeholder="12-3456789" />
          <Select label="EIN issuing country" value={f.einIssuingCountry} onChange={(v) => set("einIssuingCountry")(v)} options={COUNTRIES.map((v) => ({ v, l: v }))} />
        </Row>
      )}
      {isPublic && (
        <Row desktop={desktop}>
          <Text label="Stock symbol" value={f.stockSymbol} onChange={set("stockSymbol")} placeholder="AAPL" />
          <Select label="Stock exchange" value={f.stockExchange} onChange={(v) => set("stockExchange")(v)} options={STOCK_EXCHANGES.map((v) => ({ v, l: v }))} />
        </Row>
      )}
      <Select label="Industry" value={f.vertical} onChange={(v) => set("vertical")(v)} options={VERTICALS.map((v) => ({ v, l: v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ") }))} />
      <Row desktop={desktop}>
        <Text label="Contact email" value={f.email} onChange={set("email")} placeholder="you@business.com" type="email" />
        <Text label="Contact phone" value={f.phone} onChange={set("phone")} placeholder="+1 555 123 4567" />
      </Row>
      <Text label="Website (optional)" value={f.website} onChange={set("website")} placeholder="https://…" />
      <Text label="Street address" value={f.street} onChange={set("street")} placeholder="123 Market St" />
      <Row desktop={desktop}>
        <Text label="City" value={f.city} onChange={set("city")} placeholder="San Francisco" />
        <Text label="State / region" value={f.state} onChange={set("state")} placeholder="CA" />
      </Row>
      <Row desktop={desktop}>
        <Text label="Postal code" value={f.postalCode} onChange={set("postalCode")} placeholder="94103" />
        <Select label="Country" value={f.country} onChange={(v) => set("country")(v)} options={COUNTRIES.map((v) => ({ v, l: v }))} />
      </Row>
      <p style={{ color: C.faint, fontSize: 11, lineHeight: 1.5, margin: "4px 0 14px" }}>
        A one-time carrier fee (~$4.50 brand) applies when this is submitted. Verification usually completes within a few business days.
      </p>
      <SubmitBtn busy={busy} label="Submit for verification" onClick={submit} />
    </Sheet>
  );
}

/* -------------------------------------------------------------- CAMPAIGN form */
export function CampaignForm({ numberId, onClose, desktop = false }: { numberId: string; onClose: () => void; desktop?: boolean }) {
  const { registerNumber, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<CampaignRegistration>({
    usecase: "MIXED",
    description: "Transactional and customer-service messages to people who opted in through our app.",
    messageFlow: "Users opt in by creating an account in the DIGIRINGO app and confirming their number.",
    sample1: "Your DIGIRINGO verification code is 123456.",
    sample2: "Hi! Your number is active. Reply STOP to unsubscribe.",
    optinKeywords: "START, YES",
    optinMessage: "You're subscribed to DIGIRINGO alerts. Reply HELP for help, STOP to cancel.",
    optoutKeywords: "STOP, UNSUBSCRIBE, CANCEL",
    optoutMessage: "You've been unsubscribed and won't receive more messages. Reply START to opt back in.",
    helpKeywords: "HELP, INFO",
    helpMessage: "DIGIRINGO support: reply STOP to unsubscribe. Msg&data rates may apply.",
    embeddedLink: false, embeddedPhone: false, ageGated: false, directLending: false, affiliateMarketing: false,
  });
  const set = (k: keyof CampaignRegistration) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setBool = (k: keyof CampaignRegistration) => (v: boolean) => setF((p) => ({ ...p, [k]: v }));
  const needsTwoSamples = f.usecase === "MARKETING" || f.usecase === "MIXED";

  const submit = async () => {
    if (!f.description.trim() || !f.sample1.trim() || !f.messageFlow.trim()) { showToast("Fill the description, sample 1 and the opt-in flow", "error"); return; }
    if (needsTwoSamples && !f.sample2.trim()) { showToast("This use case needs 2 sample messages", "error"); return; }
    if (!f.optoutKeywords.trim() || !f.helpKeywords.trim()) { showToast("Opt-out and HELP keywords are required by carriers", "error"); return; }
    setBusy(true);
    const res = await registerNumber(numberId, f);
    setBusy(false);
    if (res.ok) onClose();
    else if (res.error) showToast(res.error, "error");
  };

  const sectionLabel: CSSProperties = { color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", margin: "6px 0 10px" };

  return (
    <Sheet title="Messaging campaign" icon={<Megaphone size={17} />} onClose={onClose} desktop={desktop}>
      <p style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.55, marginBottom: 16 }}>
        Tell carriers how you'll use SMS. This is created once (a one-time ~$15 vetting fee + monthly campaign fee
        apply), then your numbers attach to it.
      </p>
      <Select label="Use case" value={f.usecase} onChange={(v) => set("usecase")(v)} options={USECASES} />
      <Area label="What you'll send" value={f.description} onChange={set("description")} />
      <Text label="Sample message 1" value={f.sample1} onChange={set("sample1")} />
      <Text label={needsTwoSamples ? "Sample message 2" : "Sample message 2 (optional)"} value={f.sample2} onChange={set("sample2")} />
      <Area label="How people opt in (consent flow)" value={f.messageFlow} onChange={set("messageFlow")} />

      <p style={sectionLabel}>Consent keywords</p>
      <Row desktop={desktop}>
        <Text label="Opt-in keywords" value={f.optinKeywords} onChange={set("optinKeywords")} placeholder="START, YES" />
        <Text label="Opt-out keywords" value={f.optoutKeywords} onChange={set("optoutKeywords")} placeholder="STOP, CANCEL" />
      </Row>
      <Text label="Help keywords" value={f.helpKeywords} onChange={set("helpKeywords")} placeholder="HELP, INFO" />
      <Area label="Opt-out auto-reply" value={f.optoutMessage} onChange={set("optoutMessage")} />
      <Area label="HELP auto-reply" value={f.helpMessage} onChange={set("helpMessage")} />

      <p style={sectionLabel}>Message content</p>
      <Toggle label="Messages contain links (URLs)" value={f.embeddedLink} onChange={setBool("embeddedLink")} />
      <Toggle label="Messages contain phone numbers" value={f.embeddedPhone} onChange={setBool("embeddedPhone")} />
      <Toggle label="Age-gated content" hint="Alcohol, tobacco, gambling, etc." value={f.ageGated} onChange={setBool("ageGated")} />
      <Toggle label="Direct lending / loan arrangement" value={f.directLending} onChange={setBool("directLending")} />
      <Toggle label="Affiliate marketing" value={f.affiliateMarketing} onChange={setBool("affiliateMarketing")} />

      <SubmitBtn busy={busy} label="Create campaign & register number" onClick={submit} />
    </Sheet>
  );
}

/* --------------------------------------------------------- REGULATORY DOCS form */
export function RegulatoryDocsForm({ numberId, phoneNumber, onClose, desktop = false }: { numberId: string; phoneNumber: string; onClose: () => void; desktop?: boolean }) {
  const { getNumberRequirements, submitNumberDoc, markNumberVerified, showToast } = useApp();
  const [reqs, setReqs] = useState<RegulatoryRequirement[] | null>(null);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { getNumberRequirements(phoneNumber).then(setReqs).catch(() => setReqs([])); }, [phoneNumber, getNumberRequirements]);

  const docReqs = (reqs ?? []).filter((r) => r.type === "document");
  const allUploaded = docReqs.length > 0 && docReqs.every((r) => files[r.id]);

  const submit = async () => {
    setBusy(true);
    try {
      for (const r of docReqs) await submitNumberDoc(phoneNumber, r.id, files[r.id]);
      markNumberVerified(numberId);
      onClose();
    } catch (e) { showToast(e instanceof Error ? e.message : "Upload failed — try again", "error"); }
    setBusy(false);
  };

  return (
    <Sheet title="Number documents" icon={<FileUp size={17} />} onClose={onClose} desktop={desktop}>
      <p style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.55, marginBottom: 16 }}>
        This number's country requires proof of identity / address by law. Upload the documents below — they go
        securely to the carrier for review.
      </p>
      {reqs === null ? (
        <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Checking requirements…</p>
      ) : docReqs.length === 0 ? (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: radius.md, padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={20} color={C.green} />
          <p style={{ color: C.text, fontSize: 13.5, fontWeight: 600 }}>No documents needed for this number 🎉</p>
        </div>
      ) : (
        <>
          {docReqs.map((r) => (
            <div key={r.id} style={{ background: C.card, border: `1px solid ${files[r.id] ? "rgba(34,197,94,0.4)" : C.line}`, borderRadius: radius.md, padding: 14, marginBottom: 12 }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{r.name}</p>
              <p style={{ color: C.muted, fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>{r.description}</p>
              <input ref={(el) => { inputs.current[r.id] = el; }} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((p) => ({ ...p, [r.id]: f })); }} />
              <button onClick={() => inputs.current[r.id]?.click()} style={{
                marginTop: 11, width: "100%", padding: "11px", borderRadius: radius.md,
                background: files[r.id] ? "rgba(34,197,94,0.12)" : C.input, border: `1px solid ${files[r.id] ? "rgba(34,197,94,0.4)" : C.line}`,
                color: files[r.id] ? C.green : C.text, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font.sans,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {files[r.id] ? <><Check size={15} /> {files[r.id].name}</> : <><FileUp size={15} /> Upload file</>}
              </button>
            </div>
          ))}
          <SubmitBtn busy={busy} label="Submit documents" onClick={submit} disabled={!allUploaded} />
        </>
      )}
    </Sheet>
  );
}
