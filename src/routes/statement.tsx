import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState, formatCurrency, voucherTypeLabels } from "@/lib/store";

export const Route = createFileRoute("/statement")({ component: StatementPage });

function StatementPage() {
  const state = useAppState((s) => s);
  const [clientId, setClientId] = useState<string>(state.clients[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const client = state.clients.find((c) => c.id === clientId);

  const data = useMemo(() => {
    if (!client) return null;
    const rows = state.vouchers
      .filter((v) => v.clientId === client.id)
      .filter((v) => (from ? v.date >= from : true) && (to ? v.date <= to : true))
      .sort((a, b) => a.date.localeCompare(b.date));
    let running = client.openingBalance;
    let totalCredit = 0, totalDebit = 0, totalReceipt = 0, totalPayment = 0;
    const enriched = rows.map((v) => {
      let debit = 0, credit = 0;
      if (v.type === "credit") { credit = v.amount; totalCredit += v.amount; }
      if (v.type === "debit") { debit = v.amount; totalDebit += v.amount; }
      if (v.type === "receipt") { debit = v.amount; totalReceipt += v.amount; }
      if (v.type === "payment") { credit = v.amount; totalPayment += v.amount; }
      if (v.type === "adjustment") { credit = v.amount; }
      running += credit - debit;
      return { v, debit, credit, balance: running };
    });
    return { rows: enriched, opening: client.openingBalance, closing: running, totalCredit, totalDebit, totalReceipt, totalPayment };
  }, [client, state.vouchers, from, to]);

  return (
    <AppShell>
      <PageHeader title="كشف الحساب" subtitle="كشف حساب احترافي لكل عميل" />
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="grid gap-1.5">
          <Label>العميل</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
            <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5"><Label>من تاريخ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label>إلى تاريخ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {!client && <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">اختر عميلاً لعرض الكشف</div>}

      {client && data && (
        <div className="bg-card border-2 border-border rounded-xl overflow-hidden">
          <div className="bg-header text-header-foreground p-4">
            <div className="text-lg font-extrabold">{state.company.name}</div>
            <div className="text-xs opacity-80">{state.company.phone} {state.company.address ? " · " + state.company.address : ""}</div>
            <div className="mt-2 text-sm">كشف حساب: <b>{client.name}</b> {client.phone ? " · " + client.phone : ""}</div>
            {(from || to) && <div className="text-xs opacity-80">الفترة: {from || "—"} إلى {to || "—"}</div>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted text-muted-foreground">
                <tr><th className="p-2">التاريخ</th><th className="p-2">البيان</th><th className="p-2">النوع</th><th className="p-2">مدين</th><th className="p-2">دائن</th><th className="p-2">الرصيد</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-border bg-accent/30"><td className="p-2" colSpan={5}>الرصيد الافتتاحي</td><td className="p-2 font-bold">{formatCurrency(data.opening)}</td></tr>
                {data.rows.map(({ v, debit, credit, balance }) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="p-2">{v.date}</td>
                    <td className="p-2">{v.description}</td>
                    <td className="p-2 text-xs">{voucherTypeLabels[v.type]}</td>
                    <td className="p-2 text-destructive">{debit ? formatCurrency(debit) : "—"}</td>
                    <td className="p-2 text-success">{credit ? formatCurrency(credit) : "—"}</td>
                    <td className="p-2 font-semibold">{formatCurrency(balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-muted/30 border-t border-border text-center text-xs">
            <Cell k="إجمالي له" v={formatCurrency(data.totalCredit)} />
            <Cell k="إجمالي عليه" v={formatCurrency(data.totalDebit)} />
            <Cell k="إجمالي القبض" v={formatCurrency(data.totalReceipt)} />
            <Cell k="إجمالي الصرف" v={formatCurrency(data.totalPayment)} />
            <Cell k="الرصيد النهائي" v={formatCurrency(data.closing)} highlight />
          </div>
          <div className="p-3 flex gap-2 justify-end border-t border-border">
            <button onClick={() => window.print()} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold">طباعة / PDF</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Cell({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className={`p-2 rounded-lg ${highlight ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className="opacity-80">{k}</div>
      <div className="font-extrabold text-sm mt-0.5">{v}</div>
    </div>
  );
}