import { useState, useEffect, useCallback } from "react";
import { X, ChevronDown, Check, Search, Loader2, Wallet, CreditCard, Gift, Sparkles, AlertTriangle } from "lucide-react";
import { BUNDLES, bundlePrice, getBundle, NUMBER_RENTAL, type BundleId, type BillingCycle } from "../core/plans";
import type { Subscription } from "../core/types";
import { stripeReady, startCheckout } from "../services/stripe";

const C = {
  bg: "var(--dg-bg)", card: "var(--dg-card)", input: "var(--dg-input)", line: "var(--dg-line)",
  blue: "#4f8ef7", purple: "#9b6ff7", green: "#22c55e", amber: "#f59e0b",
  text: "var(--dg-text)", muted: "var(--dg-muted)", red: "#ef4444",
};

// Flat rental for an EXTRA number (beyond the free one included in the plan).
const RENTAL_PRICE = NUMBER_RENTAL.local;

// iso = Telnyx filter[country_code]; code = dial code shown to the user.
const COUNTRIES = [
  { iso:"US", flag:"🇺🇸", name:"United States", code:"+1"  },
  { iso:"GB", flag:"🇬🇧", name:"United Kingdom",code:"+44" },
  { iso:"DE", flag:"🇩🇪", name:"Germany",       code:"+49" },
  { iso:"FR", flag:"🇫🇷", name:"France",        code:"+33" },
  { iso:"CA", flag:"🇨🇦", name:"Canada",        code:"+1"  },
  { iso:"JP", flag:"🇯🇵", name:"Japan",         code:"+81" },
  { iso:"AU", flag:"🇦🇺", name:"Australia",     code:"+61" },
  { iso:"BR", flag:"🇧🇷", name:"Brazil",        code:"+55" },
];

export interface AvailableNumber { e164: string; number: string; price: number; sms: boolean; voice: boolean; }

type NumType = "local" | "mobile";

/** What claiming this number means, given the user's current plan. */
type Mode = "choosePlan" | "freeSlot" | "paidExtra" | "atCap";

interface Props {
  onClose: () => void;
  onSearch: (countryIso: string, type: NumType, areaCode?: string) => Promise<AvailableNumber[]>;
  /** Current wallet balance — gates the "pay from wallet" option. */
  walletBalance: number;
  /** The user's active plan (null = no plan yet → they must pick one). */
  subscription: Subscription | null;
  /** Activate a plan (from the wallet) and claim this number free, in one flow. */
  onSubscribeAndBuy: (n: AvailableNumber, tier: BundleId, cycle: BillingCycle) => Promise<void> | void;
  /** Activate a plan by CARD (Stripe) and claim this number free once it's active. */
  onCardPlanAndBuy: (n: AvailableNumber, tier: BundleId, cycle: BillingCycle) => Promise<void> | void;
  /** Add a number to the existing plan — free (included slot) or a paid extra (wallet). */
  onAddNumber: (n: AvailableNumber, opts: { free?: boolean }) => Promise<void> | void;
  /** Open the Plans screen (used when the plan is at its number cap → upgrade). */
  onSeePlans: () => void;
  /** Desktop dashboard → render as a centered dialog instead of a bottom sheet. */
  desktop?: boolean;
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.4, padding: "2px 7px", borderRadius: 6,
      background: "rgba(79,142,247,0.14)", color: C.blue, textTransform: "uppercase",
    }}>{label}</span>
  );
}

function TypeBtn({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "11px 12px", borderRadius: 14, cursor: "pointer", textAlign: "left",
      background: active ? "rgba(79,142,247,0.12)" : C.input,
      border: `1.5px solid ${active ? C.blue : "rgba(255,255,255,0.07)"}`,
      fontFamily: "'Inter',sans-serif",
    }}>
      <p style={{ color: active ? C.text : C.muted, fontSize: 14, fontWeight: 700 }}>{title}</p>
      <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{sub}</p>
    </button>
  );
}

const backBtn = {
  flex: 1, padding: "14px", background: C.input, border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14, color: C.text, fontSize: 14, fontWeight: 700,
  cursor: "pointer", fontFamily: "'Inter',sans-serif",
} as const;

