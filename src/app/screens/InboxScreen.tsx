import { useState, useRef, useEffect, type CSSProperties } from "react";
import { ArrowLeft, Send as SendIcon, Phone, ChevronDown, Check, ShieldAlert, Inbox as InboxIcon } from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";

/**
 * Inbox — number-wise. Conversations are scoped to the selected owned number
 * (the "inbox"). A switcher lets the user jump between their numbers' inboxes.
 */
export function InboxScreen() {
  const { state, selectNumber, sendMessage, markRead } = useApp();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeNumber = state.numbers.find((n) => n.id === state.activeNumberId) ?? state.numbers[0];
  const inboxConvos = state.conversations.filter((c) => c.numberId === activeNumber?.id);
  const activeConvo = state.conversations.find((c) => c.id === activeConvoId);

  // unread counts per number for the switcher
  const unreadFor = (numId: string) =>
    state.conversations.filter((c) => c.numberId === numId).reduce((s, c) => s + c.unread, 0);

  useEffect(() => {
    if (activeConvo) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages.length, activeConvo]);

  const openConvo = (id: string) => { setActiveConvoId(id); markRead(id); };

  const send = () => {
    if (!draft.trim() || !activeConvoId) return;
    if (sendMessage(activeConvoId, draft.trim())) setDraft("");
  };

  /* ---------- Chat view ---------- */
  if (activeConvo) {
    const num = state.numbers.find((n) => n.id === activeConvo.numberId);
    const locked = num?.verification !== "verified";
    return (
      <div style={{ background: C.bg, height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 14px", background: C.card, borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => setActiveConvoId(null)} style={iconBtn}>
            <ArrowLeft size={17} color={C.text} />
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{activeConvo.contactFlag}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: C.text, fontSize: 13, fontWeight: 700, fontFamily: font.mono }}>{activeConvo.contact}</p>
            <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>via {num?.settings.label || num?.number}</p>
          </div>
          <button style={{ ...iconBtn, background: "rgba(124,92,255,0.12)" }}><Phone size={16} color={C.blue} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {activeConvo.messages.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.sent ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "76%" }}>
                <div style={{
                  padding: "10px 14px", borderRadius: m.sent ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: m.sent ? gradients.brand : C.card, border: m.sent ? "none" : `1px solid ${C.line}`,
                }}>
                  <p style={{ color: C.text, fontSize: 14, lineHeight: 1.45 }}>{m.text}</p>
                </div>
                <p style={{ color: C.muted, fontSize: 10, marginTop: 5, textAlign: m.sent ? "right" : "left" }}>
                  {m.time}{m.sent && m.status ? ` · ${DLR_LABEL[m.status]}` : ""}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {locked && (
          <div style={{ margin: "0 16px 8px", padding: "10px 14px", borderRadius: radius.md, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={15} color={C.amber} />
            <span style={{ color: C.amber, fontSize: 11.5, fontWeight: 600 }}>Register this number to send messages</span>
          </div>
        )}

        <div style={{ padding: "12px 16px 20px", background: C.card, borderTop: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={locked ? "Number not registered…" : "Type a message…"}
            style={{ flex: 1, padding: "12px 16px", background: C.input, border: `1px solid ${C.line}`, borderRadius: radius.xl, color: C.text, fontSize: 14, outline: "none", fontFamily: font.sans }}
          />
          <button onClick={send} style={{
            width: 46, height: 46, borderRadius: "50%", flexShrink: 0, border: "none",
            background: locked ? "rgba(255,255,255,0.08)" : gradients.brand,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: locked ? "none" : "0 4px 16px rgba(124,92,255,0.4)",
          }}>
            <SendIcon size={17} color={locked ? C.faint : "#fff"} />
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Inbox list view ---------- */
  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 24, position: "relative" }}>
      {/* Inbox header / switcher trigger */}
      <div style={{ padding: "16px 20px 8px" }}>
        <h1 style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>Inbox</h1>
        <button onClick={() => setShowSwitcher(true)} style={{
          marginTop: 10, width: "100%", background: C.card, border: `1px solid ${C.line}`,
          borderRadius: radius.md, padding: "12px 14px", display: "flex", alignItems: "center",
          gap: 12, cursor: "pointer", fontFamily: font.sans,
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{activeNumber?.settings.icon}</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{activeNumber?.settings.label || "Inbox"}</p>
            <p style={{ color: C.muted, fontSize: 12, fontFamily: font.mono, marginTop: 2 }}>{activeNumber?.number}</p>
          </div>
          <ChevronDown size={18} color={C.muted} />
        </button>
      </div>

      {/* Conversations for the active inbox */}
      <div style={{ padding: "8px 20px 0" }}>
        {inboxConvos.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 46, marginBottom: 12 }}>📭</div>
            <p style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>No conversations</p>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>This number has no messages yet</p>
          </div>
        ) : (
          <div style={{ background: C.card, borderRadius: radius.lg, border: `1px solid ${C.lineSoft}`, overflow: "hidden" }}>
            {inboxConvos.map((c, i) => (
              <div key={c.id} onClick={() => openConvo(c.id)} style={{
                padding: "14px 16px", borderBottom: i < inboxConvos.length - 1 ? `1px solid ${C.lineSoft}` : "none",
                display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, position: "relative" }}>
                  {c.contactFlag}
                  {c.unread > 0 && <div style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: C.green, border: "2px solid #10141f" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 700, fontFamily: font.mono }}>{c.contact}</p>
                  <p style={{ color: C.muted, fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.preview}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>{c.time}</span>
                  {c.unread > 0 && <span style={{ background: C.blue, color: "#fff", fontSize: 9, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inboxes switcher drawer */}
      {showSwitcher && (
        <div onClick={(e) => e.target === e.currentTarget && setShowSwitcher(false)} style={{ position: "absolute", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%", background: C.card, borderRadius: "26px 26px 0 0", border: `1px solid ${C.line}`, maxHeight: "82%", overflowY: "auto", padding: "8px 0 24px" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 6px" }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line }} />
            </div>
            <div style={{ padding: "8px 20px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <InboxIcon size={17} color={C.muted} />
              <p style={{ color: C.text, fontSize: 16, fontWeight: 800 }}>Inboxes</p>
            </div>
            {state.numbers.map((n) => {
              const u = unreadFor(n.id);
              const sel = n.id === activeNumber?.id;
              return (
                <button key={n.id} onClick={() => { selectNumber(n.id); setShowSwitcher(false); }} style={{
                  width: "100%", padding: "13px 20px", background: sel ? "rgba(124,92,255,0.12)" : "transparent",
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: font.sans,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{n.settings.icon}</div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{n.settings.label}</p>
                    <p style={{ color: C.muted, fontSize: 12, fontFamily: font.mono, marginTop: 2 }}>{n.number}</p>
                  </div>
                  {u > 0 && <span style={{ background: C.blue, color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{u}</span>}
                  {sel && <Check size={17} color={C.blue} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 36, height: 36, borderRadius: 11, background: C.input, border: "none",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
};

/** Telnyx delivery-status label shown under sent bubbles. */
const DLR_LABEL: Record<string, string> = {
  sending: "Sending…", sent: "Sent ✓", delivered: "Delivered ✓✓", failed: "Failed ✕",
};
