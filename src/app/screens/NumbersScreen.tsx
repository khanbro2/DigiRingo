import { useState, type CSSProperties } from "react";
import { Search, Plus, ChevronDown, Settings2, MessageSquare, ShieldCheck, Clock } from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";
import type { PhoneNumber, VerificationStatus } from "../core/types";

interface Props {
  onBuyNumber: () => void;
  onOpenSettings: (id: string) => void;
  onOpenInbox: (id: string) => void;
}

const VERIFY: Record<VerificationStatus, { label: string; color: string; bg: string; Icon: typeof ShieldCheck }> = {
  verified:   { label: "Verified",   color: C.green, bg: "rgba(34,197,94,0.14)",  Icon: ShieldCheck },
  pending:    { label: "Pending",    color: C.amber, bg: "rgba(245,158,11,0.14)", Icon: Clock },
  unverified: { label: "Unverified", color: C.red,   bg: "rgba(239,68,68,0.14)",  Icon: ShieldCheck },
};

export function NumbersScreen({ onBuyNumber, onOpenSettings, onOpenInbox }: Props) {
  const { state } = useApp();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("All");
  const [dropOpen, setDropOpen] = useState(false);

  const countries = ["All", ...Array.from(new Set(state.numbers.map((n) => n.country)))];
  const filtered = state.numbers.filter((n) => {
    const q = search.toLowerCase();
    const matchQ = !q || n.number.toLowerCase().includes(q) || n.country.toLowerCase().includes(q) || n.settings.label.toLowerCase().includes(q);
    const matchC = country === "All" || n.country === country;
    return matchQ && matchC;
  });

  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 100 }}>
      <div style={{ padding: "16px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>My Numbers</h1>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{state.numbers.length} active numbers</p>
        </div>
        <button onClick={onBuyNumber} style={{
          padding: "9px 16px", borderRadius: 13, background: gradients.brand, border: "none",
          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: font.sans,
        }}>
          <Plus size={14} /> Buy
        </button>
      </div>

      {/* Search + filter */}
      <div style={{ padding: "0 20px 16px", display: "flex", gap: 10 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={14} color={C.muted} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search numbers…"
            style={{ width: "100%", padding: "11px 14px 11px 36px", background: C.input, border: `1px solid ${C.line}`, borderRadius: 13, color: C.text, fontSize: 13, outline: "none", fontFamily: font.sans }} />
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setDropOpen((v) => !v)} style={{ height: "100%", padding: "0 14px", background: C.input, border: `1px solid ${C.line}`, borderRadius: 13, color: C.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
            {country === "All" ? "🌍" : state.numbers.find((n) => n.country === country)?.flag || "🌍"}
            <ChevronDown size={13} />
          </button>
          {dropOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, minWidth: 170, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
              {countries.map((c, i) => (
                <button key={c} onClick={() => { setCountry(c); setDropOpen(false); }} style={{
                  width: "100%", padding: "11px 16px", textAlign: "left",
                  background: country === c ? "rgba(124,92,255,0.14)" : "transparent",
                  color: country === c ? C.blue : C.text, fontSize: 13, fontWeight: country === c ? 600 : 400,
                  border: "none", cursor: "pointer", borderBottom: i < countries.length - 1 ? `1px solid ${C.lineSoft}` : "none", fontFamily: font.sans,
                }}>{c === "All" ? "🌍 All Countries" : `${state.numbers.find((n) => n.country === c)?.flag} ${c}`}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📭</div>
            <p style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No numbers found</p>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 22 }}>Try a different search or buy a new number</p>
            <button onClick={onBuyNumber} style={{ padding: "11px 28px", borderRadius: 14, background: gradients.brand, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Buy Number</button>
          </div>
        ) : filtered.map((n) => (
          <NumberCard key={n.id} n={n} onSettings={() => onOpenSettings(n.id)} onInbox={() => onOpenInbox(n.id)} />
        ))}
      </div>

      <button onClick={onBuyNumber} style={{
        position: "fixed", bottom: 98, right: "calc(50% - 195px + 16px)", width: 54, height: 54, borderRadius: "50%",
        background: gradients.brand, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 24px rgba(124,92,255,0.45)", zIndex: 20,
      }}>
        <Plus size={23} color="#fff" />
      </button>
    </div>
  );
}

function NumberCard({ n, onSettings, onInbox }: { n: PhoneNumber; onSettings: () => void; onInbox: () => void }) {
  const v = VERIFY[n.verification];
  return (
    <div style={{ background: C.card, borderRadius: radius.lg, padding: 16, border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23 }}>{n.flag}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, fontFamily: font.mono, letterSpacing: 0.4 }}>{n.number}</p>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{n.settings.label} · {n.country}</p>
        </div>
        {/* verification badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 20, background: v.bg }}>
          <v.Icon size={12} color={v.color} />
          <span style={{ color: v.color, fontSize: 10.5, fontWeight: 700 }}>{v.label}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flex: 1 }}>
          {n.sms && <span style={tag(C.blue, "rgba(124,92,255,0.14)")}>SMS</span>}
          {n.voice && <span style={tag(C.purple, "rgba(155,111,247,0.14)")}>Voice</span>}
          <span style={{ color: C.muted, fontSize: 12, alignSelf: "center", marginLeft: 2 }}><span style={{ color: C.green, fontWeight: 700 }}>${n.price}</span>/mo</span>
        </div>
        {/* Number actions */}
        <button onClick={onInbox} title="Open inbox" style={actionBtn}><MessageSquare size={15} color={C.blue} /></button>
        <button onClick={onSettings} title="Number settings" style={actionBtn}><Settings2 size={15} color={C.muted} /></button>
      </div>
    </div>
  );
}

const tag = (color: string, bg: string): CSSProperties => ({ padding: "3px 10px", borderRadius: 20, background: bg, color, fontSize: 11, fontWeight: 700 });
const actionBtn: CSSProperties = { width: 34, height: 34, borderRadius: 11, background: C.input, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
