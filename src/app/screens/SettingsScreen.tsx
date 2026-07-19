import type { ReactNode } from "react";
import {
  ChevronRight, Building2, Hash, CreditCard, ShieldCheck, Contact,
  Ban, UserCircle, SlidersHorizontal, Bell, MessageCircle, LogOut, Sparkles, PhoneForwarded,
} from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";
import { ThemeToggle } from "../core/theme-context";

export type SettingsRoute =
  | "profile" | "general" | "preferences" | "notifications"
  | "contacts" | "blocklist" | "support" | "trust" | "numbers" | "billing" | "plans" | "forwarding";

interface Props { go: (route: SettingsRoute) => void; }

/** Settings — Quo-style hub. Every row navigates to a working screen. */
export function SettingsScreen({ go }: Props) {
  const { state, logout, showToast } = useApp();
  const u = state.user;
  const unverified = state.numbers.filter((n) => n.verification !== "verified").length;

  const workspace: Item[] = [
    { Icon: Building2,  label: "General",        color: C.blue,   onClick: () => go("general") },
    { Icon: Hash,       label: "Phone numbers",  color: C.purple, onClick: () => go("numbers") },
    { Icon: PhoneForwarded, label: "Call forwarding", color: C.green, onClick: () => go("forwarding") },
    { Icon: Sparkles,   label: "Plans & bundles",color: C.blue,   onClick: () => go("plans") },
    { Icon: CreditCard, label: "Wallet & billing",color: C.green,  onClick: () => go("billing") },
    { Icon: ShieldCheck,label: "Trust center",   color: C.amber,  onClick: () => go("trust"), badge: unverified || undefined },
    { Icon: Contact,    label: "Contacts",       color: C.blue,   onClick: () => go("contacts") },
    { Icon: Ban,        label: "Blocklist",      color: C.red,    onClick: () => go("blocklist") },
  ];
  const account: Item[] = [
    { Icon: UserCircle,        label: "Profile",       color: C.blue,   onClick: () => go("profile") },
    { Icon: SlidersHorizontal, label: "Preferences",   color: C.purple, onClick: () => go("preferences") },
    { Icon: Bell,              label: "Notifications", color: C.amber,  onClick: () => go("notifications") },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 24 }}>
      <div style={{ padding: "16px 20px 16px" }}>
        <h1 style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>Settings</h1>
      </div>

      {/* Account header → Profile */}
      <div style={{ padding: "0 20px 16px" }}>
        <button onClick={() => go("profile")} style={{ width: "100%", background: C.card, borderRadius: radius.lg, padding: 20, border: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", fontFamily: font.sans, textAlign: "left" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: gradients.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800, flexShrink: 0, boxShadow: "0 4px 16px rgba(79,142,247,0.35)" }}>{u?.initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: C.text, fontSize: 17, fontWeight: 800 }}>{u?.name}</p>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.email}</p>
            <span style={{ display: "inline-block", marginTop: 7, background: "rgba(34,197,94,0.14)", color: C.green, fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20 }}>PRO</span>
          </div>
          <ChevronRight size={17} color={C.muted} />
        </button>
      </div>

      <Section title="Workspace" items={workspace} />
      <Section title="Your account" items={account} />

      <div style={{ padding: "0 20px 16px" }}>
        <SectionLabel>Appearance</SectionLabel>
        <ThemeToggle variant="row" />
      </div>

      <div style={{ padding: "0 20px 16px" }}>
        <SectionLabel>Help</SectionLabel>
        <div style={{ background: C.card, borderRadius: radius.lg, border: `1px solid ${C.lineSoft}`, overflow: "hidden" }}>
          <MenuItem Icon={MessageCircle} label="Chat with us" color={C.blue} onClick={() => go("support")} last />
        </div>
      </div>

      <div style={{ padding: "0 20px 20px" }}>
        <button onClick={() => { logout(); showToast("You have been logged out"); }} style={{
          width: "100%", padding: "15px 16px", borderRadius: radius.lg, background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.14)", cursor: "pointer", display: "flex", alignItems: "center", gap: 13, textAlign: "left",
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><LogOut size={17} color={C.red} /></div>
          <span style={{ color: C.red, fontSize: 14, fontWeight: 700 }}>Log Out</span>
        </button>
      </div>

      <p style={{ textAlign: "center", color: C.muted, fontSize: 11, opacity: 0.6, paddingBottom: 80 }}>DIGIRINGO v2.3.0 · Made with ♥</p>
    </div>
  );
}

type Item = { Icon: typeof Bell; label: string; color: string; onClick?: () => void; badge?: number };

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <div style={{ padding: "0 20px 16px" }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ background: C.card, borderRadius: radius.lg, border: `1px solid ${C.lineSoft}`, overflow: "hidden" }}>
        {items.map((it, i) => <MenuItem key={it.label} {...it} last={i === items.length - 1} />)}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, paddingLeft: 4 }}>{children}</p>;
}

function MenuItem({ Icon, label, color, onClick, badge, last }: Item & { last?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "15px 16px", borderBottom: last ? "none" : `1px solid ${C.lineSoft}`,
      background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 13, textAlign: "left",
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color={color} />
      </div>
      <span style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 500, fontFamily: font.sans }}>{label}</span>
      {badge ? <span style={{ background: C.red, color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{badge}</span> : null}
      <ChevronRight size={16} color={C.muted} />
    </button>
  );
}