function PayTab({ active, onClick, Icon, title, sub, disabled }: {
  active: boolean; onClick?: () => void; Icon: typeof Wallet; title: string; sub: string; disabled?: boolean;
}) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      flex: 1, padding: "12px 12px", borderRadius: 14, textAlign: "left",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
      background: active ? "rgba(79,142,247,0.12)" : C.input,
      border: `1.5px solid ${active ? C.blue : "rgba(255,255,255,0.07)"}`,
      fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 10,
    }}>
      <Icon size={18} color={active ? C.blue : C.muted} />
      <span>
        <span style={{ display: "block", color: active ? C.text : C.muted, fontSize: 14, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "block", color: C.muted, fontSize: 10.5, marginTop: 1 }}>{sub}</span>
      </span>
    </button>
  );
}

/** The pay-as-you-go overflow explainer shown when a plan is being chosen/used. */
function OverflowNote() {
  return (
    <div style={{
      marginTop: 12, padding: "11px 12px", borderRadius: 12,
      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)",
      display: "flex", gap: 9,
    }}>
      <AlertTriangle size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ color: "rgba(238,240,246,0.72)", fontSize: 11.5, lineHeight: 1.5 }}>
        When your plan's minutes/SMS run out you can keep going on <b style={{ color: C.text }}>pay-as-you-go</b> — extra
        usage is billed from your wallet. We'll alert you before you get there so you can upgrade. Card auto-reload
        (${RENTAL_PRICE.toFixed(2)}) turns on once card billing is enabled.
      </p>
    </div>
  );
}

