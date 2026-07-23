import { useState, type CSSProperties, type ReactNode } from "react";
import {
  LayoutGrid, Phone, MessageSquare, PhoneCall, Bell, Sparkles, Wallet2, ShieldCheck,
  Settings, Smartphone, Plus, LogOut, X, ChevronRight,
} from "lucide-react";
import { useApp } from "./store/AppStore";
import { colors as C, gradients, font, radius } from "./core/theme";
import { NUMBER_RENTAL, type BundleId, type BillingCycle } from "./core/plans";
import { buildNumber, PhoneGate } from "./MobileShell";
import { PhoneFrame } from "./components/PhoneFrame";
import { ThemeToggle } from "./core/theme-context";
import { DashHome, DashNumbers, DashInbox, DashCalls, DashActivity, DashPlans } from "./dashboard/DashScreens";

import { SettingsScreen, type SettingsRoute } from "./screens/SettingsScreen";
import {
  ProfilePage, GeneralPage, PreferencesPage, NotificationsPage,
  ContactsPage, BlocklistPage, SupportPage, CallForwardingPage,
} from "./screens/SettingsPages";
import { WalletScreen } from "./screens/WalletScreen";
import { NumberSettingsScreen } from "./screens/NumberSettingsScreen";
import { TrustCenterScreen } from "./screens/TrustCenterScreen";
import { DialerScreen } from "./screens/DialerScreen";
import { InCallScreen } from "./screens/InCallScreen";
import { BuyNumberModal } from "./components/BuyNumberModal";
import { NotifyBar } from "./components/NotifyBar";

export type Section = "home" | "numbers" | "inbox" | "calls" | "activity" | "plans" | "wallet" | "trust" | "settings";
type Sub =
  | { name: "numberSettings"; id: string }
  | { name: "profile" | "general" | "preferences" | "notifications" | "contacts" | "blocklist" | "support" | "forwarding" }
  | null;

const MAIN_NAV: Array<{ id: Section; label: string; Icon: typeof LayoutGrid }> = [
  { id: "home", label: "Overview", Icon: LayoutGrid },
  { id: "numbers", label: "Numbers", Icon: Phone },
  { id: "inbox", label: "Inbox", Icon: MessageSquare },
  { id: "calls", label: "Calls", Icon: PhoneCall },
  { id: "activity", label: "Activity", Icon: Bell },
];
const ACCT_NAV: Array<{ id: Section; label: string; Icon: typeof LayoutGrid }> = [
  { id: "plans", label: "Plans", Icon: Sparkles },
  { id: "wallet", label: "Wallet", Icon: Wallet2 },
  { id: "trust", label: "Trust Center", Icon: ShieldCheck },
  { id: "settings", label: "Settings", Icon: Settings },
];

const SECTION_META: Record<Section, { title: string; sub: string }> = {
  home: { title: "Overview", sub: "Your workspace at a glance" },
  numbers: { title: "Numbers", sub: "Manage your virtual lines" },
  inbox: { title: "Inbox", sub: "Conversations across your numbers" },
  calls: { title: "Calls", sub: "Call history & dialer" },
  activity: { title: "Activity", sub: "Alerts & account events" },
  plans: { title: "Plans", sub: "Bundles, usage & auto-renew" },
  wallet: { title: "Wallet", sub: "Balance, top-ups & transactions" },
  trust: { title: "Trust Center", sub: "10DLC brand & number verification" },
  settings: { title: "Settings", sub: "Profile & preferences" },
};

/**
 * Desktop dashboard shell. A persistent sidebar exposes every area of the app,
 * a slim top bar carries the primary actions (new number, notifications, and a
 * live mobile-preview toggle), and the content region reuses the very same
 * screens the mobile app renders — one store, two form factors.
 */
