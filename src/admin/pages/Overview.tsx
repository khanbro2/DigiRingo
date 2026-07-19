import { useEffect, useState } from "react";
import { Users, Phone, DollarSign, MessageSquare, PhoneCall, Wallet } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { A, Card, StatCard, Badge, Table, Td, PageHeader, money } from "../ui";
import { telnyx } from "../../app/services/telnyx";
import { adminGetKpis, adminListTransactions, type AdminKpis, type AdminTxnRow } from "../api";

export function Overview() {
  const [balance, setBalance] = useState<string>("…");
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [txns, setTxns] = useState<AdminTxnRow[]>([]);

  useEffect(() => {
    telnyx.getBalance().then((b) => setBalance(`$${b.balance}`)).catch(() => setBalance("—"));
    adminGetKpis().then(setKpis).catch(() => {});
    adminListTransactions().then((r) => setTxns(r.txns.slice(0, 6))).catch(() => {});
  }, []);

  const messages = kpis?.messages7d ?? [];
  const revenue = kpis?.revenue6m ?? [];

  return (
    <div>
      <PageHeader title="Overview" subtitle="Platform health at a glance — live data" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Total users" value={kpis ? kpis.totalUsers.toLocaleString() : "…"} accent={A.blue} icon={<Users size={20} color={A.blue} />} />
        <StatCard label="Active numbers" value={kpis ? kpis.activeNumbers.toLocaleString() : "…"} accent={A.purple} icon={<Phone size={20} color={A.purple} />} />
        <StatCard label="MRR" value={kpis ? money(kpis.mrr) : "…"} accent={A.green} icon={<DollarSign size={20} color={A.green} />} />
        <StatCard label="SMS (7d)" value={kpis ? kpis.smsSent7d.toLocaleString() : "…"} accent={A.amber} icon={<MessageSquare size={20} color={A.amber} />} />
        <StatCard label="Customer wallets" value={kpis ? money(kpis.walletTotal) : "…"} accent={A.blue} icon={<Wallet size={20} color={A.blue} />} />
        <StatCard label="Telnyx balance" value={balance} accent={A.green} icon={<PhoneCall size={20} color={A.green} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 18 }}>
        <Card>
          <p style={{ color: A.text, fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Messages — last 7 days</p>
          {messages.length === 0 ? (
            <div style={{ height: 240, display: "grid", placeItems: "center", color: A.muted, fontSize: 13 }}>No messages in the last 7 days yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={messages} margin={{ left: -18, right: 6 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={A.blue} stopOpacity={0.5} /><stop offset="100%" stopColor={A.blue} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={A.lineSoft} vertical={false} />
                <XAxis dataKey="d" stroke={A.faint} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={A.faint} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 10, color: A.text, fontSize: 12 }} />
                <Area type="monotone" dataKey="sms" stroke={A.blue} fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <p style={{ color: A.text, fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Revenue (top-ups) — 6 months</p>
          {revenue.length === 0 ? (
            <div style={{ height: 240, display: "grid", placeItems: "center", color: A.muted, fontSize: 13 }}>No top-ups recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenue} margin={{ left: -10, right: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={A.lineSoft} vertical={false} />
                <XAxis dataKey="m" stroke={A.faint} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={A.faint} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 10, color: A.text, fontSize: 12 }} formatter={(v: number) => money(v)} />
                <Bar dataKey="rev" fill={A.green} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card pad={0}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${A.line}` }}>
          <p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>Recent transactions</p>
        </div>
        <Table head={["ID", "User", "Description", "Amount", "Type"]}>
          {txns.length === 0 ? (
            <tr><td colSpan={5} style={{ color: A.muted, textAlign: "center", padding: "28px 0", fontSize: 13.5 }}>No transactions yet.</td></tr>
          ) : txns.map((t) => (
            <tr key={t.id}>
              <Td style={{ fontFamily: "monospace", color: A.muted }}>{t.id}</Td>
              <Td>{t.user}</Td>
              <Td style={{ color: A.muted }}>{t.label}</Td>
              <Td style={{ fontWeight: 700, color: t.amount < 0 ? A.text : A.green }}>{money(t.amount)}</Td>
              <Td><Badge tone={t.kind === "topup" ? "green" : "muted"}>{t.kind === "topup" ? "top-up" : t.kind}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