export function BuyNumberModal({ onClose, onSearch, walletBalance, subscription, onSubscribeAndBuy, onCardPlanAndBuy, onAddNumber, onSeePlans, desktop = false }: Props) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [cDrop, setCDrop] = useState(false);
  const [numType, setNumType] = useState<NumType>("local");
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [pickedTier, setPickedTier] = useState<BundleId | null>(null);
  const [step, setStep] = useState<"pick" | "pay">("pick");
  const [pay, setPay] = useState<"wallet" | "card">("wallet");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (iso: string, type: NumType, ac: string) => {
    setLoading(true); setSelected(null); setPickedTier(null);
    const r = await onSearch(iso, type, ac);
    setResults(r); setLoading(false); setSearched(true);
  }, [onSearch]);

  // Load numbers when the modal opens and whenever the country or type changes.
  useEffect(() => { load(country.iso, numType, areaCode); /* eslint-disable-next-line */ }, [country.iso, numType]);

  const chosenNumber = results.find((n) => n.number === selected) ?? null;

  // Decide what claiming this number costs, given the active plan + its capacity.
  const activePlan = subscription && subscription.status === "active" ? subscription : null;
  const activeBundle = activePlan ? getBundle(activePlan.tier) : undefined;
  const mode: Mode = !activePlan
    ? "choosePlan"
    : activePlan.numbersUsed < activePlan.numbersIncluded ? "freeSlot"
    : activePlan.numbersUsed < activePlan.numbersMax ? "paidExtra"
    : "atCap";

  const payingPlan = mode === "choosePlan";
  const payBundle = pickedTier ? getBundle(pickedTier) : undefined;
  const planPart = payingPlan && payBundle ? bundlePrice(payBundle, cycle) : 0;
  // No number is free anymore — the number's rental is always part of the total.
  const payAmount = payingPlan ? planPart + RENTAL_PRICE : RENTAL_PRICE;
  const enough = walletBalance >= payAmount;

  const selectNumber = (num: string) => {
    setSelected((cur) => (cur === num ? null : num)); // tap again to collapse
    setPickedTier(null);
  };

  // Claim the free included slot immediately (no payment).
  const claimFree = async () => {
    if (!chosenNumber) return;
    setBusy(true);
    await onAddNumber(chosenNumber, { free: true });
    setBusy(false);
    onClose();
  };

  const goPay = () => { setPay("wallet"); setStep("pay"); };

  const completeWallet = async () => {
    if (!chosenNumber) return;
    setBusy(true);
    if (payingPlan && pickedTier) await onSubscribeAndBuy(chosenNumber, pickedTier, cycle);
    else await onAddNumber(chosenNumber, { free: false });
    setBusy(false);
    onClose();
  };
  // Pay for the NEW plan by card (Stripe) and claim the number free once the
  // plan activates. The overlay + activation run after the modal closes; toasts
  // report progress (handled in the parent handler).
  const completeCard = () => {
    if (!chosenNumber) return;
    if (payingPlan && pickedTier) {
      onCardPlanAndBuy(chosenNumber, pickedTier, cycle); // plan + number by card
      onClose();
    } else {
      // Existing plan → just the extra number by card (redirects to Stripe).
      startCheckout({ kind: "number", phone: chosenNumber.e164, numberKind: "local" }).catch(() => {});
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: desktop ? "fixed" : "absolute", inset: 0, zIndex: 400,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: desktop ? "center" : "flex-end",
        justifyContent: "center", padding: desktop ? "24px" : 0,
      }}
    >
      <div style={{
        width: desktop ? "min(560px, 96vw)" : "100%", background: C.card,
        borderRadius: desktop ? 22 : "26px 26px 0 0",
        border: `1px solid ${C.line}`,
        maxHeight: desktop ? "88vh" : "90%", overflowY: "auto",
        boxShadow: desktop ? "0 30px 90px rgba(0,0,0,0.65)" : "0 -12px 60px rgba(0,0,0,0.6)",
      }}>
        {/* Drag handle (bottom-sheet affordance — mobile only) */}
        {!desktop && (
          <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 2px" }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          padding: "14px 20px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div>
            <h2 style={{ color: C.text, fontSize: 19, fontWeight: 800 }}>
              {step === "pay" ? "Confirm & Pay" : "Get a Number"}
            </h2>
            {step === "pick" && <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>Pick a number — ${RENTAL_PRICE.toFixed(2)}/mo with a plan</p>}
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 11,
            background: C.input, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color={C.muted} />
          </button>
        </div>

        {step === "pick" ? (
          <div style={{ padding: "20px 20px 28px" }}>
            {/* Country picker */}
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 0.8, textTransform: "uppercase" }}>Country</p>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <button onClick={() => setCDrop((v) => !v)} style={{
                width: "100%", padding: "13px 16px",
                background: C.input, border: `1.5px solid ${cDrop ? C.blue : "rgba(255,255,255,0.07)"}`,
                borderRadius: 14, color: C.text, fontSize: 14,
                display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                fontFamily: "'Inter',sans-serif",
              }}>
                <span style={{ fontSize: 22 }}>{country.flag}</span>
                <span style={{ flex: 1, textAlign: "left", fontWeight: 500 }}>{country.name}</span>
                <span style={{ color: C.muted, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{country.code}</span>
                <ChevronDown size={15} color={C.muted} style={{ transform: cDrop ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              {cDrop && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
                  background: C.card, border: `1px solid ${C.line}`,
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.65)",
                }}>
                  {COUNTRIES.map((c, i) => (
                    <button key={c.iso} onClick={() => { setCountry(c); setCDrop(false); }} style={{
                      width: "100%", padding: "12px 16px",
                      background: country.iso === c.iso ? "rgba(79,142,247,0.12)" : "transparent",
                      border: "none", cursor: "pointer",
                      borderBottom: i < COUNTRIES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      display: "flex", alignItems: "center", gap: 10,
                      fontFamily: "'Inter',sans-serif",
                    }}>
                      <span style={{ fontSize: 20 }}>{c.flag}</span>
                      <span style={{ flex: 1, color: C.text, fontSize: 13, textAlign: "left", fontWeight: country.iso === c.iso ? 600 : 400 }}>{c.name}</span>
                      <span style={{ color: C.muted, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{c.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Number type: local vs mobile */}
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 0.8, textTransform: "uppercase" }}>Number Type</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <TypeBtn active={numType === "local"} onClick={() => setNumType("local")} title="Local" sub="Calls · cheaper" />
              <TypeBtn active={numType === "mobile"} onClick={() => setNumType("mobile")} title="Mobile" sub="Calls + SMS" />
            </div>
            <p style={{ color: C.muted, fontSize: 11.5, lineHeight: 1.5, marginBottom: 18 }}>
              {numType === "local"
                ? "Geographic number for calls. On local numbers SMS works only in the US & Canada — elsewhere choose Mobile to send texts."
                : "Mobile number that supports both calls and SMS in every country."}
            </p>

            {/* Area code (local numbers only) + search */}
            {numType === "local" && (<>
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 0.8, textTransform: "uppercase" }}>Area Code <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") load(country.iso, numType, areaCode); }}
                placeholder="e.g. 628, 212, 310…"
                style={{
                  flex: 1, padding: "13px 16px",
                  background: C.input, border: "1.5px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, color: C.text, fontSize: 14,
                  outline: "none", fontFamily: "'Inter',sans-serif",
                }}
              />
              <button onClick={() => load(country.iso, numType, areaCode)} disabled={loading} style={{
                padding: "0 16px", background: C.input, border: "1.5px solid rgba(255,255,255,0.07)",
                borderRadius: 14, color: C.text, cursor: loading ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 700, fontSize: 13,
              }}>
                <Search size={15} color={C.muted} /> Search
              </button>
            </div>
            </>)}

            {/* Available numbers — NO price; tapping one expands the plan chooser */}
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 0.8, textTransform: "uppercase" }}>Available Numbers</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8, minHeight: 80 }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "26px 0", color: C.muted, fontSize: 13 }}>
                  <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> Searching for numbers…
                </div>
              ) : results.length > 0 ? (
                results.map((n) => {
                  const isSel = selected === n.number;
                  return (
                    <div key={n.e164}>
                      <button onClick={() => selectNumber(n.number)} style={{
                        width: "100%", padding: "14px 16px",
                        background: isSel ? "rgba(79,142,247,0.1)" : C.input,
                        border: `1.5px solid ${isSel ? C.blue : "rgba(255,255,255,0.07)"}`,
                        borderRadius: isSel ? "14px 14px 0 0" : 14, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                        fontFamily: "'Inter',sans-serif", transition: "border-color 0.15s, background 0.15s",
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          border: isSel ? "none" : "2px solid rgba(255,255,255,0.2)",
                          background: isSel ? C.blue : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {isSel && <Check size={12} color="#fff" strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: C.text, fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.3 }}>{n.number}</span>
                          <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                            {n.voice && <Tag label="Voice" />}
                            {n.sms && <Tag label="SMS" />}
                          </div>
                        </div>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 1, color: C.text, fontSize: 13.5, fontWeight: 800 }}>
                          ${RENTAL_PRICE.toFixed(2)}<span style={{ color: C.muted, fontSize: 10, fontWeight: 600 }}>/mo</span>
                        </span>
                      </button>

                      {/* Expanded plan chooser for the tapped number */}
                      {isSel && (
                        <div style={{
                          border: `1.5px solid ${C.blue}`, borderTop: "none", borderRadius: "0 0 14px 14px",
                          background: "rgba(79,142,247,0.05)", padding: "16px", animation: "fadeIn 0.2s ease",
                        }}>
                          {mode === "freeSlot" && (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <Gift size={16} color={C.green} />
                                <span style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>Free with your {activeBundle?.name} plan</span>
                              </div>
                              <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                                This is your included free number ({activePlan!.numbersUsed} of {activePlan!.numbersIncluded} used).
                                You can hold up to {activePlan!.numbersMax} numbers on this plan.
                              </p>
                              <button disabled={busy} onClick={claimFree} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
                                {busy ? "Adding…" : "Add this number — Free"}
                              </button>
                            </>
                          )}

                          {mode === "paidExtra" && (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <Sparkles size={16} color={C.blue} />
                                <span style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>Add to your {activeBundle?.name} plan</span>
                              </div>
                              <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
                                Your free number is used ({activePlan!.numbersUsed}/{activePlan!.numbersMax} numbers).
                                Extra numbers are <b style={{ color: C.text }}>${RENTAL_PRICE.toFixed(2)}/mo</b> and share your plan's minutes &amp; SMS.
                              </p>
                              <OverflowNote />
                              <button onClick={goPay} style={{ ...primaryBtn, marginTop: 12 }}>
                                Continue · ${RENTAL_PRICE.toFixed(2)}/mo →
                              </button>
                            </>
                          )}

                          {mode === "atCap" && (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <AlertTriangle size={16} color={C.amber} />
                                <span style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>Plan is full</span>
                              </div>
                              <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                                You've reached the {activePlan!.numbersMax}-number limit on your {activeBundle?.name} plan.
                                Upgrade to a bigger plan to add more numbers.
                              </p>
                              <button onClick={() => { onClose(); onSeePlans(); }} style={primaryBtn}>See plans</button>
                            </>
                          )}

                          {mode === "choosePlan" && (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <Sparkles size={16} color={C.blue} />
                                <span style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>Pick a plan for this number</span>
                              </div>
                              <p style={{ color: C.muted, fontSize: 11.5, lineHeight: 1.5, marginBottom: 12 }}>
                                A number needs an active plan. You'll pay the plan plus the number (<b style={{ color: C.text }}>${RENTAL_PRICE.toFixed(2)}/mo</b>, shares the plan's minutes &amp; SMS).
                              </p>

                              {/* Monthly / annual toggle */}
                              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                                <div style={{ display: "inline-flex", background: C.input, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: 3, gap: 3 }}>
                                  {(["monthly", "annual"] as const).map((k) => {
                                    const on = cycle === k;
                                    return (
                                      <button key={k} onClick={() => setCycle(k)} style={{
                                        border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: 999,
                                        fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif",
                                        background: on ? `linear-gradient(135deg,${C.blue},${C.purple})` : "transparent",
                                        color: on ? "#fff" : C.muted, display: "inline-flex", alignItems: "center", gap: 6,
                                      }}>
                                        {k === "monthly" ? "Monthly" : "Annual"}
                                        {k === "annual" && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: on ? "rgba(255,255,255,0.22)" : "rgba(34,197,94,0.15)", color: on ? "#fff" : C.green }}>2 mo free</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Bundle picks */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {BUNDLES.map((b) => {
                                  const on = pickedTier === b.id;
                                  const price = bundlePrice(b, cycle);
                                  return (
                                    <button key={b.id} onClick={() => setPickedTier(b.id)} style={{
                                      width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "'Inter',sans-serif",
                                      padding: "12px 13px", borderRadius: 13,
                                      background: on ? "rgba(79,142,247,0.12)" : C.input,
                                      border: `1.5px solid ${on ? C.blue : (b.featured ? "rgba(79,142,247,0.4)" : "rgba(255,255,255,0.07)")}`,
                                    }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                          <span style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>{b.name}</span>
                                          {b.featured && <span style={{ fontSize: 9, fontWeight: 800, color: C.blue, background: "rgba(79,142,247,0.16)", padding: "2px 6px", borderRadius: 999 }}>POPULAR</span>}
                                        </span>
                                        <span style={{ color: C.text, fontSize: 15, fontWeight: 800 }}>
                                          ${price.toFixed(cycle === "annual" ? 0 : 2)}<span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>{cycle === "annual" ? "/yr" : "/mo"}</span>
                                        </span>
                                      </div>
                                      <p style={{ color: C.muted, fontSize: 11.5, marginTop: 3 }}>
                                        {b.minutes.toLocaleString()} min · {b.sms.toLocaleString()} SMS · up to {b.maxNumbers} numbers (${RENTAL_PRICE.toFixed(2)}/mo each)
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>

                              {pickedTier && <OverflowNote />}

                              <button
                                onClick={goPay}
                                disabled={!pickedTier}
                                style={{
                                  ...primaryBtn, marginTop: 12,
                                  background: pickedTier ? `linear-gradient(135deg,${C.blue},${C.purple})` : "rgba(255,255,255,0.06)",
                                  color: pickedTier ? "#fff" : C.muted, cursor: pickedTier ? "pointer" : "not-allowed",
                                  boxShadow: pickedTier ? "0 6px 20px rgba(79,142,247,0.4)" : "none",
                                }}
                              >
                                {pickedTier
                                  ? `Continue with ${payBundle?.name} · $${payAmount.toFixed(cycle === "annual" ? 0 : 2)} →`
                                  : "Select a plan to continue"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", padding: "26px 12px", color: C.muted, fontSize: 13 }}>
                  {searched
                    ? `No ${numType} numbers available for ${country.name}. Try ${numType === "local" ? "Mobile" : "Local"}, or a different country.`
                    : "Searching…"}
                </div>
              )}
            </div>
          </div>
        ) : (
          // ---- PAY step (charge the plan, or the paid extra number) ----
          <div style={{ padding: "20px 20px 32px" }}>
            <div style={{
              background: C.input, borderRadius: 18, padding: "18px 20px",
              border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <span style={{ fontSize: 34 }}>{country.flag}</span>
                <div>
                  <p style={{ color: C.text, fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.4 }}>{selected}</p>
                  <p style={{ color: C.muted, fontSize: 12.5, marginTop: 3 }}>{country.name}</p>
                </div>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
                {(payingPlan
                  ? [
                      { k: "Plan", v: `${payBundle?.name} (${cycle}) · $${planPart.toFixed(cycle === "annual" ? 0 : 2)}` },
                      { k: "Includes", v: `${payBundle?.minutes.toLocaleString()} min · ${payBundle?.sms.toLocaleString()} SMS` },
                      { k: "Number", v: `$${RENTAL_PRICE.toFixed(2)}/mo` },
                      { k: "Total today", v: `$${payAmount.toFixed(cycle === "annual" ? 0 : 2)}` },
                    ]
                  : [
                      { k: "Adds to", v: `${activeBundle?.name} plan` },
                      { k: "Extra number", v: `$${RENTAL_PRICE.toFixed(2)}/mo` },
                      { k: "Shares", v: "your plan's minutes & SMS" },
                      { k: "Total today", v: `$${RENTAL_PRICE.toFixed(2)}` },
                    ]
                ).map(({ k, v }) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>{k}</span>
                    <span style={{ color: v === "FREE" ? C.green : C.text, fontSize: 13, fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment: wallet always; card (Stripe) offered for a NEW plan. */}
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 0.8, textTransform: "uppercase" }}>Pay with</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <PayTab active={pay === "wallet"} onClick={() => setPay("wallet")} Icon={Wallet} title="Wallet" sub={`Balance $${walletBalance.toFixed(2)}`} />
              {(payingPlan || mode === "paidExtra") && (
                <PayTab active={pay === "card"} onClick={() => setPay("card")} Icon={CreditCard} title="Card" sub={payingPlan ? "Renews auto" : "Pay by card"} disabled={!stripeReady()} />
              )}
            </div>

            {pay === "wallet" ? (
              <>
                {!enough && (
                  <p style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>
                    Not enough balance — top up ${(payAmount - walletBalance).toFixed(2)} more{payingPlan ? ", or pay by card." : " from the Wallet tab, then come back."}
                  </p>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep("pick")} style={backBtn}>Back</button>
                  <button
                    onClick={completeWallet}
                    disabled={!enough || busy}
                    style={{
                      flex: 2, padding: "14px", border: "none", borderRadius: 14, color: "#fff",
                      fontSize: 14, fontWeight: 800, fontFamily: "'Inter',sans-serif",
                      background: enough ? `linear-gradient(135deg,${C.blue},${C.purple})` : "rgba(255,255,255,0.06)",
                      cursor: enough && !busy ? "pointer" : "not-allowed",
                      boxShadow: enough ? "0 6px 20px rgba(79,142,247,0.4)" : "none",
                    }}
                  >
                    {busy ? "Processing…" : `Pay $${payAmount.toFixed(payingPlan && cycle === "annual" ? 0 : 2)} from wallet`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: C.muted, fontSize: 12, marginBottom: 12, textAlign: "center" }}>
                  {payingPlan ? (
                    <>You'll be redirected to a secure card checkout for <b style={{ color: C.text }}>${planPart.toFixed(cycle === "annual" ? 0 : 2)}</b> (plan) + <b style={{ color: C.text }}>${RENTAL_PRICE.toFixed(2)}</b> (number). The plan auto-renews.</>
                  ) : (
                    <>You'll be redirected to a secure card checkout for the number (<b style={{ color: C.text }}>${RENTAL_PRICE.toFixed(2)}/mo</b>).</>
                  )}
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep("pick")} style={backBtn}>Back</button>
                  <button
                    onClick={completeCard}
                    style={{
                      flex: 2, padding: "14px", border: "none", borderRadius: 14, color: "#fff",
                      fontSize: 14, fontWeight: 800, fontFamily: "'Inter',sans-serif",
                      background: `linear-gradient(135deg,${C.blue},${C.purple})`,
                      cursor: "pointer", boxShadow: "0 6px 20px rgba(79,142,247,0.4)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <CreditCard size={16} /> Pay by card
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn = {
  width: "100%", padding: "13px", border: "none", borderRadius: 13,
  background: `linear-gradient(135deg,${C.blue},${C.purple})`, color: "#fff",
  fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Inter',sans-serif",
} as const;
