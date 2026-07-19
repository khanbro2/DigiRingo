import { useState } from "react";
import { KeyRound, Webhook, Plus, Copy, Trash2 } from "lucide-react";
import { A, Card, Badge, Button, Table, Td, PageHeader, Modal, Input, SecretField } from "../ui";
import { useAdmin } from "../store";

export function IntegrationsPage({ toast }: { toast: (m: string) => void }) {
  const { credentials, webhooks, platformKeys, saveCredential, toggleWebhook, addWebhook, createKey, revokeKey } = useAdmin();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [keyVal, setKeyVal] = useState("");
  const [newKeyName, setNewKeyName] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [whModal, setWhModal] = useState(false);
  const [whLabel, setWhLabel] = useState(""); const [whUrl, setWhUrl] = useState("");

  const saveKey = () => {
    if (!editKey || !keyVal.trim()) { toast("Enter the key"); return; }
    saveCredential(editKey, keyVal.trim()); toast("Credential saved"); setEditKey(null); setKeyVal("");
  };

  return (
    <div>
      <PageHeader title="Integrations" subtitle="API credentials, platform keys & webhooks" />

      {/* Service API credentials */}
      <Card pad={0} style={{ marginBottom: 18 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${A.line}`, display: "flex", alignItems: "center", gap: 10 }}>
          <KeyRound size={18} color={A.blue} /><p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>Service API keys</p>
        </div>
        <Table head={["Service", "Key", "Status", "Source"]}>
          {credentials.map((c) => (
            <tr key={c.id}>
              <Td><p style={{ fontWeight: 700 }}>{c.service}</p><p style={{ color: A.muted, fontSize: 12 }}>{c.blurb}</p></Td>
              <Td><SecretField status={c.status} last4={c.last4} onReplace={() => { setEditKey(c.id); setKeyVal(""); }} /></Td>
              <Td><Badge tone={c.status === "set" ? "green" : "amber"}>{c.status === "set" ? "Configured" : "Missing"}</Badge></Td>
              <Td style={{ color: A.muted }}>{c.source === "dashboard" ? "Dashboard" : c.source === "env" ? "Server env" : "—"}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Platform API keys */}
      <Card pad={0} style={{ marginBottom: 18 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${A.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>Your platform API keys</p>
          <Button size="sm" onClick={() => { setNewKeyName(""); setKeyName(""); }}><Plus size={14} /> New key</Button>
        </div>
        <Table head={["Name", "Key", "Created", "Last used", ""]}>
          {platformKeys.map((k) => (
            <tr key={k.id}>
              <Td style={{ fontWeight: 700 }}>{k.name}</Td>
              <Td style={{ fontFamily: "monospace", color: A.muted }}>{k.masked}</Td>
              <Td style={{ color: A.muted }}>{k.created}</Td>
              <Td style={{ color: A.muted }}>{k.lastUsed}</Td>
              <Td>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" variant="ghost" onClick={() => toast("Key copied")}><Copy size={13} /></Button>
                  <Button size="sm" variant="danger" onClick={() => { revokeKey(k.id); toast("Key revoked"); }}><Trash2 size={13} /></Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Webhooks */}
      <Card pad={0}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${A.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Webhook size={18} color={A.purple} /><p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>Webhooks</p></div>
          <Button size="sm" variant="ghost" onClick={() => { setWhModal(true); setWhLabel(""); setWhUrl(""); }}><Plus size={14} /> Add endpoint</Button>
        </div>
        <Table head={["Endpoint", "URL", "Secret", "Status"]}>
          {webhooks.map((w) => (
            <tr key={w.id}>
              <Td style={{ fontWeight: 600 }}>{w.label}</Td>
              <Td style={{ fontFamily: "monospace", color: A.muted }}>{w.url}</Td>
              <Td>{w.secretSet ? <Badge tone="green">Signed</Badge> : <Badge tone="muted">None</Badge>}</Td>
              <Td>
                <button onClick={() => toggleWebhook(w.id)} style={{ width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: w.enabled ? A.green : "rgba(255,255,255,0.12)" }}>
                  <span style={{ position: "absolute", top: 3, left: w.enabled ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Replace service key modal */}
      {editKey && (
        <Modal title={`Update ${credentials.find((c) => c.id === editKey)?.service} key`} onClose={() => setEditKey(null)}>
          <Input label="API key / secret" value={keyVal} onChange={setKeyVal} placeholder="Paste the secret key" type="password" mono />
          <div style={{ display: "flex", gap: 10 }}><Button onClick={saveKey}>Save</Button><Button variant="ghost" onClick={() => setEditKey(null)}>Cancel</Button></div>
        </Modal>
      )}

      {/* New platform key modal */}
      {newKeyName !== null && (
        <Modal title="Create platform API key" onClose={() => setNewKeyName(null)}>
          <Input label="Key name" value={keyName} onChange={setKeyName} placeholder="e.g. Zapier integration" />
          <div style={{ display: "flex", gap: 10 }}><Button onClick={async () => { if (!keyName.trim()) { toast("Name required"); return; } try { const full = await createKey(keyName.trim()); setNewKeyName(null); setCreatedKey(full); } catch (e) { toast(e instanceof Error ? e.message : "Could not create"); } }}>Create</Button><Button variant="ghost" onClick={() => setNewKeyName(null)}>Cancel</Button></div>
        </Modal>
      )}

      {/* Show the full key ONCE after creation — it's never retrievable again. */}
      {createdKey && (
        <Modal title="API key created" onClose={() => setCreatedKey(null)}>
          <p style={{ color: A.muted, fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>Copy this key now — for security it will never be shown again.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <code style={{ flex: 1, fontFamily: "monospace", fontSize: 13, color: A.text, background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 10, padding: "11px 13px", wordBreak: "break-all" }}>{createdKey}</code>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(createdKey).then(() => toast("Copied")).catch(() => {}); }}>Copy</Button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={() => setCreatedKey(null)}>Done</Button></div>
        </Modal>
      )}

      {/* Add webhook modal */}
      {whModal && (
        <Modal title="Add webhook endpoint" onClose={() => setWhModal(false)}>
          <Input label="Label" value={whLabel} onChange={setWhLabel} placeholder="e.g. Slack alerts" />
          <Input label="URL" value={whUrl} onChange={setWhUrl} placeholder="https://…" mono />
          <div style={{ display: "flex", gap: 10 }}><Button onClick={() => { if (!whUrl.trim()) { toast("URL required"); return; } addWebhook(whLabel.trim() || "Webhook", whUrl.trim()); toast("Webhook added"); setWhModal(false); }}>Add</Button><Button variant="ghost" onClick={() => setWhModal(false)}>Cancel</Button></div>
        </Modal>
      )}
    </div>
  );
}
