import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, X, ShieldAlert, Loader2, CreditCard, RefreshCw } from "lucide-react";
import { C, font, radius, gradients } from "../core/theme";
import { useApp } from "../store/AppStore";
import { startCheckout, stripeReady } from "../services/stripe";
import { apiGetPaymentMethod, apiChangeCard, type ApiSavedCard } from "../services/api";

interface Props { onBack?: () => void; onOpenTrust: () => void; desktop?: boolean; }

// Quick top-up amounts (Stripe lets you charge ANY amount, so a custom amount is
// also offered below).
const PACKS = [5, 10, 20, 50];

/**
 * Wallet — balance + top-up. Top-ups are real money via the Stripe hosted
 * checkout: the user picks a pack, pays on Stripe (card / PayPal on their
 * side), and the wallet is credited SERVER-SIDE by the fulfilment webhook. We
 * then poll the balance so it appears within a few seconds.
 */
export function WalletScreen({ onBack, onOpenTrust, desktop }: Props) {
  const { state, addBalance, showToast } = useApp();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<number | null>(null); // amount currently checking out
  const [custom, setCustom] = useState("");
  const unverified = state.numbers.filter((n) => n.verification !== "verified").length;

  // Saved card on file (masked — Stripe holds the real card). Renewals charge it
  // directly; here the user can see it and swap it via a hosted Stripe flow.
  const [card, setCard] = useState<ApiSavedCard | null>(null);
  const [cardLoaded, setCardLoaded] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  useEffect(() => {
    if (!stripeReady()) { setCardLoaded(true); return; }
    apiGetPaymentMethod()
      .then((r) => setCard(r.card))
      .catch(() => { /* section still renders with "no card" */ })
      .finally(() => setCardLoaded(true));
  }, []);

  const changeCard = async () => {
    setCardBusy(true);
    try {
      const { url } = await apiChangeCard();
      window.location.href = url; // hosted Stripe setup page (card never touches us)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't start the card update", "error");
      setCardBusy(false);
    }
  };

  // Fallback for local dev / mock (no Stripe configured): credit locally.
  const topUpSimulated = (amount: number) => { addBalance(amount); setSheet(false); showToast(`$${amount.toFixed(2)} added (test)`); };

  const topUp = async (amount: number) => {
    if (!(amount > 0)) { showToast("Enter an amount", "error"); return; }
    if (!stripeReady()) { topUpSimulated(amount); return; }
    setBusy(amount);
    try {
      // Redirects to Stripe Checkout; the webhook credits the wallet, and we
      // return to ?pay=success where the balance is refreshed.
      await startCheckout({ kind: "topup", amount });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Checkout failed", "error");
      setBusy(null);
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 24, position: "relative" }}>
      <div style={{ padding: "16px 16px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && <button onClick={onBack} style={iconBtn}><ArrowLeft size={17} color={C.text} /></button>}
        <h1 style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>Wallet</h1>
      </div>

      {/* Balance card */}
      <div style={{ padding: "0 20px 16px" }}>
        <div style={{ borderRadius: 22, padding: "28px 24px", background: "linear-gradient(135deg,#112358 0%,#1e1047 55%,#0f2040 100%)", border: "1px solid rgba(124,92,255,0.18)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%", background: "rgba(124,92,255,0.08)" }} />
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Available Balance</p>
          <p style={{ color: "#fff", fontSize: 46, fontWeight: 800, marginTop: 8, lineHeight: 1, letterSpacing: -1 }}>
            ${Math.floor(state.wallet.balance)}<span style={{ fontSize: 28, fontWeight: 600 }}>.{(state.wallet.balance % 1).toFixed(2).slice(2)}</span>
          </p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 8, fontFamily: font.mono }}>DIGIRINGO Wallet • {state.user?.name}</p>
          <button onClick={() => setSheet(true)} style={{ marginTop: 22, padding: "10px 22px", borderRadius: 12, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Top Up
          </button>
        </div>
      </div>

      {/* Payment method — the card on file for auto-renewals (masked; the real
          card lives at Stripe). Change swaps it via a hosted setup page. */}
      {stripeReady() && cardLoaded && (
        <div style={{ padding: "0 20px 16px" }}>
          <p style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Payment method</p>
          <div style={{ background: C.card, borderRadius: radius.lg, border: `1px solid ${C.lineSoft}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(124,92,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={20} color={C.blue} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {card ? (
                <>
                  <p style={{ color: C.text, fontSize: 14, fontWeight: 700, textTransform: "capitalize", fontFamily: font.mono }}>
                    {card.brand} •••• {card.last4}
                  </p>
                  <p style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>
                    Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)} · used for auto-renewals
                  </p>
                </>
              ) : (
                <>
                  <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>No card saved</p>
                  <p style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>Add a card so plans & numbers renew automatically</p>
                </>
              )}
            </div>
            <button onClick={changeCard} disabled={cardBusy} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 11,
              background: C.input, border: `1px solid ${C.line}`, color: C.text, fontSize: 12.5, fontWeight: 700,
              cursor: cardBusy ? "default" : "pointer", fontFamily: font.sans, opacity: cardBusy ? 0.6 : 1, flexShrink: 0,
            }}>
              {cardBusy ? <Loader2 size={14} className="dg-spin" /> : <RefreshCw size={13} />}
              {card ? "Change" : "Add card"}
            </button>
          </div>
        </div>
      )}

      {/* Verification gating note */}
      {unverified > 0 && (
        <div style={{ padding: "0 20px 16px" }}>
          <button onClick={onOpenTrust} style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: radius.md, padding: 13, display: "flex", alignItems: "center", gap: 10, fontFamily: font.sans }}>
            <ShieldAlert size={17} color={C.amber} />
            <span style={{ color: C.amber, fontSize: 12, fontWeight: 600, flex: 1 }}>Balance added, but {unverified} number{unverified > 1 ? "s" : ""} must be registered to send SMS</span>
          </button>
        </div>
      )}

      {/* Transactions */}
      <div style={{ padding: "0 20px" }}>
        <p style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Transaction History</p>
        <div style={{ background: C.card, borderRadius: radius.lg, border: `1px solid ${C.lineSoft}`, overflow: "hidden" }}>
          {state.wallet.txns.map((tx, i) => {
            const credit = tx.amount > 0;
            return (
              <div key={tx.id} style={{ padding: "13px 16px", borderBottom: i < state.wallet.txns.length - 1 ? `1px solid ${C.lineSoft}` : "none", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, fontSize: 19, background: credit ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{credit ? "💳" : "📱"}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{tx.label}</p>
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{tx.time}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {credit ? <ArrowDownLeft size={13} color={C.green} /> : <ArrowUpRight size={13} color={C.red} />}
                  <span style={{ color: credit ? C.green : C.red, fontSize: 14, fontWeight: 800 }}>{credit ? "+" : ""}{tx.amount.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-up sheet — pick a pack; pay on Stripe. Centered dialog on desktop,
          bottom sheet on mobile. */}
      {sheet && (
        <div onClick={(e) => e.target === e.currentTarget && busy === null && setSheet(false)} style={{
          position: desktop ? "fixed" : "absolute", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: desktop ? "center" : "flex-end", justifyContent: "center",
          padding: desktop ? 24 : 0,
        }}>
          <div style={{
            width: desktop ? "min(460px, 96vw)" : "100%",
            maxHeight: desktop ? "90vh" : "92%", overflowY: "auto",
            background: C.card,
            borderRadius: desktop ? 22 : "26px 26px 0 0",
            border: `1px solid ${C.line}`, padding: desktop ? "22px 22px 26px" : "8px 20px 28px",
          }}>
            {!desktop && <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 14px" }}><div style={{ width: 38, height: 4, borderRadius: 2, background: C.line }} /></div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h2 style={{ color: C.text, fontSize: 19, fontWeight: 800 }}>Top Up Wallet</h2>
              <button onClick={() => busy === null && setSheet(false)} style={{ width: 34, height: 34, borderRadius: 11, background: C.input, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={C.muted} /></button>
            </div>
            <p style={{ color: C.muted, fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>
              Choose an amount and pay securely by card{stripeReady() ? "" : " (test mode)"}. Your balance updates as soon as the payment is confirmed.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {PACKS.map((p) => {
                const isBusy = busy === p;
                const disabled = busy !== null;
                return (
                  <button key={p} onClick={() => !disabled && topUp(p)} disabled={disabled} style={{
                    padding: "22px 0", borderRadius: radius.md, cursor: disabled ? "not-allowed" : "pointer", fontFamily: font.sans,
                    background: isBusy ? "rgba(124,92,255,0.12)" : C.input,
                    border: `1.5px solid ${isBusy ? C.blue : C.line}`, opacity: disabled && !isBusy ? 0.5 : 1,
                    color: C.text, fontSize: 22, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    {isBusy ? <><Loader2 size={18} className="dg-spin" color={C.blue} /> <span style={{ fontSize: 14, color: C.blue }}>Opening…</span></> : `$${p}`}
                  </button>
                );
              })}
            </div>

            {/* Custom amount (Stripe supports any amount) */}
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", margin: "16px 0 8px" }}>Or enter an amount</p>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", background: C.input, border: `1.5px solid ${C.line}`, borderRadius: radius.md, padding: "0 14px" }}>
                <span style={{ color: C.muted, fontSize: 18, fontWeight: 800 }}>$</span>
                <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} placeholder="25.00" inputMode="decimal"
                  style={{ flex: 1, padding: "14px 8px", background: "transparent", border: "none", color: C.text, fontSize: 18, fontWeight: 700, outline: "none", fontFamily: font.sans }} />
              </div>
              <button onClick={() => { const a = Math.round(parseFloat(custom) * 100) / 100; if (a > 0) topUp(a); }} disabled={busy !== null || !(parseFloat(custom) > 0)} style={{
                padding: "0 22px", borderRadius: radius.md, border: "none", cursor: busy !== null || !(parseFloat(custom) > 0) ? "not-allowed" : "pointer",
                background: parseFloat(custom) > 0 ? gradients.brand : C.input, color: parseFloat(custom) > 0 ? "#fff" : C.muted, fontSize: 14, fontWeight: 800, fontFamily: font.sans,
              }}>Top up</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: CSSProperties = { width: 36, height: 36, borderRadius: 11, background: C.input, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
