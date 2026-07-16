import { useState } from "react";
import { Home, Phone, PhoneCall, MessageSquare, Bell, Settings } from "lucide-react";
import { useApp } from "./store/AppStore";
import { colors as C, gradients } from "./core/theme";
import type { PhoneNumber, ISOCountry } from "./core/types";

import { AuthScreen } from "./screens/AuthScreen";
import { VerifyGateScreen } from "./screens/VerifyGateScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { NumbersScreen } from "./screens/NumbersScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { CallsScreen } from "./screens/CallsScreen";
import { DialerScreen } from "./screens/DialerScreen";
import { InCallScreen } from "./screens/InCallScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import { SettingsScreen, type SettingsRoute } from "./screens/SettingsScreen";
import {
  ProfilePage, GeneralPage, PreferencesPage, NotificationsPage,
  ContactsPage, BlocklistPage, SupportPage, CallForwardingPage,
} from "./screens/SettingsPages";
import { WalletScreen } from "./screens/WalletScreen";
import { PlansScreen } from "./screens/PlansScreen";
import { NumberSettingsScreen } from "./screens/NumberSettingsScreen";
import { TrustCenterScreen } from "./screens/TrustCenterScreen";
import { BuyNumberModal } from "./components/BuyNumberModal";
import { NotifyBar } from "./components/NotifyBar";
import { NUMBER_RENTAL, type BundleId, type BillingCycle } from "./core/plans";

type Tab = "home" | "numbers" | "calls" | "inbox" | "activity" | "settings";
type Overlay =
  | { name: "numberSettings"; id: string }
  | { name: "trust" }
  | { name: "billing" }
  | { name: "plans" }
  | { name: "dialer" }
  | { name: "profile" }
  | { name: "general" }
  | { name: "preferences" }
  | { name: "notifications" }
  | { name: "contacts" }
  | { name: "blocklist" }
  | { name: "support" }
  | { name: "forwarding" }
  | null;

export const FLAGS: Record<string, { flag: string; country: ISOCountry }> = {
  "+1":  { flag: "🇺🇸", country: "United States" },
  "+44": { flag: "🇬🇧", country: "United Kingdom" },
  "+49": { flag: "🇩🇪", country: "Germany" },
  "+33": { flag: "🇫🇷", country: "France" },
  "+81": { flag: "🇯🇵", country: "Japan" },
  "+61": { flag: "🇦🇺", country: "Australia" },
};

/** Build a domain PhoneNumber from a search result (shared by mobile + dashboard). */
export function buildNumber(n: { number: string; price: number; sms: boolean; voice: boolean }): PhoneNumber {
  const key = Object.keys(FLAGS).find((k) => n.number.startsWith(k)) ?? "+1";
  const { flag, country } = FLAGS[key];
  return {
    id: `n${Date.now()}`, flag, number: n.number, country,
    sms: n.sms, voice: n.voice, price: NUMBER_RENTAL.local, verification: "unverified",
    settings: { label: "New Number", icon: "📱", businessHours: false, autoRecord: false, transcripts: false, forwardAll: false, muted: false, showInRecent: true, ringtone: "Default" },
  };
}

