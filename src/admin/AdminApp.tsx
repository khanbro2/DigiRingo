import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, Phone, CreditCard, ArrowLeftRight, Radio, Settings, Search, Bell, Wallet, Plug, LogOut,
  LifeBuoy, UsersRound,
} from "lucide-react";
import { A, gradients, font } from "./ui";
import { AdminProvider } from "./store";
import { AdminLogin } from "./AdminLogin";
import { verifySession, clearAdminToken, getAdminToken, type Session } from "./adminAuth";
import { Overview } from "./pages/Overview";
import { UsersPage } from "./pages/UsersPage";
import { NumbersPage } from "./pages/NumbersPage";
import { BillingPage } from "./pages/BillingPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { TelnyxPage } from "./pages/TelnyxPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminSupport } from "./pages/AdminSupport";
import { AdminTeam } from "./pages/AdminTeam";

type Section = "overview" | "users" | "numbers" | "telnyx" | "payments" | "integrations" | "billing" | "transactions" | "settings" | "support" | "team";

const ADMIN_NAV: Array<{ id: Section; label: string; Icon: typeof Users }> = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "support", label: "Support", Icon: LifeBuoy },
  { id: "team", label: "Team", Icon: UsersRound },
  { id: "users", label: "Users", Icon: Users },
  { id: "numbers", label: "Numbers", Icon: Phone },
  { id: "telnyx", label: "Telnyx", Icon: Radio },
  { id: "payments", label: "Payments", Icon: Wallet },
  { id: "integrations", label: "Integrations", Icon: Plug },
  { id: "billing", label: "Billing", Icon: CreditCard },
  { id: "transactions", label: "Transactions", Icon: ArrowLeftRight },
  { id: "settings", label: "Settings", Icon: Settings },
];
// Team members (agents) only get the support console.
const AGENT_NAV: Array<{ id: Section; label: string; Icon: typeof Users }> = [
  { id: "support", label: "Support", Icon: LifeBuoy },
];

export default function AdminApp() {
  const [section, setSection] = useState<Section>("overview");
  const [toast, setToast] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  // Gate the dashboard: verify the saved token (admin or agent) on load.
  const resolve = useCallback(async () => {
    setChecking(true);
    if (!getAdminToken()) { setSession(null); setChecking(false); return; }
    const s = await verifySession();
    setSession(s);
    if (s?.role === "agent") setSection("support");
    setChecking(false);
  }, []);
  useEffect(() => { resolve(); }, [resolve]);

  const logout = useCallback(() => { clearAdminToken(); setSession(null); }, []);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((cur) => (cur === m ? null : cur)), 2600);
  }, []);

  if (checking) {
    return <div style={{ minHeight: "100vh", background: A.shell, display: "grid", placeItems: "center", color: A.muted, fontFamily: font.sans, fontSize: 14 }}>Loading…</div>;
  }
  if (!session) return <AdminLogin onSuccess={resolve} />;

  const isAgent = session.role === "agent";
  const NAV = isAgent ? AGENT_NAV : ADMIN_NAV;

  const render = () => {
    // Agents are limited to the support console.
    if (isAgent) return <AdminSupport toast={showToast} />;
    switch (section) {
      case "overview": return <Overview />;
      case "support": return <AdminSupport toast={showToast} />;
      case "team": return <AdminTeam toast={showToast} />;
      case "users": return <UsersPage toast={showToast} />;
      case "numbers": return <NumbersPage toast={showToast} />;
      case "billing": return <BillingPage toast={showToast} />;
      case "transactions": return <TransactionsPage toast={showToast} />;
      case "telnyx": return <TelnyxPage toast={showToast} />;
      case "payments": return <PaymentsPage toast={showToast} />;
      case "integrations": return <IntegrationsPage toast={showToast} />;
      case "settings": return <SettingsPage toast={showToast} />;
    }
  };

  return (
   <AdminProvider>
    <div style={{ display: "flex", minHeight: "100vh", background: A.shell, fontFamily: font.sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: A.sidebar, flexShrink: 0, background: A.panel, borderRight: `1px solid ${A.line}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "22px 22px 18px", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: gradients.brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📦</div>
          <div>
            <p style={{ color: A.text, fontSize: 15, fontWeight: 800, lineHeight: 1 }}>DIGIRINGO</p>
            <p style={{ color: A.muted, fontSize: 11, marginTop: 3 }}>Control Hub</p>
          </div>
        </div>
        <nav style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ id, label, Icon }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 11,
                border: "none", cursor: "pointer", textAlign: "left", fontFamily: font.sans,
                background: active ? "rgba(79,142,247,0.14)" : "transparent",
                color: active ? A.blue : A.muted, fontSize: 14, fontWeight: active ? 700 : 500,
              }}>
                <Icon size={18} /> {label}
              </button>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", padding: 16 }}>
          <a href="/" style={{ display: "block", textAlign: "center", padding: "10px", borderRadius: 11, background: A.panelAlt, border: `1px solid ${A.line}`, color: A.muted, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>← Open mobile app</a>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <header style={{ height: 64, flexShrink: 0, borderBottom: `1px solid ${A.line}`, background: A.panel, display: "flex", alignItems: "center", gap: 16, padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ flex: 1, maxWidth: 420, position: "relative" }}>
            <Search size={15} color={A.muted} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search users, numbers, transactions…"
              style={{ width: "100%", padding: "10px 14px 10px 38px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 13.5, outline: "none" }} />
          </div>
          <button onClick={() => showToast("No new alerts")} style={{ width: 38, height: 38, borderRadius: 11, background: A.panelAlt, border: `1px solid ${A.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <Bell size={17} color={A.muted} />
            <span style={{ position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: "50%", background: A.red }} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: gradients.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>{(session.name || "A").charAt(0).toUpperCase()}</div>
            <div><p style={{ color: A.text, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{session.name}</p><p style={{ color: A.muted, fontSize: 11, marginTop: 3 }}>{isAgent ? "Support agent" : "Owner"}</p></div>
            <button onClick={logout} title="Sign out" style={{ width: 38, height: 38, borderRadius: 11, background: A.panelAlt, border: `1px solid ${A.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }}>
              <LogOut size={16} color={A.muted} />
            </button>
          </div>
        </header>

        <main style={{ padding: 24, flex: 1 }}>{render()}</main>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "12px 20px", borderRadius: 12, background: gradients.brand, color: "#fff", fontSize: 13.5, fontWeight: 600, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", animation: "slideUp .25s ease" }}>
          {toast}
        </div>
      )}
    </div>
   </AdminProvider>
  );
}
