import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { A, Card, Badge, Button, Table, Td, PageHeader, money } from "../ui";
import { PLANS } from "../mock";
import { telnyx } from "../../app/services/telnyx";
import { adminGetKpis, adminGetBilling, type AdminInvoice } from "../api";

export function BillingPage({ toast }: { toast: (m: string) => void }) {
  const [balance, setBalance] = useState("…");
  const [credit, setCredit] = useState("…");
  const [mrr, setMrr] = useState("…");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  useEffect(() => {
    telnyx.getBalance().then((b) => { setBalance(`$${b.balance}`); setCredit(`$${b.available_credit}`); }).catch(() => { setBalance("—"); setCredit("—"); });
    adminGetKpis().then((k) => setMrr(money(k.mrr))).catch(() => setMrr("—"));
    adminGetBilling().then((b) => { setCounts(b.planCounts); setInvoices(b.invoices); }).catch(() => {});
  }, []);
  const tone = (s: string) => s === "active" ? "green" : s === "past_due" ? "red" : "muted";

  return (
    <div>
      <PageHeader title="Billing" subtitle="Plans, revenue and Telnyx account funding" />

      {/* Money summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        <Card><p style={{ color: A.muted, fontSize: 12.5 }}>Monthly recurring revenue</p><p style={{ color: A.text, fontSize: 26, fontWeight: 800, marginTop: 8 }}>{mrr}</p></Card>
        <Card><p style={{ color: A.muted, fontSize: 12.5 }}>Telnyx balance</p><p style={{ color: A.green, fontSize: 26, fontWeight: 800, marginTop: 8 }}>{balance}</p></Card>
        <Card><p style={{ color: A.muted, fontSize: 12.5 }}>Available credit</p><p style={{ color: A.text, fontSize: 26, fontWeight: 800, marginTop: 8 }}>{credit}</p></Card>
        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Button onClick={() => toast("Opening Telnyx funding…")}>Add Telnyx funds</Button>
        </Card>
      </div>

      {/* Plans */}
      <p style={{ color: A.text, fontSize: 16, fontWeight: 700, margin: "4px 0 12px" }}>Plans</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 22 }}>
        {PLANS.map((p) => (
          <Card key={p.name} style={p.name === "Pro" ? { border: `1px solid ${A.blue}` } : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: A.text, fontSize: 16, fontWeight: 800 }}>{p.name}</p>
              {p.name === "Pro" && <Badge tone="blue">Popular</Badge>}
            </div>
            <p style={{ color: A.text, fontSize: 28, fontWeight: 800, marginTop: 10 }}>${p.price}<span style={{ color: A.muted, fontSize: 13, fontWeight: 500 }}>/mo</span></p>
            <p style={{ color: A.muted, fontSize: 12.5, marginTop: 4 }}>{counts[p.name.toLowerCase()] || 0} active subscribers</p>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {p.features.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={15} color={A.green} /><span style={{ color: A.muted, fontSize: 13 }}>{f}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Invoices */}
      <Card pad={0}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${A.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>Recent plan activations</p>
        </div>
        <Table head={["Ref", "User", "Plan", "Amount", "Status"]}>
          {invoices.length === 0 ? (
            <tr><td colSpan={5} style={{ color: A.muted, textAlign: "center", padding: "28px 0", fontSize: 13.5 }}>No plan activations yet.</td></tr>
          ) : invoices.map((iv) => (
            <tr key={iv.id}>
              <Td style={{ fontFamily: "monospace", color: A.muted }}>{iv.id}</Td>
              <Td><p style={{ fontWeight: 600 }}>{iv.user}</p><p style={{ color: A.muted, fontSize: 12 }}>{iv.email}</p></Td>
              <Td style={{ color: A.muted }}>{iv.period}</Td>
              <Td style={{ fontWeight: 700 }}>{money(iv.amount)}</Td>
              <Td><Badge tone={tone(iv.status)}>{iv.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
