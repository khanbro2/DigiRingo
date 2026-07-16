import { useState, useEffect } from "react";
import { BellRing, X } from "lucide-react";
import { gradients, font } from "../core/theme";
import { useApp } from "../store/AppStore";
import { initWebPush } from "../services/push";

/**
 * Prominent top bar shown while call notifications aren't allowed yet.
 * Browsers only show the permission prompt on a USER GESTURE, so the automatic
 * request after login is often suppressed — this bar gives the user a big,
 * obvious tap target that triggers the real prompt (and the push subscription).
 * Hides itself the moment permission is granted; explains recovery when denied.
 */
export function NotifyBar() {
  const { state } = useApp();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
    if (native || !("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
    // Auto-hide if permission is granted elsewhere (e.g. the login-time prompt).
    let status: PermissionStatus | null = null;
    navigator.permissions?.query({ name: "notifications" as PermissionName })
      .then((s) => { status = s; s.onchange = () => setPerm(Notification.permission); })
      .catch(() => { /* not queryable — fine */ });
    return () => { if (status) status.onchange = null; };
  }, [state.user]);

  if (!state.user || hidden || perm === "unsupported" || perm === "granted") return null;
  const denied = perm === "denied";

  const allow = async () => {
    if (busy || denied) return;
    setBusy(true);
    try { await initWebPush(); } finally {
      setPerm("Notification" in window ? Notification.permission : "unsupported");
      setBusy(false);
    }
  };

  return (
    <div onClick={allow} style={{
      background: gradients.brand, color: "#fff", padding: "11px 14px",
      display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      cursor: denied ? "default" : "pointer", fontFamily: font.sans,
      boxShadow: "0 2px 12px rgba(79,142,247,0.35)", position: "relative", zIndex: 60,
    }}>
      <BellRing size={17} style={{ flexShrink: 0 }} />
      <p style={{ flex: 1, fontSize: 12.5, fontWeight: 700, lineHeight: 1.35 }}>
        {denied
          ? "Notifications are blocked — tap the lock icon in your browser's address bar and allow notifications to get incoming-call alerts."
          : busy ? "Requesting permission…" : "Never miss a call — allow notifications to get call alerts even when this tab is in the background."}
      </p>
      {!denied && (
        <span style={{ fontSize: 12.5, fontWeight: 800, background: "rgba(255,255,255,0.24)", padding: "7px 14px", borderRadius: 9, flexShrink: 0 }}>
          {busy ? "…" : "Allow"}
        </span>
      )}
      <button onClick={(e) => { e.stopPropagation(); setHidden(true); }} title="Dismiss"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, display: "flex" }}>
        <X size={14} color="#fff" />
      </button>
    </div>
  );
}
