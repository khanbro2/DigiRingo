import { useEffect } from "react";
import { Bell, MessageSquare, Wallet2, Phone, ShieldCheck, CheckCheck } from "lucide-react";
import { C, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";
import type { ActivityKind } from "../core/types";

const ICON: Record<ActivityKind, { Icon: typeof Bell; color: string; bg: string }> = {
  message:      { Icon: MessageSquare, color: C.blue,   bg: "rgba(124,92,255,0.14)" },
  call:         { Icon: Phone,         color: C.green,  bg: "rgba(34,197,94,0.14)" },
  wallet:       { Icon: Wallet2,       color: C.green,  bg: "rgba(34,197,94,0.14)" },
  number:       { Icon: Phone,         color: C.purple, bg: "rgba(155,111,247,0.14)" },
  verification: { Icon: ShieldCheck,   color: C.amber,  bg: "rgba(245,158,11,0.14)" },
  system:       { Icon: Bell,          color: C.muted,  bg: "rgba(136,146,170,0.14)" },
};

/** Activity — the notifications center shown to the user. */
export function ActivityScreen() {
  const { state, readAllActivity } = useApp();
  const unread = state.activity.filter((a) => !a.read).length;

  // Mark everything read shortly after the screen is opened.
  useEffect(() => {
    const id = setTimeout(readAllActivity, 1200);
    return () => clearTimeout(id);
  }, [readAllActivity]);

  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 24 }}>
      <div style={{ padding: "16px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>Activity</h1>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
            {unread > 0 ? <><span style={{ color: C.blue, fontWeight: 600 }}>{unread}</span> new notifications</> : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={readAllActivity} style={{
            padding: "8px 12px", borderRadius: 11, background: C.card, border: `1px solid ${C.line}`,
            color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex",
            alignItems: "center", gap: 6, fontFamily: font.sans,
          }}>
            <CheckCheck size={14} /> Mark read
          </button>
        )}
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {state.activity.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 70 }}>
            <div style={{ fontSize: 46, marginBottom: 12 }}>🔔</div>
            <p style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>No activity yet</p>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Notifications will appear here</p>
          </div>
        ) : state.activity.map((a) => {
          const { Icon, color, bg } = ICON[a.kind];
          return (
            <div key={a.id} style={{
              background: C.card, borderRadius: radius.lg, padding: 14,
              border: `1px solid ${a.read ? C.lineSoft : "rgba(124,92,255,0.25)"}`,
              display: "flex", gap: 12, position: "relative",
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={19} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{a.title}</p>
                  {!a.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, flexShrink: 0 }} />}
                </div>
                <p style={{ color: C.muted, fontSize: 12.5, marginTop: 3, lineHeight: 1.45 }}>{a.body}</p>
                <p style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>{a.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
