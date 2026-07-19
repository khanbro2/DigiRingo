import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Search, Wallet, Eye, X, RefreshCw } from "lucide-react";
import { A, Card, Badge, Button, Table, Td, PageHeader, Modal, money, font } from "../ui";
import {
  adminListUsers, adminGetUser, adminSetStatus, adminAdjustWallet, adminSetSubscription, adminReleaseNumber,
  type AdminUserRow, type AdminUserDetail,
} from "../api";

export function UsersPage({ toast }: { toast: (m: string) => void }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [wallet, setWallet] = useState<AdminUserRow | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback((query: string) => {
    setLoading(true);
    adminListUsers(query).then((r) => setUsers(r.users)).catch((e) => toast(e instanceof Error ? e.message : "Could not load users")).finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(""); }, [load]);
  // Debounced search.
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q, load]);

  const setStatus = async (u: AdminUserRow, status: "active" | "suspended") => {
    try {
      await adminSetStatus(u.id, status);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status } : x));
      toast(status === "suspended" ? `${u.name} suspended` : `${u.name} reactivated`);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not update"); }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle={loading ? "Loading…" : `${users.length} account${users.length === 1 ? "" : "s"}`}
        action={<Button variant="ghost" onClick={() => load(q)}><RefreshCw size={15} /> Refresh</Button>} />

      <Card pad={0}>
        <div style={{ padding: 16, borderBottom: `1px solid ${A.line}`, position: "relative" }}>
          <Search size={15} color={A.muted} style={{ position: "absolute", left: 30, top: 27 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…"
            style={{ width: "100%", maxWidth: 340, padding: "10px 14px 10px 38px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 13.5, outline: "none" }} />
        </div>
        <Table head={["User", "Plan", "Numbers", "Balance", "Status", "Joined", "Actions"]}>
          {users.length === 0 ? (
            <tr><td colSpan={7} style={{ color: A.muted, textAlign: "center", padding: "34px 0", fontSize: 13.5 }}>{loading ? "Loading…" : "No users found."}</td></tr>
          ) : users.map((u) => (
            <tr key={u.id}>
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: A.panelAlt, display: "flex", alignItems: "center", justifyContent: "center", color: A.text, fontWeight: 800, fontSize: 13 }}>{u.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{u.name}{!u.verified && <Badge tone="amber">unverified</Badge>}</p>
                    <p style={{ color: A.muted, fontSize: 12 }}>{u.email}</p>
                  </div>
                </div>
              </Td>
              <Td><Badge tone={u.plan === "Business" ? "purple" : u.plan === "Pro" ? "blue" : "muted"}>{u.plan}</Badge></Td>
              <Td>{u.numbers}</Td>
              <Td style={{ fontWeight: 700 }}>{money(u.balance)}</Td>
              <Td><Badge tone={u.status === "active" ? "green" : "red"}>{u.status}</Badge></Td>
              <Td style={{ color: A.muted }}>{u.joined}</Td>
              <Td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Button size="sm" variant="ghost" onClick={() => setWallet(u)}><Wallet size={13} /> Wallet</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDetailId(u.id)}><Eye size={13} /> View</Button>
                  <Button size="sm" variant={u.status === "suspended" ? "primary" : "danger"} onClick={() => setStatus(u, u.status === "suspended" ? "active" : "suspended")}>{u.status === "suspended" ? "Reactivate" : "Suspend"}</Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      {wallet && (
        <WalletModal user={wallet} toast={toast} onClose={() => setWallet(null)}
          onDone={(newBalance) => { setUsers((prev) => prev.map((x) => x.id === wallet.id ? { ...x, balance: newBalance } : x)); setWallet(null); }} />
      )}
      {detailId != null && <UserDrawer id={detailId} toast={toast} onClose={() => setDetailId(null)} />}
    </div>
  );
}

/* Credit / debit a customer's wallet. */
function WalletModal({ user, toast, onClose, onDone }: { user: AdminUserRow; toast: (m: string) => void; onClose: () => void; onDone: (b: number) => void }) {
  const [mode, setMode] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const val = Number(amount);
    if (!(val > 0)) { toast("Enter an amount greater than 0"); return; }
    setBusy(true);
    try {
      const signed = mode === "credit" ? val : -val;
      const r = await adminAdjustWallet(user.id, signed, note.trim() || (mode === "credit" ? "Admin credit" : "Admin adjustment"));
      toast(`${mode === "credit" ? "Credited" : "Debited"} ${money(val)} — new balance ${money(r.wallet.balance)}`);
      onDone(r.wallet.balance);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not adjust wallet"); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Adjust wallet — ${user.name}`} onClose={onClose}>
      <p style={{ color: A.muted, fontSize: 13, marginBottom: 14 }}>Current balance: <span style={{ color: A.text, fontWeight: 700 }}>{money(user.balance)}</span></p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["credit", "debit"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: "10px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700, textTransform: "capitalize",
            border: `1px solid ${mode === m ? (m === "credit" ? A.green : A.red) : A.line}`,
            background: mode === m ? (m === "credit" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)") : A.panelAlt,
            color: mode === m ? (m === "credit" ? A.green : A.red) : A.muted,
          }}>{m === "credit" ? "Add funds" : "Deduct"}</button>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <p style={{ color: A.muted, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Amount (USD)</p>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" type="number" inputMode="decimal"
          style={{ width: "100%", padding: "11px 14px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 14, outline: "none" }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: A.muted, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Note (shows in the customer's activity)</p>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Goodwill credit"
          style={{ width: "100%", padding: "11px 14px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 14, outline: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>{busy ? "Saving…" : mode === "credit" ? "Add funds" : "Deduct"}</Button>
      </div>
    </Modal>
  );
}

/* Slide-over with a customer's full detail. */
function UserDrawer({ id, toast, onClose }: { id: number; toast: (m: string) => void; onClose: () => void }) {
  const [d, setD] = useState<AdminUserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { adminGetUser(id).then((r) => setD(r.user)).catch((e) => toast(e instanceof Error ? e.message : "Could not load")); }, [id, toast]);
  useEffect(() => { load(); }, [load]);

  const [confirmNum, setConfirmNum] = useState<string | null>(null);

  const subAction = async (action: "cancel" | "pause" | "resume") => {
    setBusy(true);
    try {
      await adminSetSubscription(id, action);
      toast(action === "cancel" ? "Plan cancelled" : action === "pause" ? "Plan paused" : "Plan resumed");
      load();
    } catch (e) { toast(e instanceof Error ? e.message : "Could not update plan"); }
    finally { setBusy(false); }
  };

  const releaseNum = async (e164: string) => {
    setBusy(true);
    try { await adminReleaseNumber(id, e164); toast(`${e164} released`); setConfirmNum(null); load(); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not release number"); }
    finally { setBusy(false); }
  };

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <div style={{ marginBottom: 22 }}>
      <p style={{ color: A.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: "100%", maxWidth: 520, height: "100%", background: A.panel, borderLeft: `1px solid ${A.line}`, overflowY: "auto", fontFamily: font.sans }}>
        <div style={{ position: "sticky", top: 0, background: A.panel, borderBottom: `1px solid ${A.line}`, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: A.text, fontSize: 17, fontWeight: 800 }}>Customer detail</p>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: A.panelAlt, border: `1px solid ${A.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={A.muted} /></button>
        </div>
        <div style={{ padding: 22 }}>
          {!d ? <p style={{ color: A.muted }}>Loading…</p> : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: A.panelAlt, display: "flex", alignItems: "center", justifyContent: "center", color: A.text, fontWeight: 800, fontSize: 20 }}>{d.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: A.text, fontSize: 18, fontWeight: 800 }}>{d.name}</p>
                  <p style={{ color: A.muted, fontSize: 13 }}>{d.email}</p>
                </div>
                <Badge tone={d.status === "active" ? "green" : "red"}>{d.status}</Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
                <Card><p style={{ color: A.muted, fontSize: 12 }}>Wallet balance</p><p style={{ color: A.green, fontSize: 22, fontWeight: 800, marginTop: 6 }}>{money(d.wallet.balance)}</p></Card>
                <Card><p style={{ color: A.muted, fontSize: 12 }}>Joined</p><p style={{ color: A.text, fontSize: 16, fontWeight: 700, marginTop: 8 }}>{d.joined}</p></Card>
              </div>

              <Section title="Plan">
                {d.subscription ? (
                  <Card>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ color: A.text, fontWeight: 700, textTransform: "capitalize" }}>{d.subscription.tier} · {d.subscription.cycle}</p>
                      <Badge tone={d.subscription.status === "active" ? "green" : d.subscription.status === "paused" ? "amber" : "red"}>{d.subscription.status}</Badge>
                    </div>
                    <p style={{ color: A.muted, fontSize: 12.5, marginTop: 8 }}>Minutes {d.subscription.minutesUsed}/{d.subscription.minutesIncluded} · SMS {d.subscription.smsUsed}/{d.subscription.smsIncluded}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      {d.subscription.status === "paused"
                        ? <Button size="sm" onClick={() => subAction("resume")}>{busy ? "…" : "Resume"}</Button>
                        : d.subscription.status === "active" && <Button size="sm" variant="ghost" onClick={() => subAction("pause")}>{busy ? "…" : "Pause"}</Button>}
                      <Button size="sm" variant="danger" onClick={() => subAction("cancel")}>{busy ? "…" : "Cancel plan"}</Button>
                    </div>
                  </Card>
                ) : <p style={{ color: A.muted, fontSize: 13 }}>No active plan (free).</p>}
              </Section>

              <Section title={`Numbers (${d.numbers.length})`}>
                {d.numbers.length === 0 ? <p style={{ color: A.muted, fontSize: 13 }}>No numbers.</p> : d.numbers.map((n) => (
                  <div key={n.id} style={{ padding: "9px 0", borderBottom: `1px solid ${A.lineSoft}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ color: A.text, fontFamily: "monospace", fontSize: 13 }}>{n.e164}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: A.muted, fontSize: 12.5, textTransform: "capitalize" }}>{n.kind}</span>
                        {confirmNum !== n.e164 && <Button size="sm" variant="danger" onClick={() => setConfirmNum(n.e164)}>Release</Button>}
                      </div>
                    </div>
                    {confirmNum === n.e164 && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                        <p style={{ color: A.muted, fontSize: 12, marginBottom: 8 }}>Release {n.e164}? Frees it on Telnyx & stops the rental — cannot be undone.</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmNum(null)}>Keep</Button>
                          <Button size="sm" variant="danger" onClick={() => releaseNum(n.e164)}>{busy ? "…" : "Release"}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </Section>

              <Section title="Wallet ledger">
                {d.wallet.txns.length === 0 ? <p style={{ color: A.muted, fontSize: 13 }}>No transactions.</p> : d.wallet.txns.slice(0, 20).map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${A.lineSoft}` }}>
                    <div><p style={{ color: A.text, fontSize: 13 }}>{t.label}</p><p style={{ color: A.faint, fontSize: 11 }}>{t.time}</p></div>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: t.amount < 0 ? A.text : A.green }}>{money(t.amount)}</span>
                  </div>
                ))}
              </Section>

              <Section title="Recent activity">
                {d.activity.length === 0 ? <p style={{ color: A.muted, fontSize: 13 }}>No activity.</p> : d.activity.slice(0, 20).map((a) => (
                  <div key={a.id} style={{ padding: "9px 0", borderBottom: `1px solid ${A.lineSoft}` }}>
                    <p style={{ color: A.text, fontSize: 13 }}>{a.title}</p>
                    {a.body && <p style={{ color: A.muted, fontSize: 12, marginTop: 2 }}>{a.body}</p>}
                    <p style={{ color: A.faint, fontSize: 11, marginTop: 2 }}>{a.time}</p>
                  </div>
                ))}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
