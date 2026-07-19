import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  adminGetConfig, adminSaveSecret, adminSaveGeneral, adminSaveProvider, adminSaveWebhook,
  adminCreateKey, adminRevokeKey,
  type AdminConfig, type ConfigProvider, type ConfigCredential, type ConfigWebhook,
  type ConfigPlatformKey, type ConfigGeneral,
} from "./api";

/**
 * Control Hub settings store — now fully server-backed. Every value is fetched
 * from /api/admin/config (which merges the encrypted DB store with the live
 * server env); every mutation POSTs and replaces state with the server's fresh
 * snapshot. Secret VALUES never come back — only "set/missing" + last 4 chars.
 */
export type { ConfigProvider as PaymentProvider, ConfigCredential as ApiCredential, ConfigWebhook as Webhook, ConfigPlatformKey as PlatformKey, ConfigGeneral as GeneralSettings };

// The credential row id → the encrypted secret name the server stores it under.
const CRED_SECRET: Record<string, string> = {
  telnyx: "TELNYX_API_KEY", stripe: "STRIPE_SECRET_KEY", paypal: "PAYPAL_CLIENT_SECRET", smtp: "SMTP_PASS",
};

const EMPTY: AdminConfig = {
  providers: [], credentials: [], platformKeys: [], webhooks: [],
  general: { platformName: "DIGIRINGO", supportEmail: "", currency: "USD", platformFeePct: 0, payoutSchedule: "Daily", payoutDestination: "" },
};

interface AdminCtx extends AdminConfig {
  loading: boolean;
  reload: () => void;
  saveProvider: (id: string, secret: string, account?: string) => Promise<void>;
  toggleProvider: (id: string) => Promise<void>;
  saveCredential: (id: string, key: string) => Promise<void>;
  toggleWebhook: (id: string) => Promise<void>;
  addWebhook: (label: string, url: string) => Promise<void>;
  createKey: (name: string) => Promise<string>;
  revokeKey: (id: string) => Promise<void>;
  saveGeneral: (patch: Partial<ConfigGeneral>) => Promise<void>;
}

const Ctx = createContext<AdminCtx | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<AdminConfig>(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    adminGetConfig().then(setCfg).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const api: AdminCtx = {
    ...cfg,
    loading,
    reload,
    saveProvider: useCallback(async (id, secret, account) => { setCfg(await adminSaveProvider({ id, secret, account })); }, []),
    toggleProvider: useCallback(async (id) => {
      const p = cfg.providers.find((x) => x.id === id);
      setCfg(await adminSaveProvider({ id, enabled: !(p?.enabled) }));
    }, [cfg.providers]),
    saveCredential: useCallback(async (id, key) => { setCfg(await adminSaveSecret(CRED_SECRET[id] || id, key)); }, []),
    toggleWebhook: useCallback(async (id) => { setCfg(await adminSaveWebhook({ action: "toggle", id })); }, []),
    addWebhook: useCallback(async (label, url) => { setCfg(await adminSaveWebhook({ action: "add", label, url })); }, []),
    createKey: useCallback(async (name) => { const r = await adminCreateKey(name); setCfg(r.config); return r.key; }, []),
    revokeKey: useCallback(async (id) => { setCfg(await adminRevokeKey(id)); }, []),
    saveGeneral: useCallback(async (patch) => { setCfg(await adminSaveGeneral(patch)); }, []),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used within AdminProvider");
  return c;
}
