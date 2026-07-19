import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { A, Card, Badge, Button, Table, Td, PageHeader, money } from "../ui";
import { adminListTransactions, type AdminTxnRow } from "../api";

const KINDS = ["all", "topup", "charge"] as const;
type Kind = typeof KINDS[number];

export function TransactionsPage({ toast }: { toast: (m: string) => void }) {
  const [rows, setRows] = useState<AdminTxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Kind>("all");

  const load = useCallback(() => {
    setLoading(true);
    adminListTransactions().then((r) => setRows(r.txns)).catch((e) => toast(e instanceof Error ? e.message : "Could not load ledger")).finally(() => setLoading(false));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const shown = rows.filter((t) => filter === "all" || t.kind === filter);
  const net = shown.reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Live wallet ledger — all customers"
        action={<Button variant="ghost" onClick={load}><RefreshCw size={15} /> Refresh</Button>} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {KINDS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
            textTransform: "capitalize", border: `1px solid ${filter === f ? A.blue : A.line}`,
            background: filter === f ? "rgba(79,142,247,0.14)" : A.panel, color: filter === f ? A.blue : A.muted,
          }}>{f === "topup" ? "Top-ups" : f === "charge" ? "Charges" : "All"}</button>
        ))}
        <div style={{ marginLeft: "auto", alignSelf: "center", color: A.muted, fontSize: 13 }}>
          Net: <span style={{ color: net < 0 ? A.red : A.green, fontWeight: 800 }}>{money(net)}</span>
        </div>
      </div>

      <Card pad={0}>
        <Table head={["ID", "User", "Description", "Type", "Amount", "When"]}>
          {shown.length === 0 ? (
            <tr><td colSpan={6} style={{ color: A.muted, textAlign: "center", padding: "34px 0", fontSize: 13.5 }}>{loading ? "Loading…" : "No transactions."}</td></tr>
          ) : shown.map((t) => (
            <tr key={t.id}>
              <Td style={{ fontFamily: "monospace", color: A.muted }}>{t.id}</Td>
              <Td><p style={{ fontWeight: 600 }}>{t.user}</p><p style={{ color: A.muted, fontSize: 12 }}>{t.email}</p></Td>
              <Td style={{ color: A.muted }}>{t.label}</Td>
              <Td><Badge tone={t.kind === "topup" ? "green" : "muted"}>{t.kind === "topup" ? "top-up" : t.kind}</Badge></Td>
              <Td style={{ fontWeight: 700, color: t.amount < 0 ? A.text : A.green }}>{money(t.amount)}</Td>
              <Td style={{ color: A.muted }}>{t.time}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
