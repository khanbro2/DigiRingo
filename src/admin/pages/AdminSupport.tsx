import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageSquare } from "lucide-react";
import { A, gradients, font } from "../ui";
import { adminGetThreads, adminGetThread, adminReply, type AdminThread, type AdminSupportMessage } from "../api";

/** Control Hub support inbox — customer threads on the left, live chat on the right. */
export function AdminSupport({ toast }: { toast: (m: string) => void }) {
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(() => { adminGetThreads().then((r) => setThreads(r.threads)).catch(() => {}); }, []);
  const loadThread = useCallback((uid: number) => { adminGetThread(uid).then((r) => setMessages(r.messages)).catch(() => {}); }, []);

  // Poll the thread list.
  useEffect(() => { loadThreads(); const t = setInterval(loadThreads, 5000); return () => clearInterval(t); }, [loadThreads]);
  // Poll the open conversation.
  useEffect(() => {
    if (active == null) { setMessages([]); return; }
    loadThread(active);
    const t = setInterval(() => loadThread(active), 4000);
    return () => clearInterval(t);
  }, [active, loadThread]);

  useEffect(() => { requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })); }, [messages.length]);

  const send = async () => {
    const body = reply.trim();
    if (!body || active == null || sending) return;
    setSending(true); setReply("");
    try { const r = await adminReply(active, body); setMessages(r.messages); loadThreads(); }
    catch (e) { setReply(body); toast(e instanceof Error ? e.message : "Could not send"); }
    finally { setSending(false); }
  };

  const activeThread = threads.find((t) => t.userId === active);

  return (
    <div>
      <h1 style={{ color: A.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Support</h1>
      <p style={{ color: A.muted, fontSize: 13.5, marginBottom: 20 }}>{threads.length} conversation{threads.length === 1 ? "" : "s"} · live chat with customers</p>

      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 210px)", minHeight: 420 }}>
        {/* Threads list */}
        <div style={{ width: 320, flexShrink: 0, background: A.panel, border: `1px solid ${A.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${A.line}`, color: A.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>Inbox</div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {threads.length === 0 ? (
              <p style={{ color: A.muted, fontSize: 13, textAlign: "center", padding: "40px 20px" }}>No conversations yet.</p>
            ) : threads.map((t) => {
              const on = t.userId === active;
              return (
                <button key={t.userId} onClick={() => setActive(t.userId)} style={{
                  width: "100%", textAlign: "left", padding: "13px 16px", border: "none", cursor: "pointer",
                  borderBottom: `1px solid ${A.lineSoft}`, background: on ? "rgba(124,92,255,0.12)" : "transparent",
                  display: "flex", flexDirection: "column", gap: 3, fontFamily: font.sans,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: A.text, fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || t.email}</span>
                    <span style={{ color: A.faint, fontSize: 10.5, flexShrink: 0 }}>{t.time}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ flex: 1, color: A.muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.lastSender === "agent" ? "You: " : ""}{t.lastBody}
                    </span>
                    {t.unread > 0 && <span style={{ background: A.red, color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>{t.unread}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation */}
        <div style={{ flex: 1, minWidth: 0, background: A.panel, border: `1px solid ${A.line}`, borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {active == null ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: A.muted, gap: 10 }}>
              <MessageSquare size={30} color={A.faint} />
              <p style={{ fontSize: 14 }}>Select a conversation to reply</p>
            </div>
          ) : (
            <>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${A.line}` }}>
                <p style={{ color: A.text, fontSize: 14.5, fontWeight: 700 }}>{activeThread?.name || "Customer"}</p>
                <p style={{ color: A.muted, fontSize: 12, marginTop: 2 }}>{activeThread?.email}</p>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map((m) => {
                  const staff = m.sender === "agent";
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: staff ? "flex-end" : "flex-start" }}>
                      {staff && m.agentName && <p style={{ color: A.faint, fontSize: 10, margin: "0 8px 3px" }}>{m.agentName}</p>}
                      <div style={{
                        maxWidth: "72%", padding: "10px 13px", fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        background: staff ? gradients.brand : A.panelAlt, color: staff ? "#fff" : A.text,
                        border: staff ? "none" : `1px solid ${A.line}`,
                        borderRadius: 14, borderBottomRightRadius: staff ? 4 : 14, borderBottomLeftRadius: staff ? 14 : 4,
                      }}>{m.body}</div>
                      <p style={{ color: A.faint, fontSize: 10, margin: "3px 8px 0" }}>{m.time}</p>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: 14, borderTop: `1px solid ${A.line}`, display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a reply…" rows={1}
                  style={{ flex: 1, padding: "11px 14px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 12, color: A.text, fontSize: 14, outline: "none", fontFamily: font.sans, resize: "none", maxHeight: 120 }} />
                <button onClick={send} disabled={sending || !reply.trim()} style={{
                  width: 44, height: 44, borderRadius: 12, background: gradients.brand, border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: sending || !reply.trim() ? "default" : "pointer",
                  opacity: sending || !reply.trim() ? 0.5 : 1, flexShrink: 0,
                }}><Send size={18} color="#fff" /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
