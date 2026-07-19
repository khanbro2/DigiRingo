import { useState, useEffect } from "react";
import { CreditCard, Landmark, ShieldCheck } from "lucide-react";
import { A, Card, Badge, Button, PageHeader, Modal, Input } from "../ui";
import { useAdmin, type PaymentProvider } from "../store";

const ICON: Record<string, typeof CreditCard> = { stripe: CreditCard, paypal: CreditCard, bank: Landmark };

export function PaymentsPage({ toast }: { toast: (m: string) => void }) {
  const { providers, general, saveProvider, toggleProvider, saveGeneral } = useAdmin();
  const [editing, setEditing] = useState<PaymentProvider | null>(null);
  const [secret, setSecret] = useState("");
  const [account, setAccount] = useState("");
  const [fee, setFee] = useState("0");
  useEffect(() => { setFee(String(general.platformFeePct ?? 0)); }, [general.platformFeePct]);

  const save = async () => {
    if (!editing) return;
    if (!secret.trim()) { toast("Enter the API/secret key"); return; }
    try {
      await saveProvider(editing.id, secret.trim(), account.trim() || undefined);
      toast(`${editing.name} connected`);
      setEditing(null); setSecret(""); setAccount("");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save"); }
  };

  return (
    <div>
      <PageHeader title="Payments" subtitle="Where money comes in — and where payouts go" />

      <div style={{ background: "rgba(79,142,247,0.08)", border: `1px solid rgba(79,142,247,0.25)`, borderRadius: 12, padding: 14, display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
        <ShieldCheck size={18} color={A.blue} />
        <p style={{ color: A.muted, fontSize: 12.5 }}>Secret keys are sent to your backend and stored encrypted. This dashboard only ever shows the last 4 characters.</p>
      </div>

      {/* Providers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 22 }}>
        {providers.map((p) => {
          const Icon = ICON[p.id];
          return (
            <Card key={p.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: A.panelAlt, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={20} color={A.text} /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: A.text, fontWeight: 700 }}>{p.name}</p>
                  <p style={{ color: A.muted, fontSize: 12 }}>{p.blurb}</p>
                </div>
                <Badge tone={p.connected ? "green" : "muted"}>{p.connected ? "Connected" : "Not connected"}</Badge>
              </div>
              {p.connected && (
                <div style={{ marginTop: 14, fontSize: 12.5, color: A.muted, display: "flex", flexDirection: "column", gap: 6 }}>
                  {p.secretLast4 && <div>Secret key: <span style={{ fontFamily: "monospace", color: A.text }}>•••• {p.secretLast4}</span></div>}
                  {p.account && <div>Destination: <span style={{ color: A.text }}>{p.account}</span></div>}
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setSecret(""); setAccount(p.account ?? ""); }}>{p.connected ? "Manage" : "Connect"}</Button>
                {p.connected && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: A.muted, fontSize: 12.5 }}>
                    {p.enabled ? "Enabled" : "Disabled"}
                    <button onClick={() => toggleProvider(p.id)} style={{ width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: p.enabled ? A.green : "rgba(255,255,255,0.12)" }}>
                      <span style={{ position: "absolute", top: 3, left: p.enabled ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                    </button>
                  </label>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Financial settings */}
      <Card>
        <p style={{ color: A.text, fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Payout & financial settings</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Setting label="Default currency" value={general.currency} options={["USD", "EUR", "GBP", "PKR"]} onChange={(v) => saveGeneral({ currency: v })} />
          <Setting label="Payout schedule" value={general.payoutSchedule} options={["Daily", "Weekly", "Monthly", "Manual"]} onChange={(v) => saveGeneral({ payoutSchedule: v })} />
          <div>
            <p style={{ color: A.muted, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Platform fee (%)</p>
            <input type="number" value={fee} onChange={(e) => setFee(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 14, outline: "none" }} />
          </div>
          <div>
            <p style={{ color: A.muted, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Payout destination</p>
            <div style={{ padding: "11px 14px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 13.5 }}>{general.payoutDestination}</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}><Button onClick={async () => { try { await saveGeneral({ platformFeePct: Number(fee) || 0 }); toast("Financial settings saved"); } catch (e) { toast(e instanceof Error ? e.message : "Could not save"); } }}>Save settings</Button></div>
      </Card>

      {editing && (
        <Modal title={`${editing.connected ? "Manage" : "Connect"} ${editing.name}`} onClose={() => setEditing(null)}>
          <Input label={`${editing.name} secret key`} value={secret} onChange={setSecret} placeholder={editing.id === "stripe" ? "sk_live_…" : editing.id === "paypal" ? "Client secret" : "Account / IBAN"} type="password" mono />
          <Input label="Payout destination (optional)" value={account} onChange={setAccount} placeholder="bank ••6789 / paypal@email.com" />
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Button onClick={save}>Save & connect</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Setting({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <p style={{ color: A.muted, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>{label}</p>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "11px 14px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 14, outline: "none" }}>
        {options.map((o) => <option key={o} value={o} style={{ background: A.panel }}>{o}</option>)}
      </select>
    </div>
  );
}
