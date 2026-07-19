import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw } from "lucide-react";
import { A, Card, Badge, Button, Table, Td, PageHeader } from "../ui";
import { adminListNumbers, type AdminNumberRow } from "../api";

export function NumbersPage({ toast }: { toast: (m: string) => void }) {
  const [rows, setRows] = useState<AdminNumberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback((query: string) => {
    setLoading(true);
    adminListNumbers(query).then((r) => setRows(r.numbers)).catch((e) => toast(e instanceof Error ? e.message : "Could not load numbers")).finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(""); }, [load]);
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q, load]);

  return (
    <div>
      <PageHeader title="Numbers" subtitle={loading ? "Loading…" : `${rows.length} provisioned across all users (live from DB)`}
        action={<Button variant="ghost" onClick={() => load(q)}><RefreshCw size={15} /> Refresh</Button>} />
      <Card pad={0}>
        <div style={{ padding: 16, borderBottom: `1px solid ${A.line}`, position: "relative" }}>
          <Search size={15} color={A.muted} style={{ position: "absolute", left: 30, top: 27 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search numbers, owners or email…"
            style={{ width: "100%", maxWidth: 340, padding: "10px 14px 10px 38px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 13.5, outline: "none" }} />
        </div>
        <Table head={["Number", "Owner", "Type", "Status", "Added"]}>
          {rows.length === 0 ? (
            <tr><td colSpan={5} style={{ color: A.muted, textAlign: "center", padding: "34px 0", fontSize: 13.5 }}>{loading ? "Loading…" : "No numbers found."}</td></tr>
          ) : rows.map((n) => (
            <tr key={n.id}>
              <Td style={{ fontFamily: "monospace", fontWeight: 700 }}>{n.number}</Td>
              <Td><p style={{ fontWeight: 600 }}>{n.owner}</p><p style={{ color: A.muted, fontSize: 12 }}>{n.email}</p></Td>
              <Td style={{ color: A.muted }}>{n.kind}</Td>
              <Td><Badge tone={n.status === "active" ? "green" : "amber"}>{n.status === "active" ? "active" : "past due"}</Badge></Td>
              <Td style={{ color: A.muted }}>{n.time}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
