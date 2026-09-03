import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useAppState, clientBalances, cashboxBalance, formatCurrency, formatBalanceDisplay, sumCashboxesByCurrency, sumClientsByCurrency, CURRENCIES, currencyLabels, currencySymbols } from "@/lib/store";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const state = useAppState((s) => s);
  const clientTotals = sumClientsByCurrency(state);
  const cashTotals = sumCashboxesByCurrency(state);
  const transferTotals: Record<"YER"|"SAR"|"USD", number> = { YER: 0, SAR: 0, USD: 0 };
  const commissionTotals: Record<"YER"|"SAR"|"USD", number> = { YER: 0, SAR: 0, USD: 0 };
  for (const t of state.transfers) {
    transferTotals[t.currency] += t.amount;
    commissionTotals[t.currency] += (t.outgoingFee || 0) + (t.incomingFee || 0);
  }

  return (
    <AppShell>
      <PageHeader title="التقارير" subtitle="مفصل حسب العملة: ريال يمني، ريال سعودي، دولار أمريكي" />
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Kpi k="عدد العملاء" v={String(state.clients.length)} />
        <Kpi k="عدد الصناديق" v={String(state.cashboxes.length)} />
        <Kpi k="عدد السندات" v={String(state.vouchers.length)} />
        <Kpi k="عدد الحوالات" v={String(state.transfers.length)} />
      </div>

      {CURRENCIES.map((cur) => (
        <div key={cur} className="mb-6 border-2 border-border rounded-xl overflow-hidden bg-card">
          <div className="bg-primary/10 text-primary px-4 py-2 font-extrabold flex items-center justify-between">
            <span>{currencyLabels[cur]} ({currencySymbols[cur]})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
            <Kpi k="أرصدة العملاء" v={formatBalanceDisplay(clientTotals[cur], cur)} />
            <Kpi k="أرصدة الصناديق" v={formatCurrency(cashTotals[cur], cur)} />
            <Kpi k="مبالغ الحوالات" v={formatCurrency(transferTotals[cur], cur)} />
            <Kpi k="أرباح العمولات" v={formatCurrency(commissionTotals[cur], cur)} highlight />
          </div>
          <Section title="أرصدة العملاء">
            <Table headers={["السيد", "الهاتف", "الرصيد"]} rows={state.clients
              .map((c) => ({ c, bal: clientBalances(state, c.id)[cur] }))
              .filter(({ bal }) => bal !== 0)
              .map(({ c, bal }) => [c.name, c.phone ?? "—", formatBalanceDisplay(bal, cur)])} />
          </Section>
          <Section title="أرصدة الصناديق">
            <Table headers={["الصندوق", "النوع", "الرصيد"]} rows={state.cashboxes.filter((c) => c.currency === cur).map((c) => [c.name, c.type === "main" ? "رئيسي" : "فرعي", formatCurrency(cashboxBalance(state, c.id), cur)])} />
          </Section>
          <Section title="الحوالات">
            <Table headers={["الرقم", "المرسل", "المستلم", "المبلغ", "التاريخ"]} rows={state.transfers.filter((t) => t.currency === cur).map((t) => [t.number, t.sender, t.receiver, formatCurrency(t.amount, cur), t.date])} />
          </Section>
        </div>
      ))}
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
    <div className="px-3 pb-3">
      <h3 className="font-bold text-primary mb-2 text-sm">{title}</h3>
      <div className="bg-background border border-border rounded-xl overflow-hidden">{children}</div>
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