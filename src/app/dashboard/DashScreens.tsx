import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import {
  Phone, MessageSquare, Wallet2, Sparkles, Plus, Send, Settings2,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, ShieldCheck,
  Check, Gift, CheckCheck, ArrowRight, SquarePen, X, Trash2,
} from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";
import { BUNDLES, bundlePrice, getBundle, type Bundle, type BillingCycle } from "../core/plans";
import { PaySheet } from "../screens/PlansScreen";
import type { Section } from "../DashboardShell";

/* ============================================================ shared UI ==== */

function Panel({ title, sub, action, children, bodyPad = 18, scroll }: {
  title?: string; sub?: string; action?: ReactNode; children: ReactNode; bodyPad?: number; scroll?: boolean;
}) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.lineSoft}`, borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {(title || action) && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: `1px solid ${C.lineSoft}`, flexShrink: 0 }}>
          <div>
            <h3 style={{ color: C.text, fontSize: 14.5, fontWeight: 800 }}>{title}</h3>
            {sub && <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div style={{ padding: bodyPad, overflowY: scroll ? "auto" : "visible", flex: scroll ? 1 : "none", minHeight: 0 }}>{children}</div>
    </section>
  );
}

function StatTile({ Icon, label, value, sub, accent = C.blue }: { Icon: typeof Phone; label: string; value: ReactNode; sub?: string; accent?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.lineSoft}`, borderRadius: 16, padding: "17px 18px" }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: `${accent}1f`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon size={18} color={accent} /></span>
      <div style={{ color: C.text, fontSize: 25, fontWeight: 800, marginTop: 13, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 12.5, marginTop: 1 }}>{label}</div>
      {sub && <div style={{ color: C.faint, fontSize: 11.5, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function VPill({ v }: { v: string }) {
  const map: Record<string, [string, string]> = { verified: ["Verified", C.green], pending: ["Pending", C.amber], unverified: ["Unverified", C.faint] };
  const [label, color] = map[v] || map.unverified;
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}1f`, padding: "3px 10px", borderRadius: 999, border: `1px solid ${color}40` }}>{label}</span>;
}

function Bar({ used, total, warnAt = 0.8 }: { used: number; total: number; warnAt?: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const over = used > total;
  const color = over ? C.red : pct / 100 >= warnAt ? C.amber : C.blue;
  return (
    <div style={{ height: 7, borderRadius: 4, background: "rgba(120,130,150,0.22)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width .5s ease" }} />
    </div>
  );
}

function Empty({ icon, title, hint, cta }: { icon: string; title: string; hint: string; cta?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ color: C.text, fontSize: 15.5, fontWeight: 700 }}>{title}</p>
      <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>{hint}</p>
      {cta && <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>{cta}</div>}
    </div>
  );
}

const primaryBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 11, border: "none", background: gradients.brand, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: font.sans, boxShadow: "0 6px 18px rgba(79,142,247,0.32)" };
const ghostBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.input, color: C.text, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font.sans };
const th: CSSProperties = { textAlign: "left", color: C.faint, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", padding: "0 14px 10px" };
const td: CSSProperties = { padding: "13px 14px", borderTop: `1px solid ${C.lineSoft}`, fontSize: 13, color: C.text, verticalAlign: "middle" };

/* ================================================================ Overview == */

export function DashHome({ onBuyNumber, go }: { onBuyNumber: () => void; go: (s: Section) => void }) {
  const { state } = useApp();
  const sub = state.subscription;
  const bundle = sub ? getBundle(sub.tier) : undefined;
  const unread = state.conversations.reduce((s, c) => s + c.unread, 0);
  const recentMsgs = state.conversations.slice(0, 5);
  const recentAct = state.activity.slice(0, 5);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatTile Icon={Phone} label="Active numbers" value={state.numbers.length} accent={C.blue} sub={`${state.numbers.filter((n) => n.verification === "verified").length} verified`} />
        <StatTile Icon={Wallet2} label="Wallet balance" value={`$${state.wallet.balance.toFixed(2)}`} accent={C.green} sub="Funds usage & top-ups" />
        <StatTile Icon={Sparkles} label="Current plan" value={bundle ? bundle.name : "Pay-as-you-go"} accent={C.purple} sub={sub ? `${sub.cycle} · renews ${new Date(sub.periodEnd).toLocaleDateString([], { month: "short", day: "numeric" })}` : "No active bundle"} />
        <StatTile Icon={MessageSquare} label="Unread messages" value={unread} accent={C.amber} sub={`${state.conversations.length} conversations`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {/* Plan usage */}
          <Panel title="Plan usage" action={<button style={ghostBtn} onClick={() => go("plans")}>Manage plan</button>}>
            {sub && bundle ? (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
                  {[["Minutes", sub.minutesUsed, sub.minutesIncluded], ["SMS", sub.smsUsed, sub.smsIncluded]].map(([label, u, t]) => (
                    <div key={label as string}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: C.muted, fontSize: 12.5, fontWeight: 600 }}>{label}</span>
                        <span style={{ color: C.text, fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{(u as number).toLocaleString()} / {(t as number).toLocaleString()}</span>
                      </div>
                      <Bar used={u as number} total={t as number} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={chip}><Gift size={13} color={C.green} /> {sub.numbersUsed}/{sub.numbersMax} numbers ({sub.numbersIncluded} free)</span>
                  <span style={chip}>{sub.autoRenew ? "🔄 Auto-renew on" : "⏸ Auto-renew off"}</span>
                  <span style={{ ...chip, color: sub.status === "past_due" ? C.red : C.muted }}>{sub.status === "past_due" ? "⚠ Past due — top up" : `$${sub.renewAmount.toFixed(2)} / ${sub.cycle}`}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>You're on <b style={{ color: C.text }}>pay-as-you-go</b>. Pick a plan for included minutes, SMS and a free number.</p>
                <button style={{ ...primaryBtn, flexShrink: 0 }} onClick={() => go("plans")}>Choose a plan <ArrowRight size={15} /></button>
              </div>
            )}
          </Panel>

          {/* Recent messages */}
          <Panel title="Recent messages" action={<button style={ghostBtn} onClick={() => go("inbox")}>Open inbox</button>} bodyPad={0}>
            {recentMsgs.length === 0 ? (
              <Empty icon="📭" title="No messages yet" hint="Conversations will appear here once you receive texts." />
            ) : recentMsgs.map((c, i) => (
              <button key={c.id} onClick={() => go("inbox")} style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: font.sans, background: "transparent", border: "none", borderTop: i ? `1px solid ${C.lineSoft}` : "none", padding: "13px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{c.contactFlag}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: C.text, fontSize: 13, fontWeight: 700, fontFamily: font.mono }}>{c.contact}</span>
                  <span style={{ display: "block", color: C.muted, fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</span>
                </span>
                <span style={{ color: C.faint, fontSize: 11, flexShrink: 0 }}>{c.time}</span>
                {c.unread > 0 && <span style={{ background: C.blue, color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>}
              </button>
            ))}
          </Panel>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {/* Quick actions */}
          <Panel title="Quick actions">
            <div style={{ display: "grid", gap: 10 }}>
              <button style={{ ...primaryBtn, width: "100%", justifyContent: "center", padding: "12px" }} onClick={onBuyNumber}><Plus size={16} /> Get a number</button>
              <button style={{ ...ghostBtn, width: "100%", justifyContent: "center", padding: "12px" }} onClick={() => go("wallet")}><Wallet2 size={15} color={C.green} /> Top up wallet</button>
              <button style={{ ...ghostBtn, width: "100%", justifyContent: "center", padding: "12px" }} onClick={() => go("trust")}><ShieldCheck size={15} color={C.blue} /> Verify a number</button>
            </div>
          </Panel>

          {/* Recent activity */}
          <Panel title="Recent activity" action={<button style={ghostBtn} onClick={() => go("activity")}>View all</button>} bodyPad={0}>
            {recentAct.length === 0 ? (
              <Empty icon="🔔" title="Nothing yet" hint="Account events show up here." />
            ) : recentAct.map((a, i) => (
              <div key={a.id} style={{ padding: "12px 18px", borderTop: i ? `1px solid ${C.lineSoft}` : "none", display: "flex", gap: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.read ? C.faint : C.blue, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: C.text, fontSize: 12.5, fontWeight: 700 }}>{a.title}</p>
                  <p style={{ color: C.muted, fontSize: 11.5, marginTop: 2, lineHeight: 1.45 }}>{a.body}</p>
                  <p style={{ color: C.faint, fontSize: 10.5, marginTop: 4 }}>{a.time}</p>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
const chip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.muted, background: C.input, border: `1px solid ${C.line}`, padding: "6px 11px", borderRadius: 999 };

/* ================================================================= Numbers == */

export function DashNumbers({ onBuyNumber, onOpenSettings, onOpenInbox }: { onBuyNumber: () => void; onOpenSettings: (id: string) => void; onOpenInbox: (id: string) => void }) {
  const { state, releaseNumber } = useApp();
  const nums = state.numbers;
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const confirmNum = nums.find((n) => n.id === confirmId);
  return (
    <Panel title={`Your numbers (${nums.length})`} sub="Every number belongs to a plan — the first is free" action={<button style={primaryBtn} onClick={onBuyNumber}><Plus size={16} /> New number</button>} bodyPad={nums.length ? 8 : 0}>
      {nums.length === 0 ? (
        <Empty icon="📱" title="No numbers yet" hint="Get your first number — it's free with any plan." cta={<button style={primaryBtn} onClick={onBuyNumber}><Plus size={15} /> Get a number</button>} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Number</th><th style={th}>Label</th><th style={th}>Country</th><th style={th}>Capabilities</th><th style={th}>Status</th><th style={{ ...th, textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {nums.map((n) => (
                <tr key={n.id}>
                  <td style={td}><span style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 18 }}>{n.flag}</span><span style={{ fontFamily: font.mono, fontWeight: 600, letterSpacing: 0.3 }}>{n.number}</span></span></td>
                  <td style={{ ...td, color: C.muted }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>{n.settings.icon} {n.settings.label}</span></td>
                  <td style={{ ...td, color: C.muted }}>{n.country}</td>
                  <td style={td}><span style={{ display: "flex", gap: 5 }}>{n.voice && <Cap label="Voice" />}{n.sms && <Cap label="SMS" />}</span></td>
                  <td style={td}><VPill v={n.verification} /></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <span style={{ display: "inline-flex", gap: 7, justifyContent: "flex-end" }}>
                      <button title="Open inbox" style={rowBtn} onClick={() => onOpenInbox(n.id)}><MessageSquare size={15} color={C.muted} /></button>
                      <button title="Settings" style={rowBtn} onClick={() => onOpenSettings(n.id)}><Settings2 size={15} color={C.muted} /></button>
                      <button title="Release number" style={{ ...rowBtn, borderColor: "rgba(239,68,68,0.3)" }} onClick={() => setConfirmId(n.id)}><Trash2 size={15} color={C.red} /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmNum && (
        <div onClick={(e) => e.target === e.currentTarget && setConfirmId(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 420, background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22 }}>
            <p style={{ color: C.text, fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Release {confirmNum.number}?</p>
            <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
              This gives the number back to Telnyx and stops its monthly rental. You'll lose any texts &amp; call history on it, and it can't be recovered — you'd have to buy a new number.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button disabled={releasing} onClick={() => setConfirmId(null)} style={{ padding: "11px 18px", borderRadius: radius.md, background: C.input, border: `1px solid ${C.line}`, color: C.text, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: font.sans }}>Keep number</button>
              <button disabled={releasing} onClick={async () => { setReleasing(true); const ok = await releaseNumber(confirmNum.id); setReleasing(false); if (ok) setConfirmId(null); }} style={{ padding: "11px 18px", borderRadius: radius.md, background: C.red, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: font.sans, opacity: releasing ? 0.7 : 1 }}>{releasing ? "Releasing…" : "Release"}</button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
const Cap = ({ label }: { label: string }) => <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, padding: "2px 7px", borderRadius: 6, background: "rgba(79,142,247,0.14)", color: C.blue, textTransform: "uppercase" }}>{label}</span>;
const rowBtn: CSSProperties = { width: 32, height: 32, borderRadius: 9, background: C.input, border: `1px solid ${C.line}`, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };

/* =================================================================== Inbox == */

const DLR: Record<string, string> = { sending: "Sending…", sent: "Sent ✓", delivered: "Delivered ✓✓", failed: "Failed ✕" };

export function DashInbox() {
  const { state, selectNumber, sendMessage, markRead, startConversation } = useApp();
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [newTo, setNewTo] = useState("");
  const [newBody, setNewBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeNumber = state.numbers.find((n) => n.id === state.activeNumberId) ?? state.numbers[0];
  const inboxConvos = state.conversations.filter((c) => c.numberId === activeNumber?.id);
  const activeConvo = state.conversations.find((c) => c.id === activeConvoId) ?? null;
  const num = activeConvo ? state.numbers.find((n) => n.id === activeConvo.numberId) : undefined;
  const locked = !!activeConvo && num?.verification !== "verified";
  const composeLocked = activeNumber?.verification !== "verified";

  useEffect(() => { if (activeConvo) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeConvo?.messages.length, activeConvo]);
  const openConvo = (id: string) => { setActiveConvoId(id); setComposing(false); markRead(id); };
  const send = () => { if (draft.trim() && activeConvoId && sendMessage(activeConvoId, draft.trim())) setDraft(""); };
  const sendNew = () => {
    const r = startConversation(newTo, newBody);
    if (r.ok && r.convoId) { setActiveConvoId(r.convoId); setComposing(false); setNewTo(""); setNewBody(""); }
  };
  const unreadFor = (id: string) => state.conversations.filter((c) => c.numberId === id).reduce((s, c) => s + c.unread, 0);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 158px)", minHeight: 420, background: C.card, border: `1px solid ${C.lineSoft}`, borderRadius: 16, overflow: "hidden" }}>
      {/* left: number switcher + conversations */}
      <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${C.lineSoft}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${C.lineSoft}`, display: "flex", flexDirection: "column", gap: 9 }}>
          <select value={activeNumber?.id ?? ""} onChange={(e) => { selectNumber(e.target.value); setActiveConvoId(null); setComposing(false); }} style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: C.input, border: `1px solid ${C.line}`, color: C.text, fontSize: 13, fontWeight: 600, fontFamily: font.sans, cursor: "pointer", outline: "none" }}>
            {state.numbers.map((n) => { const u = unreadFor(n.id); return <option key={n.id} value={n.id}>{n.settings.icon} {n.settings.label} — {n.number}{u ? ` (${u})` : ""}</option>; })}
          </select>
          <button onClick={() => { setComposing(true); setActiveConvoId(null); }} disabled={!activeNumber} style={{ width: "100%", padding: "10px 12px", borderRadius: 11, border: "none", background: gradients.brand, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: font.sans, cursor: activeNumber ? "pointer" : "not-allowed", opacity: activeNumber ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <SquarePen size={15} /> New message
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {inboxConvos.length === 0 ? (
            <Empty icon="📭" title="No conversations" hint="This number has no messages yet." />
          ) : inboxConvos.map((c) => {
            const active = c.id === activeConvoId;
            return (
              <button key={c.id} onClick={() => openConvo(c.id)} style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: font.sans, border: "none", borderBottom: `1px solid ${C.lineSoft}`, background: active ? "rgba(79,142,247,0.1)" : "transparent", padding: "13px 15px", display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{c.contactFlag}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: C.text, fontSize: 12.5, fontWeight: 700, fontFamily: font.mono }}>{c.contact}</span>
                  <span style={{ display: "block", color: C.muted, fontSize: 11.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  <span style={{ color: C.faint, fontSize: 10.5 }}>{c.time}</span>
                  {c.unread > 0 && <span style={{ background: C.blue, color: "#fff", fontSize: 9, fontWeight: 800, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* right: thread / compose */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {composing ? (
          <>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center" }}><SquarePen size={18} color={C.blue} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>New message</p>
                <p style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>from {activeNumber?.settings.label || activeNumber?.number}</p>
              </div>
              <button onClick={() => setComposing(false)} style={{ width: 34, height: 34, borderRadius: 10, background: C.input, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={C.muted} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", background: C.bg }}>
              <label style={{ color: C.muted, fontSize: 11.5, fontWeight: 700, display: "block", marginBottom: 7 }}>To</label>
              <input autoFocus value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="+1 555 123 4567" style={{ width: "100%", padding: "12px 15px", background: C.input, border: `1px solid ${C.line}`, borderRadius: 11, color: C.text, fontSize: 14, outline: "none", fontFamily: font.mono, marginBottom: 16 }} />
              <label style={{ color: C.muted, fontSize: 11.5, fontWeight: 700, display: "block", marginBottom: 7 }}>Message</label>
              <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendNew(); }} placeholder={composeLocked ? "Register this number to send…" : "Write your message…"} rows={5} style={{ width: "100%", padding: "12px 15px", background: C.input, border: `1px solid ${C.line}`, borderRadius: 11, color: C.text, fontSize: 13.5, outline: "none", fontFamily: font.sans, resize: "vertical", lineHeight: 1.5 }} />
              {composeLocked && <p style={{ color: C.amber, fontSize: 11.5, fontWeight: 600, marginTop: 10 }}>⚠ This number isn't registered yet — register it in Trust center to send SMS.</p>}
            </div>
            <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.lineSoft}`, display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
              <button onClick={sendNew} disabled={!newTo.trim() || !newBody.trim()} style={{ padding: "11px 20px", borderRadius: 999, border: "none", background: (!newTo.trim() || !newBody.trim()) ? "rgba(255,255,255,0.08)" : gradients.brand, color: (!newTo.trim() || !newBody.trim()) ? C.faint : "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: font.sans, cursor: (!newTo.trim() || !newBody.trim()) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}><Send size={15} /> Send</button>
            </div>
          </>
        ) : !activeConvo ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Empty icon="💬" title="Select a conversation" hint="Pick a thread on the left, or start a new message." />
          </div>
        ) : (
          <>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{activeConvo.contactFlag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: C.text, fontSize: 13.5, fontWeight: 700, fontFamily: font.mono }}>{activeConvo.contact}</p>
                <p style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>via {num?.settings.label || num?.number}</p>
              </div>
              <VPill v={num?.verification ?? "unverified"} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, background: C.bg }}>
              {activeConvo.messages.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.sent ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "60%" }}>
                    <div style={{ padding: "10px 14px", borderRadius: m.sent ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.sent ? gradients.brand : C.card, border: m.sent ? "none" : `1px solid ${C.line}` }}>
                      <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.45 }}>{m.text}</p>
                    </div>
                    <p style={{ color: C.faint, fontSize: 10, marginTop: 4, textAlign: m.sent ? "right" : "left" }}>{m.time}{m.sent && m.status ? ` · ${DLR[m.status]}` : ""}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={locked ? "Register this number to send…" : "Type a message…"} style={{ flex: 1, padding: "12px 16px", background: C.input, border: `1px solid ${C.line}`, borderRadius: 999, color: C.text, fontSize: 13.5, outline: "none", fontFamily: font.sans }} />
              <button onClick={send} style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, border: "none", background: locked ? "rgba(255,255,255,0.08)" : gradients.brand, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Send size={16} color={locked ? C.faint : "#fff"} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =================================================================== Calls == */

const DIR: Record<string, { Icon: typeof Phone; color: string }> = {
  incoming: { Icon: PhoneIncoming, color: C.green }, outgoing: { Icon: PhoneOutgoing, color: C.blue }, missed: { Icon: PhoneMissed, color: C.red },
};

export function DashCalls({ onOpenDialer }: { onOpenDialer: () => void }) {
  const { state, placeCall } = useApp();
  const calls = state.calls;
  return (
    <Panel title={`Call history (${calls.length})`} action={<button style={primaryBtn} onClick={onOpenDialer}><Phone size={15} /> Open dialer</button>} bodyPad={calls.length ? 8 : 0}>
      {calls.length === 0 ? (
        <Empty icon="📞" title="No calls yet" hint="Your call history will appear here." cta={<button style={primaryBtn} onClick={onOpenDialer}><Phone size={15} /> Make a call</button>} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Contact</th><th style={th}>Direction</th><th style={th}>Status</th><th style={th}>Duration</th><th style={{ ...th, textAlign: "right" }}>When</th><th style={{ ...th, textAlign: "right" }}></th></tr></thead>
            <tbody>
              {calls.map((k) => { const d = DIR[k.direction] || DIR.outgoing; return (
                <tr key={k.id}>
                  <td style={td}><span style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 17 }}>{k.contactFlag}</span><span style={{ fontFamily: font.mono, fontWeight: 600 }}>{k.contact}</span></span></td>
                  <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: d.color, fontWeight: 700, fontSize: 12.5, textTransform: "capitalize" }}><d.Icon size={15} /> {k.direction}</span></td>
                  <td style={{ ...td, color: C.muted }}>{k.status}</td>
                  <td style={{ ...td, fontVariantNumeric: "tabular-nums", color: C.muted }}>{k.duration || "—"}</td>
                  <td style={{ ...td, textAlign: "right", color: C.faint }}>{k.time}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => placeCall(k.contact)} title={`Call back ${k.contact}`} style={{
                      width: 32, height: 32, borderRadius: 10, background: "rgba(34,197,94,0.14)", border: "none",
                      cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Phone size={15} color={C.green} />
                    </button>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ================================================================ Activity == */

const ACT_ICON: Record<string, string> = { message: "💬", wallet: "💳", number: "📱", verification: "🛡️", call: "📞", system: "⚙️" };

export function DashActivity() {
  const { state, readAllActivity } = useApp();
  const items = state.activity;
  return (
    <Panel title={`Activity (${items.length})`} action={items.some((a) => !a.read) ? <button style={ghostBtn} onClick={readAllActivity}><CheckCheck size={15} color={C.green} /> Mark all read</button> : undefined} bodyPad={items.length ? 0 : 0}>
      {items.length === 0 ? (
        <Empty icon="🔔" title="No activity yet" hint="Account events, alerts and receipts show up here." />
      ) : items.map((a, i) => (
        <div key={a.id} style={{ padding: "15px 18px", borderTop: i ? `1px solid ${C.lineSoft}` : "none", display: "flex", gap: 13, background: a.read ? "transparent" : "rgba(79,142,247,0.04)" }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{ACT_ICON[a.kind] || "•"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{a.title}</p>
              {!a.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue }} />}
            </div>
            <p style={{ color: C.muted, fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>{a.body}</p>
            <p style={{ color: C.faint, fontSize: 11, marginTop: 5 }}>{a.time}</p>
          </div>
        </div>
      ))}
    </Panel>
  );
}

/* =================================================================== Plans == */

export function DashPlans({ onTopUp }: { onTopUp: () => void }) {
  const { state, subscribe, setAutoRenew, cancelSubscription } = useApp();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [chosen, setChosen] = useState<Bundle | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const sub = state.subscription;
  const activeBundle = sub ? getBundle(sub.tier) : undefined;
  const pastDue = sub?.status === "past_due";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* active plan panel */}
      {sub && activeBundle && (
        <Panel>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Sparkles size={16} color={C.blue} />
                <span style={{ color: C.text, fontSize: 17, fontWeight: 800 }}>{activeBundle.name}</span>
                <span style={{ color: C.muted, fontSize: 12.5 }}>· {sub.cycle}</span>
              </div>
              <p style={{ color: pastDue ? C.red : C.muted, fontSize: 12.5, marginTop: 6 }}>
                {pastDue ? "Renewal failed — top up your wallet to restore" : `${sub.autoRenew ? "Auto-renews" : "Ends"} ${new Date(sub.periodEnd).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}${sub.autoRenew ? ` · $${sub.renewAmount.toFixed(2)} from wallet` : ""}`}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                <span style={{ color: C.muted, fontSize: 12.5, fontWeight: 600 }}>Auto-renew from wallet</span>
                <button onClick={() => setAutoRenew(!sub.autoRenew)} style={{ width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: sub.autoRenew ? C.blue : "rgba(120,130,150,0.35)", transition: "background .2s" }}>
                  <span style={{ position: "absolute", top: 3, left: sub.autoRenew ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </button>
              </div>
              {pastDue && <button onClick={onTopUp} style={{ ...primaryBtn, marginTop: 14 }}>Top up wallet</button>}
              {!confirmCancel ? (
                <button onClick={() => setConfirmCancel(true)} style={{ marginTop: 12, padding: "9px 16px", borderRadius: radius.md, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font.sans }}>Cancel plan</button>
              ) : (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: radius.md, background: C.card, border: "1px solid rgba(239,68,68,0.3)", maxWidth: 320 }}>
                  <p style={{ color: C.text, fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>Cancel your plan? You'll lose included minutes &amp; SMS and move to pay-as-you-go. Re-subscribe anytime.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={cancelling} onClick={() => setConfirmCancel(false)} style={{ flex: 1, padding: "9px", borderRadius: radius.sm, border: `1px solid ${C.line}`, background: C.input, color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font.sans }}>Keep plan</button>
                    <button disabled={cancelling} onClick={async () => { setCancelling(true); const ok = await cancelSubscription(); setCancelling(false); if (ok) setConfirmCancel(false); }} style={{ flex: 1, padding: "9px", borderRadius: radius.sm, border: "none", background: C.red, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: font.sans, opacity: cancelling ? 0.7 : 1 }}>{cancelling ? "Cancelling…" : "Cancel plan"}</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 260, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {[["Minutes", sub.minutesUsed, sub.minutesIncluded], ["SMS", sub.smsUsed, sub.smsIncluded]].map(([label, u, t]) => (
                <div key={label as string}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: C.muted, fontSize: 12.5, fontWeight: 600 }}>{label}</span>
                    <span style={{ color: C.text, fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{(u as number).toLocaleString()} / {(t as number).toLocaleString()}</span>
                  </div>
                  <Bar used={u as number} total={t as number} />
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={chip}><Gift size={13} color={C.green} /> {sub.numbersUsed}/{sub.numbersMax} numbers used ({sub.numbersIncluded} free)</span>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* cycle toggle */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ display: "inline-flex", background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: 4, gap: 4 }}>
          {(["monthly", "annual"] as const).map((k) => { const on = cycle === k; return (
            <button key={k} onClick={() => setCycle(k)} style={{ border: "none", cursor: "pointer", padding: "8px 20px", borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: font.sans, background: on ? gradients.brand : "transparent", color: on ? "#fff" : C.muted, display: "inline-flex", alignItems: "center", gap: 7 }}>
              {k === "monthly" ? "Monthly" : "Annual"}{k === "annual" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: on ? "rgba(255,255,255,0.22)" : "rgba(34,197,94,0.15)", color: on ? "#fff" : C.green }}>2 mo free</span>}
            </button>
          ); })}
        </div>
      </div>

      {/* 3-across cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>
        {BUNDLES.map((b) => {
          const price = bundlePrice(b, cycle);
          const isActive = sub?.tier === b.id && sub.cycle === cycle && sub.status === "active";
          return (
            <div key={b.id} style={{ background: C.card, borderRadius: 18, padding: "22px 20px", border: `1.5px solid ${b.featured ? C.blue : C.lineSoft}`, position: "relative" }}>
              {b.featured && <span style={{ position: "absolute", top: -10, right: 18, background: gradients.brand, color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 11px", borderRadius: 999 }}>Most popular</span>}
              <h3 style={{ color: C.text, fontSize: 18, fontWeight: 800 }}>{b.name}</h3>
              <p style={{ color: C.muted, fontSize: 12.5, marginTop: 3, minHeight: 34 }}>{b.tagline}</p>
              <div style={{ margin: "10px 0 16px" }}>
                <span style={{ color: C.text, fontSize: 30, fontWeight: 800 }}>${price.toFixed(cycle === "annual" ? 0 : 2)}</span>
                <span style={{ color: C.muted, fontSize: 13 }}>{cycle === "annual" ? "/yr" : "/mo"}</span>
              </div>
              <div style={{ display: "grid", gap: 9 }}>
                {b.perks.map((p) => <div key={p} style={{ display: "flex", alignItems: "center", gap: 9 }}><Check size={15} color={C.green} /><span style={{ color: C.text, fontSize: 13 }}>{p}</span></div>)}
              </div>
              <button onClick={() => !isActive && setChosen(b)} disabled={isActive} style={{ width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: font.sans, cursor: isActive ? "default" : "pointer", background: isActive ? C.input : (b.featured ? gradients.brand : C.input), color: isActive ? C.green : (b.featured ? "#fff" : C.text), border: b.featured || isActive ? "none" : `1px solid ${C.line}` }}>
                {isActive ? "✓ Current plan" : `Get ${b.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {chosen && (
        <PaySheet
          desktop
          bundle={chosen} cycle={cycle} walletBalance={state.wallet.balance}
          onClose={() => setChosen(null)}
          onWallet={async () => { const ok = await subscribe(chosen.id, cycle, { pay: "wallet" }); if (ok) setChosen(null); }}
          onCardDone={() => setChosen(null)}
          onTopUp={() => { setChosen(null); onTopUp(); }}
        />
      )}
    </div>
  );
}
