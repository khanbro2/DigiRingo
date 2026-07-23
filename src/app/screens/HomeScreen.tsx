import { RefreshCw, Plus, Send, Wallet2, MessageSquare, ShieldCheck, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";

interface Props {
  onBuyNumber: () => void;
  onOpenInbox: () => void;
  onOpenTrust: () => void;
  onTopUp: () => void;
}

/**
 * Home — Quo-style layout. No analytics "insights" grid (removed per request);
 * instead a verification banner + Chats / Wallet summary cards + recent feed.
 */
export function HomeScreen({ onBuyNumber, onOpenInbox, onOpenTrust, onTopUp }: Props) {
  const { state } = useApp();
  const [spinning, setSpinning] = useState(false);
  const refresh = () => { setSpinning(true); setTimeout(() => setSpinning(false), 900); };

  const unread = state.conversations.reduce((s, c) => s + c.unread, 0);
  const unverified = state.numbers.filter((n) => n.verification !== "verified").length;
  const recent = [...state.conversations].sort((a, b) => b.unread - a.unread).slice(0, 5);
  const first = state.user?.name?.split(" ")[0] ?? "there";

  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: C.muted, fontSize: 12, fontWeight: 500, letterSpacing: 0.3 }}>{state.user?.workspace}</p>
          <h1 style={{ color: C.text, fontSize: 23, fontWeight: 800, marginTop: 3, lineHeight: 1.2 }}>Good morning, {first} 👋</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            You have <span style={{ color: C.blue, fontWeight: 600 }}>{unread} unread</span> messages
          </p>
        </div>
        <button onClick={refresh} style={{
          width: 38, height: 38, borderRadius: 12, background: C.card,
          border: `1px solid ${C.line}`, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }}>
          <RefreshCw size={15} color={C.muted} className={spinning ? "spin" : ""} />
        </button>
      </div>

      {/* Verification banner (Trust center entry) */}
      {unverified > 0 && (
        <div style={{ padding: "0 20px 14px" }}>
          <button onClick={onOpenTrust} style={{
            width: "100%", textAlign: "left", cursor: "pointer",
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: radius.lg, padding: 14, display: "flex", alignItems: "center", gap: 12,
            fontFamily: font.sans,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, background: "rgba(245,158,11,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><ShieldCheck size={19} color={C.amber} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Register your numbers</p>
              <p style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>
                {unverified} number{unverified > 1 ? "s" : ""} need verification to send SMS
              </p>
            </div>
            <ChevronRight size={18} color={C.amber} />
          </button>
        </div>
      )}

      {/* Summary cards (Quo-style) */}
      <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <SummaryCard
          icon={<MessageSquare size={18} color={C.blue} />} iconBg="rgba(124,92,255,0.14)"
          value={`${unread}`} label="Unread chats" onClick={onOpenInbox}
        />
        <SummaryCard
          icon={<Wallet2 size={18} color={C.green} />} iconBg="rgba(34,197,94,0.14)"
          value={`$${state.wallet.balance.toFixed(2)}`} label="Wallet balance" onClick={onTopUp}
        />
      </div>

      {/* Quick actions */}
      <div style={{ padding: "0 20px 20px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Buy Number", Icon: Plus,    grad: gradients.brand,    fn: onBuyNumber },
            { label: "Send SMS",   Icon: Send,    grad: gradients.brandRev, fn: onOpenInbox },
            { label: "Top Up",     Icon: Wallet2, grad: gradients.green,    fn: onTopUp },
          ].map(({ label, Icon, grad, fn }) => (
            <button key={label} onClick={fn} style={{
              flex: 1, padding: "12px 0", background: grad, borderRadius: radius.md, border: "none",
              color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6, cursor: "pointer", letterSpacing: 0.2, fontFamily: font.sans,
            }}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent messages */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>Recent Messages</p>
          <button onClick={onOpenInbox} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>See all</button>
        </div>
        <div style={{ background: C.card, borderRadius: radius.lg, border: `1px solid ${C.lineSoft}`, overflow: "hidden" }}>
          {recent.map((m, i) => (
            <div key={m.id} onClick={onOpenInbox} style={{
              padding: "13px 16px", borderBottom: i < recent.length - 1 ? `1px solid ${C.lineSoft}` : "none",
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{m.contactFlag}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 600, fontFamily: font.mono }}>{m.contact}</p>
                <p style={{ color: C.muted, fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.preview}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                <span style={{ color: C.muted, fontSize: 11 }}>{m.time}</span>
                {m.unread > 0 && (
                  <span style={{ background: C.blue, color: "#fff", fontSize: 9, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{m.unread}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, iconBg, value, label, onClick }: {
  icon: ReactNode; iconBg: string; value: string; label: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      background: C.card, borderRadius: radius.lg, padding: 16, border: `1px solid ${C.lineSoft}`,
      textAlign: "left", cursor: "pointer", fontFamily: font.sans,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{icon}</div>
      <p style={{ color: C.text, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</p>
      <p style={{ color: C.muted, fontSize: 11, marginTop: 5, fontWeight: 500 }}>{label}</p>
    </button>
  );
}