export function DashboardShell() {
  const { state, toasts, buyNumber, subscribeAndBuy, subscribeByCardAndBuy, searchNumbers, selectNumber, placeCall, showToast, logout } = useApp();
  const [section, setSection] = useState<Section>("home");
  const [sub, setSub] = useState<Sub>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [showDialer, setShowDialer] = useState(false);
  const [showMobile, setShowMobile] = useState(false);

  const unreadMsgs = state.conversations.reduce((s, c) => s + c.unread, 0);
  const unreadActivity = state.activity.filter((a) => !a.read).length;
  const missedCalls = state.calls.filter((c) => c.direction === "missed").length;
  const badges: Partial<Record<Section, number>> = { inbox: unreadMsgs, calls: missedCalls, activity: unreadActivity };

  const go = (s: Section) => { setSub(null); setSection(s); };

  // number-buy handlers (identical policy to the mobile shell)
  const handleSubscribeAndBuy = (n: { number: string; price: number; sms: boolean; voice: boolean }, tier: BundleId, cycle: BillingCycle) =>
    subscribeAndBuy(buildNumber(n), tier, cycle, { kind: "local" }).then((ok) => {
      if (ok) showToast(`Plan activated · ${n.number} added free 🎁`);
    });
  const handleCardPlanAndBuy = (n: { number: string; price: number; sms: boolean; voice: boolean }, tier: BundleId, cycle: BillingCycle) =>
    subscribeByCardAndBuy(buildNumber(n), tier, cycle).then((ok) => {
      if (ok) showToast(`Plan activated · ${n.number} added free 🎁`);
    });
  const handleAddNumber = (n: { number: string; price: number; sms: boolean; voice: boolean }, opts: { free?: boolean }) =>
    buyNumber(buildNumber(n), { ...opts, kind: "local" }).then((ok) => {
      if (ok) showToast(opts.free ? `${n.number} added free with your plan 🎁` : `${n.number} added for $${NUMBER_RENTAL.local.toFixed(2)}/mo`);
    });

  const goSettings = (route: SettingsRoute) => {
    if (route === "numbers") return go("numbers");
    if (route === "billing") return go("wallet");
    if (route === "plans") return go("plans");
    if (route === "trust") return go("trust");
    setSub({ name: route }); // profile / general / preferences / notifications / contacts / blocklist / support
  };

  const content = (): ReactNode => {
    if (sub?.name === "numberSettings") return <NumberSettingsScreen numberId={sub.id} onBack={() => setSub(null)} onOpenTrust={() => go("trust")} />;
    if (sub?.name === "profile")       return <ProfilePage onBack={() => setSub(null)} />;
    if (sub?.name === "general")       return <GeneralPage onBack={() => setSub(null)} />;
    if (sub?.name === "preferences")   return <PreferencesPage onBack={() => setSub(null)} />;
    if (sub?.name === "notifications") return <NotificationsPage onBack={() => setSub(null)} />;
    if (sub?.name === "contacts")      return <ContactsPage onBack={() => setSub(null)} />;
    if (sub?.name === "blocklist")     return <BlocklistPage onBack={() => setSub(null)} />;
    if (sub?.name === "support")       return <SupportPage onBack={() => setSub(null)} />;
    if (sub?.name === "forwarding")    return <CallForwardingPage onBack={() => setSub(null)} />;
    switch (section) {
      case "home":     return <DashHome onBuyNumber={() => setShowBuy(true)} go={go} />;
      case "numbers":  return <DashNumbers onBuyNumber={() => setShowBuy(true)} onOpenSettings={(id) => setSub({ name: "numberSettings", id })} onOpenInbox={(id) => { selectNumber(id); go("inbox"); }} />;
      case "inbox":    return <DashInbox />;
      case "calls":    return <DashCalls onOpenDialer={() => setShowDialer(true)} />;
      case "activity": return <DashActivity />;
      case "plans":    return <DashPlans onTopUp={() => go("wallet")} />;
      case "wallet":   return <WalletScreen onOpenTrust={() => go("trust")} desktop />;
      case "trust":    return <TrustCenterScreen onBack={() => go("home")} desktop />;
      case "settings": return <SettingsScreen go={goSettings} />;
    }
  };

  // Reused mobile screens (forms/cards) read better in a narrow column; the new
  // desktop-native screens use the full width.
  const narrow = !!sub || section === "wallet" || section === "trust" || section === "settings";

  const meta = SECTION_META[section];
  const user = state.user;

  const NavItem = ({ id, label, Icon }: { id: Section; label: string; Icon: typeof LayoutGrid }) => {
    const active = section === id && !sub;
    const badge = badges[id];
    return (
      <button onClick={() => go(id)} style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 12px",
        borderRadius: 11, cursor: "pointer", fontFamily: font.sans, textAlign: "left",
        background: active ? "rgba(124,92,255,0.12)" : "transparent",
        border: `1px solid ${active ? "rgba(124,92,255,0.28)" : "transparent"}`,
        color: active ? C.text : C.muted, transition: "background 0.15s, color 0.15s",
      }}>
        <Icon size={18} color={active ? C.blue : C.faint} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: active ? 700 : 500 }}>{label}</span>
        {badge ? <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: C.red, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span> : null}
      </button>
    );
  };

  return (
    // minWidth + overflowX: a small laptop window scrolls horizontally instead
    // of ever collapsing into the phone UI — desktop stays desktop.
    <div style={{ position: "relative", height: "100vh", width: "100vw", minWidth: 900, display: "flex", background: C.bg, fontFamily: font.sans, overflow: "hidden", overflowX: "auto" }}>
      {/* ---------- Sidebar ---------- */}
      <aside style={{ width: 252, flexShrink: 0, background: C.cardAlt, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", padding: "20px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 20px" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: gradients.brand, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(124,92,255,0.4)" }}>
            <Phone size={17} color="#fff" />
          </div>
          <div>
            <div style={{ color: C.text, fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>DIGIRINGO</div>
            <div style={{ color: C.faint, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4 }}>WORKSPACE</div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", flex: 1 }}>
          <p style={navLabel}>Main</p>
          {MAIN_NAV.map((n) => <NavItem key={n.id} {...n} />)}
          <p style={{ ...navLabel, marginTop: 16 }}>Account</p>
          {ACCT_NAV.map((n) => <NavItem key={n.id} {...n} />)}
        </nav>

        {/* wallet + user */}
        <button onClick={() => go("wallet")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: C.input, border: `1px solid ${C.line}`, cursor: "pointer", fontFamily: font.sans, marginTop: 12 }}>
          <Wallet2 size={16} color={C.green} />
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={{ display: "block", color: C.faint, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Wallet</span>
            <span style={{ display: "block", color: C.text, fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>${state.wallet.balance.toFixed(2)}</span>
          </span>
          <ChevronRight size={15} color={C.faint} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: gradients.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{user?.initial ?? "U"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name ?? "User"}</div>
            <div style={{ color: C.faint, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email ?? ""}</div>
          </div>
          <button onClick={logout} title="Log out" style={{ width: 32, height: 32, borderRadius: 9, background: "transparent", border: `1px solid ${C.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={15} color={C.muted} />
          </button>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Call-notification permission bar — prominent, above everything. */}
        <NotifyBar />
        {/* Top bar */}
        <header style={{ height: 66, flexShrink: 0, borderBottom: `1px solid ${C.line}`, background: C.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <div>
            <h1 style={{ color: C.text, fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{sub ? meta.title : meta.title}</h1>
            <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{meta.sub}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setShowBuy(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 11, border: "none", background: gradients.brand, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: font.sans, boxShadow: "0 6px 18px rgba(124,92,255,0.35)" }}>
              <Plus size={16} /> New number
            </button>
            <button onClick={() => go("activity")} title="Activity" style={iconBtn}>
              <Bell size={17} color={C.muted} />
              {unreadActivity > 0 && <span style={{ position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: "50%", background: C.red, border: `2px solid ${C.bg}` }} />}
            </button>
            <ThemeToggle />
            <button onClick={() => setShowMobile((v) => !v)} title="Mobile preview" style={{ ...iconBtn, background: showMobile ? "rgba(124,92,255,0.14)" : C.input, borderColor: showMobile ? "rgba(124,92,255,0.4)" : C.line }}>
              <Smartphone size={17} color={showMobile ? C.blue : C.muted} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", background: C.bg }}>
          <div key={sub ? `sub-${sub.name}` : section} className="tab-screen" style={{ maxWidth: narrow ? 720 : 1240, margin: "0 auto", padding: "22px 26px 44px" }}>
            {content()}
          </div>
        </main>
      </div>

      {/* ---------- Mobile preview panel ---------- */}
      {showMobile && (
        <div style={{ width: 372, flexShrink: 0, background: C.shell, borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column", animation: "fadeIn 0.24s ease" }}>
          <div style={{ height: 66, flexShrink: 0, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.text, fontSize: 13.5, fontWeight: 700 }}>
              <Smartphone size={16} color={C.blue} /> Mobile preview
            </span>
            <button onClick={() => setShowMobile(false)} style={iconBtn}><X size={16} color={C.muted} /></button>
          </div>
          <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "22px 0" }}>
            {/* fixed-size wrapper matches the scaled phone so there are no layout gaps */}
            <div style={{ width: 390 * MOBILE_SCALE, height: 844 * MOBILE_SCALE, flexShrink: 0 }}>
              <div style={{ transform: `scale(${MOBILE_SCALE})`, transformOrigin: "top left" }}>
                <PhoneFrame><PhoneGate preview /></PhoneFrame>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modals (overlay the whole dashboard) ---------- */}
      {showBuy && (
        <BuyNumberModal
          desktop
          onClose={() => setShowBuy(false)}
          onSearch={searchNumbers}
          walletBalance={state.wallet.balance}
          subscription={state.subscription}
          onSubscribeAndBuy={handleSubscribeAndBuy}
          onCardPlanAndBuy={handleCardPlanAndBuy}
          onAddNumber={handleAddNumber}
          onSeePlans={() => { setShowBuy(false); go("plans"); }}
        />
      )}
      {showDialer && (
        <div onClick={(e) => e.target === e.currentTarget && setShowDialer(false)} style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{ width: 380, height: "min(680px, 92vh)", background: C.bg, borderRadius: 26, border: `1px solid ${C.line}`, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,0.5)" }}>
            <DialerScreen onClose={() => setShowDialer(false)} onCall={(num) => { placeCall(num); setShowDialer(false); go("calls"); }} />
          </div>
        </div>
      )}

      {/* In-call overlay (covers the whole desktop viewport) */}
      <InCallScreen desktop />

      {/* ---------- Toasts ---------- */}
      <div style={{ position: "absolute", top: 16, right: 20, zIndex: 400, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", maxWidth: 380 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: "12px 16px", borderRadius: 14,
            background: t.type === "success" ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#dc2626,#b91c1c)",
            color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            animation: "slideDown 0.28s ease", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <span style={{ fontSize: 15 }}>{t.type === "success" ? "✓" : "✕"}</span>{t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

const MOBILE_SCALE = 0.82;

const navLabel: CSSProperties = { color: C.faint, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", padding: "0 10px 6px" };
const iconBtn: CSSProperties = { position: "relative", width: 40, height: 40, borderRadius: 11, background: C.input, border: `1px solid ${C.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