/** Inner shell — the phone app (bottom tabs + overlays). Has access to the store. */
export function Shell({ preview }: { preview?: boolean } = {}) {
  const { state, toasts, buyNumber, subscribeAndBuy, subscribeByCardAndBuy, searchNumbers, selectNumber, placeCall, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showBuy, setShowBuy] = useState(false);

  const unreadMsgs = state.conversations.reduce((s, c) => s + c.unread, 0);
  const unreadActivity = state.activity.filter((a) => !a.read).length;
  const missedCalls = state.calls.filter((c) => c.direction === "missed").length;

  const tabs: Array<{ id: Tab; label: string; Icon: typeof Home; badge?: number }> = [
    { id: "home",     label: "Home",     Icon: Home },
    { id: "numbers",  label: "Numbers",  Icon: Phone },
    { id: "calls",    label: "Calls",    Icon: PhoneCall, badge: missedCalls || undefined },
    { id: "inbox",    label: "Inbox",    Icon: MessageSquare, badge: unreadMsgs || undefined },
    { id: "activity", label: "Activity", Icon: Bell, badge: unreadActivity || undefined },
    { id: "settings", label: "Settings", Icon: Settings },
  ];

  // Activate a plan and claim this number free, in one flow (a number needs a plan).
  const handleSubscribeAndBuy = (n: { number: string; price: number; sms: boolean; voice: boolean }, tier: BundleId, cycle: BillingCycle) =>
    subscribeAndBuy(buildNumber(n), tier, cycle, { kind: "local" }).then((ok) => {
      if (ok) showToast(`Plan activated · ${n.number} added free 🎁`);
    });
  const handleCardPlanAndBuy = (n: { number: string; price: number; sms: boolean; voice: boolean }, tier: BundleId, cycle: BillingCycle) =>
    subscribeByCardAndBuy(buildNumber(n), tier, cycle).then((ok) => {
      if (ok) showToast(`Plan activated · ${n.number} added free 🎁`);
    });

  // Add a number to the existing plan — free (included slot) or a paid extra.
  const handleAddNumber = (n: { number: string; price: number; sms: boolean; voice: boolean }, opts: { free?: boolean }) =>
    buyNumber(buildNumber(n), { ...opts, kind: "local" }).then((ok) => {
      if (ok) showToast(opts.free ? `${n.number} added free with your plan 🎁` : `${n.number} added for $${NUMBER_RENTAL.local.toFixed(2)}/mo`);
    });

  const openInboxFor = (id: string) => { selectNumber(id); setActiveTab("inbox"); };

  const goSettings = (route: SettingsRoute) => {
    if (route === "numbers") { setActiveTab("numbers"); return; }
    setOverlay({ name: route });
  };

  const renderTab = () => {
    switch (activeTab) {
      case "home":     return <HomeScreen onBuyNumber={() => setShowBuy(true)} onOpenInbox={() => setActiveTab("inbox")} onOpenTrust={() => setOverlay({ name: "trust" })} onTopUp={() => setOverlay({ name: "billing" })} />;
      case "numbers":  return <NumbersScreen onBuyNumber={() => setShowBuy(true)} onOpenSettings={(id) => setOverlay({ name: "numberSettings", id })} onOpenInbox={openInboxFor} />;
      case "calls":    return <CallsScreen onOpenDialer={() => setOverlay({ name: "dialer" })} />;
      case "inbox":    return <InboxScreen />;
      case "activity": return <ActivityScreen />;
      case "settings": return <SettingsScreen go={goSettings} />;
    }
  };

  const renderOverlay = () => {
    if (!overlay) return null;
    if (overlay.name === "numberSettings") return <NumberSettingsScreen numberId={overlay.id} onBack={() => setOverlay(null)} onOpenTrust={() => setOverlay({ name: "trust" })} />;
    if (overlay.name === "trust")          return <TrustCenterScreen onBack={() => setOverlay(null)} />;
    if (overlay.name === "billing")        return <WalletScreen onBack={() => setOverlay(null)} onOpenTrust={() => setOverlay({ name: "trust" })} />;
    if (overlay.name === "plans")          return <PlansScreen onBack={() => setOverlay(null)} onTopUp={() => setOverlay({ name: "billing" })} />;
    if (overlay.name === "dialer")         return <DialerScreen onClose={() => setOverlay(null)} onCall={(num) => { placeCall(num); setOverlay(null); setActiveTab("calls"); }} />;
    if (overlay.name === "profile")        return <ProfilePage onBack={() => setOverlay(null)} />;
    if (overlay.name === "general")        return <GeneralPage onBack={() => setOverlay(null)} />;
    if (overlay.name === "preferences")    return <PreferencesPage onBack={() => setOverlay(null)} />;
    if (overlay.name === "notifications")  return <NotificationsPage onBack={() => setOverlay(null)} />;
    if (overlay.name === "contacts")       return <ContactsPage onBack={() => setOverlay(null)} />;
    if (overlay.name === "blocklist")      return <BlocklistPage onBack={() => setOverlay(null)} />;
    if (overlay.name === "support")        return <SupportPage onBack={() => setOverlay(null)} />;
    if (overlay.name === "forwarding")     return <CallForwardingPage onBack={() => setOverlay(null)} />;
    return null;
  };

  return (
    <>
      {/* Call-notification permission bar — prominent, above everything. */}
      <NotifyBar />

      {/* Main content */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        {overlay ? (
          <div key={overlay.name} className="tab-screen" style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            {renderOverlay()}
          </div>
        ) : (
          <div key={activeTab} className="tab-screen" style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            {renderTab()}
          </div>
        )}

        {showBuy && (
          <BuyNumberModal
            onClose={() => setShowBuy(false)}
            onSearch={searchNumbers}
            walletBalance={state.wallet.balance}
            subscription={state.subscription}
            onSubscribeAndBuy={handleSubscribeAndBuy}
            onCardPlanAndBuy={handleCardPlanAndBuy}
            onAddNumber={handleAddNumber}
            onSeePlans={() => setOverlay({ name: "plans" })}
          />
        )}

        {/* Toasts */}
        <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 300, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
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

      {/* Bottom tab bar — hidden while an overlay (drill-down) is open */}
      {!overlay && (
        <div style={{ height: 82, flexShrink: 0, background: C.cardAlt, borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "stretch", paddingBottom: 10 }}>
          {tabs.map(({ id, label, Icon, badge }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: "none", cursor: "pointer", position: "relative", paddingTop: 6 }}>
                {active && <div style={{ position: "absolute", top: 0, width: 28, height: 3, borderRadius: "0 0 4px 4px", background: gradients.brand }} />}
                <div style={{ position: "relative" }}>
                  <Icon size={22} color={active ? C.blue : C.faint} />
                  {badge && !active && (
                    <div style={{ position: "absolute", top: -5, right: -7, minWidth: 17, height: 17, borderRadius: 9, padding: "0 4px", background: C.red, fontSize: 9, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.cardAlt}` }}>{badge}</div>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.blue : C.faint, letterSpacing: 0.1 }}>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* In-call overlay — covers the whole phone while a call is active.
          Skipped in the dashboard's mobile PREVIEW (the real call UI is the
          desktop floating card), so the preview stays interactive. */}
      {!preview && <InCallScreen />}
    </>
  );
}

/** Phone auth gate — login until a user exists, then a hard email-verification
 *  gate until the email is confirmed, then the full phone app. */
export function PhoneGate({ preview }: { preview?: boolean } = {}) {
  const { state, toasts } = useApp();
  if (state.user && state.user.emailVerified !== false) return <Shell preview={preview} />;
  const screen = state.user ? <VerifyGateScreen /> : <AuthScreen />;
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
      <div className="tab-screen" style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
        {screen}
      </div>
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 300, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: "12px 16px", borderRadius: 14, background: t.type === "success" ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#dc2626,#b91c1c)", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", animation: "slideDown 0.28s ease", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ fontSize: 15 }}>{t.type === "success" ? "✓" : "✕"}</span>{t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
