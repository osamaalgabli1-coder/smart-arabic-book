import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useAppState, clientBalance, cashboxBalance, formatCurrency } from "@/lib/store";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const state = useAppState((s) => s);
  const totalClients = state.clients.reduce((a, c) => a + clientBalance(state, c.id), 0);
  const totalCash = state.cashboxes.reduce((a, c) => a + cashboxBalance(state, c.id), 0);
  const totalTransfers = state.transfers.reduce((a, t) => a + t.amount, 0);
  const commissionProfit = state.transfers.reduce((a, t) => a + (t.outgoingFee || 0) + (t.incomingFee || 0), 0);

  return (
    <AppShell>
      <PageHeader title="التقارير" subtitle="ملخص شامل لجميع بيانات النظام" />
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Kpi k="إجمالي العملاء" v={String(state.clients.length)} />
        <Kpi k="إجمالي الصناديق" v={String(state.cashboxes.length)} />
        <Kpi k="إجمالي أرصدة العملاء" v={formatCurrency(totalClients)} />
        <Kpi k="إجمالي أرصدة الصناديق" v={formatCurrency(totalCash)} />
        <Kpi k="عدد الحوالات" v={String(state.transfers.length)} />
        <Kpi k="أرباح العمولات" v={formatCurrency(commissionProfit)} highlight />
        <Kpi k="عدد السندات" v={String(state.vouchers.length)} />
        <Kpi k="إجمالي مبالغ الحوالات" v={formatCurrency(totalTransfers)} />
      </div>
      <Section title="تقرير أرصدة العملاء">
        <Table headers={["العميل", "الهاتف", "الرصيد"]} rows={state.clients.map((c) => [c.name, c.phone ?? "—", formatCurrency(clientBalance(state, c.id))])} />
      </Section>
      <Section title="تقرير أرصدة الصناديق">
        <Table headers={["الصندوق", "النوع", "الرصيد"]} rows={state.cashboxes.map((c) => [c.name, c.type === "main" ? "رئيسي" : "فرعي", formatCurrency(cashboxBalance(state, c.id))])} />
      </Section>
      <Section title="تقرير الحوالات">
        <Table headers={["الرقم", "المرسل", "المستلم", "المبلغ", "التاريخ"]} rows={state.transfers.map((t) => [t.number, t.sender, t.receiver, formatCurrency(t.amount), t.date])} />
      </Section>
    </AppShell>
  );
}

function Kpi({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
      <div className="text-xs opacity-80">{k}</div>
      <div className="text-xl font-extrabold mt-1">{v}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="font-bold text-primary mb-2">{title}</h3>
      <div className="bg-card border border-border rounded-xl overflow-hidden">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right">
        <thead className="bg-muted text-muted-foreground"><tr>{headers.map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="p-6 text-center text-muted-foreground">لا توجد بيانات</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}