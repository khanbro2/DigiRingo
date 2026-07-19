import { useState, type CSSProperties } from "react";
import { ArrowLeft, Check, Wallet, CreditCard, X, Sparkles, Loader2 } from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";
import { BUNDLES, bundlePrice, getBundle, type Bundle, type BillingCycle, type PayMethod } from "../core/plans";
import { startCheckout, stripeReady } from "../services/stripe";

interface Props { onBack: () => void; onTopUp: () => void; }

/**
 * Plans & bundles. Pick a Starter / Business / Pro tier (monthly or annual) and
 * activate it — paying from the wallet or directly by card. The active plan and
 * its included-usage meters show at the top.
 */
export function PlansScreen({ onBack, onTopUp }: Props) {
  const { state, subscribe, setAutoRenew, cancelSubscription } = useApp();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [chosen, setChosen] = useState<Bundle | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const sub = state.subscription;
  const activeBundle = sub ? getBundle(sub.tier) : undefined;
  const pastDue = sub?.status === "past_due";

  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 28 }}>
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={17} color={C.text} /></button>
        <h1 style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>Plans</h1>
      </div>

      {/* Active plan banner */}
      {sub && activeBundle ? (
        <div style={{ padding: "0 16px 8px" }}>
          <div style={{ borderRadius: 18, padding: "18px 18px", background: "linear-gradient(135deg,#112358 0%,#1e1047 60%,#0f2040 100%)", border: "1px solid rgba(79,142,247,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={15} color={C.blue} />
              <span style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>{activeBundle.name} plan</span>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>· {sub.cycle}</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11.5, marginTop: 4 }}>
              {pastDue
                ? "Renewal failed — wallet balance was too low"
                : `${sub.autoRenew ? "Auto-renews" : "Ends"} ${new Date(sub.periodEnd).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}${sub.autoRenew ? ` · $${sub.renewAmount.toFixed(2)} from wallet` : ""}`}
            </p>
            <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
              <Meter label="Minutes" used={sub.minutesUsed} total={sub.minutesIncluded} />
              <Meter label="SMS" used={sub.smsUsed} total={sub.smsIncluded} />
            </div>

            {/* Auto-renew toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5, fontWeight: 600 }}>Auto-renew from wallet</span>
              <button onClick={() => setAutoRenew(!sub.autoRenew)} style={{
                width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
                background: sub.autoRenew ? C.blue : "rgba(255,255,255,0.18)", transition: "background 0.2s",
              }}>
                <span style={{ position: "absolute", top: 3, left: sub.autoRenew ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
            </div>

            {pastDue && (
              <button onClick={onTopUp} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: radius.md, border: "none", background: gradients.brand, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: font.sans }}>
                Top up wallet to restore your plan
              </button>
            )}

            {/* Cancel plan */}
            {!confirmCancel ? (
              <button onClick={() => setConfirmCancel(true)} style={{ width: "100%", marginTop: 12, padding: "11px", borderRadius: radius.md, border: "1px solid rgba(255,255,255,0.14)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font.sans }}>
                Cancel plan
              </button>
            ) : (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: radius.md, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
                  Cancel your plan? You'll lose your included minutes &amp; SMS and move to pay-as-you-go. You can re-subscribe anytime.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={cancelling} onClick={() => setConfirmCancel(false)} style={{ flex: 1, padding: "10px", borderRadius: radius.sm, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font.sans }}>Keep plan</button>
                  <button disabled={cancelling} onClick={async () => { setCancelling(true); const ok = await cancelSubscription(); setCancelling(false); if (ok) setConfirmCancel(false); }} style={{ flex: 1, padding: "10px", borderRadius: radius.sm, border: "none", background: C.red, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: font.sans, opacity: cancelling ? 0.7 : 1 }}>{cancelling ? "Cancelling…" : "Cancel plan"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p style={{ color: C.muted, fontSize: 13, padding: "0 18px 6px", lineHeight: 1.5 }}>
          No active bundle — you're on pay-as-you-go. Pick a plan below for included minutes &amp; texts, or keep paying per use from your wallet.
        </p>
      )}

      {/* Monthly / annual toggle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 16px" }}>
        <div style={{ display: "inline-flex", background: C.input, border: `1px solid ${C.line}`, borderRadius: 999, padding: 4, gap: 4 }}>
          {(["monthly", "annual"] as const).map((k) => {
            const active = cycle === k;
            return (
              <button key={k} onClick={() => setCycle(k)} style={{
                border: "none", cursor: "pointer", padding: "8px 18px", borderRadius: 999,
                fontSize: 13, fontWeight: 700, fontFamily: font.sans,
                background: active ? gradients.brand : "transparent", color: active ? "#fff" : C.muted,
                display: "inline-flex", alignItems: "center", gap: 7,
              }}>
                {k === "monthly" ? "Monthly" : "Annual"}
                {k === "annual" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: active ? "rgba(255,255,255,0.22)" : "rgba(34,197,94,0.15)", color: active ? "#fff" : C.green }}>2 mo free</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bundle cards */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {BUNDLES.map((b) => {
          const price = bundlePrice(b, cycle);
          const isActive = sub?.tier === b.id && sub.cycle === cycle && sub.status === "active";
          return (
            <div key={b.id} style={{
              background: C.card, borderRadius: radius.lg, padding: "18px 18px",
              border: `1.5px solid ${b.featured ? C.blue : C.lineSoft}`, position: "relative",
            }}>
              {b.featured && <span style={{ position: "absolute", top: -9, right: 16, background: gradients.brand, color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 999 }}>Most popular</span>}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h3 style={{ color: C.text, fontSize: 17, fontWeight: 800 }}>{b.name}</h3>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>${price.toFixed(cycle === "annual" ? 0 : 2)}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>{cycle === "annual" ? "/yr" : "/mo"}</span>
                </div>
              </div>
              <p style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{b.tagline}</p>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
                {b.perks.map((p) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={14} color={C.green} /> <span style={{ color: C.text, fontSize: 13 }}>{p}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => !isActive && setChosen(b)}
                disabled={isActive}
                style={{
                  width: "100%", marginTop: 16, padding: "13px", borderRadius: radius.md,
                  fontSize: 14, fontWeight: 800, fontFamily: font.sans,
                  background: isActive ? C.input : (b.featured ? gradients.brand : C.input),
                  color: isActive ? C.green : (b.featured ? "#fff" : C.text),
                  border: b.featured || isActive ? "none" : `1px solid ${C.line}`,
                  cursor: isActive ? "default" : "pointer",
                }}
              >
                {isActive ? "✓ Current plan" : `Get ${b.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {chosen && (
        <PaySheet
          bundle={chosen}
          cycle={cycle}
          walletBalance={state.wallet.balance}
          onClose={() => setChosen(null)}
          onWallet={async () => { const ok = await subscribe(chosen.id, cycle, { pay: "wallet" }); if (ok) setChosen(null); }}
          onCardDone={() => setChosen(null)}
          onTopUp={() => { setChosen(null); onTopUp(); }}
        />
      )}
    </div>
  );
}

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: 600 }}>{label}</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{used}/{total}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct > 90 ? C.amber : C.blue }} />
      </div>
    </div>
  );
}

export function PaySheet({ bundle, cycle, walletBalance, onClose, onWallet, onCardDone, onTopUp, desktop }: {
  bundle: Bundle; cycle: BillingCycle; walletBalance: number;
  onClose: () => void; onWallet: () => void; onCardDone: () => void; onTopUp: () => void;
  desktop?: boolean;
}) {
  const { state, showToast, syncBillingSoon } = useApp();
  const [pay, setPay] = useState<PayMethod>("wallet");
  const [busy, setBusy] = useState(false);
  const price = bundlePrice(bundle, cycle);
  const enough = walletBalance >= price;

  // Card = Stripe hosted Checkout. The plan is activated SERVER-SIDE by the
  // webhook; the browser redirects to Stripe and returns to ?pay=success.
  const payByCard = async () => {
    setBusy(true);
    try {
      await startCheckout({ kind: "plan", tier: bundle.id, cycle }); // redirects away
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Checkout failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: desktop ? "fixed" : "absolute", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: desktop ? "center" : "flex-end", justifyContent: "center", padding: desktop ? 24 : 0,
    }}>
      <div style={{
        width: desktop ? "min(460px, 96vw)" : "100%",
        maxHeight: desktop ? "90vh" : "92%", overflowY: "auto",
        background: C.card, borderRadius: desktop ? 22 : "26px 26px 0 0",
        border: `1px solid ${C.line}`, padding: desktop ? "22px 22px 26px" : "8px 20px 28px",
      }}>
        {!desktop && <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 14px" }}><div style={{ width: 38, height: 4, borderRadius: 2, background: C.line }} /></div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ color: C.text, fontSize: 19, fontWeight: 800 }}>{bundle.name} — {cycle}</h2>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 11, background: C.input, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={C.muted} /></button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
          {bundle.minutes} min + {bundle.sms} SMS · <b style={{ color: C.text }}>${price.toFixed(cycle === "annual" ? 0 : 2)}{cycle === "annual" ? "/yr" : "/mo"}</b>
        </p>

        <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 0.8, textTransform: "uppercase" }}>Pay with</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <PayTab active={pay === "wallet"} onClick={() => setPay("wallet")} Icon={Wallet} title="Wallet" sub={`Balance $${walletBalance.toFixed(2)}`} />
          <PayTab active={pay === "card"} onClick={() => setPay("card")} Icon={CreditCard} title="Card" sub="Pay directly" disabled={!stripeReady()} />
        </div>

        {pay === "wallet" ? (
          !enough ? (
            <>
              <p style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>Not enough balance — top up ${(price - walletBalance).toFixed(2)} more, or pay by card.</p>
              <button onClick={onTopUp} style={{ ...primaryBtn, background: C.input, color: C.text, border: `1px solid ${C.line}` }}>Top up wallet</button>
            </>
          ) : (
            <button disabled={busy} onClick={async () => { setBusy(true); await onWallet(); setBusy(false); }} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
              {busy ? "Activating…" : `Pay $${price.toFixed(cycle === "annual" ? 0 : 2)} from wallet`}
            </button>
          )
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 12, marginBottom: 12, textAlign: "center" }}>Pay <b style={{ color: C.text }}>${price.toFixed(cycle === "annual" ? 0 : 2)}</b> securely by card — renews automatically.</p>
            <button disabled={busy} onClick={payByCard} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {busy ? <><Loader2 size={17} className="dg-spin" /> Opening checkout…</> : <><CreditCard size={17} /> Pay by card</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PayTab({ active, onClick, Icon, title, sub, disabled }: {
  active: boolean; onClick: () => void; Icon: typeof Wallet; title: string; sub: string; disabled?: boolean;
}) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      flex: 1, padding: "12px", borderRadius: radius.md, textAlign: "left",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
      background: active ? "rgba(79,142,247,0.12)" : C.input,
      border: `1.5px solid ${active ? C.blue : C.line}`, fontFamily: font.sans,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <Icon size={18} color={active ? C.blue : C.muted} />
      <span>
        <span style={{ display: "block", color: active ? C.text : C.muted, fontSize: 14, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "block", color: C.muted, fontSize: 10.5, marginTop: 1 }}>{sub}</span>
      </span>
    </button>
  );
}

const iconBtn: CSSProperties = { width: 36, height: 36, borderRadius: 11, background: C.input, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const primaryBtn: CSSProperties = { width: "100%", padding: "15px", borderRadius: radius.md, background: gradients.brand, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: font.sans };
