import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState, formatCurrency, voucherTypeLabels, CURRENCIES, currencyLabels, type Currency } from "@/lib/store";

export const Route = createFileRoute("/statement")({ component: StatementPage });

function StatementPage() {
  const state = useAppState((s) => s);
  const [clientId, setClientId] = useState<string>(state.clients[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const client = state.clients.find((c) => c.id === clientId);

  const perCurrency = useMemo(() => {
    if (!client) return null;
    const all = state.vouchers
      .filter((v) => v.clientId === client.id)
      .filter((v) => (from ? v.date >= from : true) && (to ? v.date <= to : true))
      .sort((a, b) => a.date.localeCompare(b.date));
    const openingCur: Currency = client.openingCurrency ?? "YER";
    const out: Record<Currency, { rows: { v: typeof all[number]; debit: number; credit: number; balance: number }[]; opening: number; closing: number; totalCredit: number; totalDebit: number; totalReceipt: number; totalPayment: number }> = {
      YER: { rows: [], opening: 0, closing: 0, totalCredit: 0, totalDebit: 0, totalReceipt: 0, totalPayment: 0 },
      SAR: { rows: [], opening: 0, closing: 0, totalCredit: 0, totalDebit: 0, totalReceipt: 0, totalPayment: 0 },
      USD: { rows: [], opening: 0, closing: 0, totalCredit: 0, totalDebit: 0, totalReceipt: 0, totalPayment: 0 },
    };
    out[openingCur].opening = client.openingBalance || 0;
    for (const cur of CURRENCIES) out[cur].closing = out[cur].opening;
    for (const v of all) {
      const cur: Currency = v.currency ?? "YER";
      const bucket = out[cur];
      let debit = 0, credit = 0;
      if (v.type === "credit") { credit = v.amount; bucket.totalCredit += v.amount; }
      else if (v.type === "debit") { debit = v.amount; bucket.totalDebit += v.amount; }
      else if (v.type === "receipt") { debit = v.amount; bucket.totalReceipt += v.amount; }
      else if (v.type === "payment") { credit = v.amount; bucket.totalPayment += v.amount; }
      else if (v.type === "adjustment") { credit = v.amount; }
      bucket.closing += credit - debit;
      bucket.rows.push({ v, debit, credit, balance: bucket.closing });
    }
    return out;
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

      {client && perCurrency && (
        <div className="bg-card border-2 border-border rounded-xl overflow-hidden">
          <div className="bg-header text-header-foreground p-4 flex items-center gap-3">
            {state.company.logo && (
              <img src={state.company.logo} alt="شعار" className="w-14 h-14 rounded-lg bg-white object-contain p-1" />
            )}
            <div className="flex-1">
            <div className="text-lg font-extrabold">{state.company.name}</div>
            <div className="text-xs opacity-80">{state.company.phone} {state.company.address ? " · " + state.company.address : ""}</div>
            <div className="mt-2 text-sm">كشف حساب: <b>{client.name}</b> {client.phone ? " · " + client.phone : ""}</div>
            {(from || to) && <div className="text-xs opacity-80">الفترة: {from || "—"} إلى {to || "—"}</div>}
            </div>
          </div>
          {CURRENCIES.map((cur) => {
            const d = perCurrency[cur];
            if (d.rows.length === 0 && d.opening === 0) return null;
            return (
              <div key={cur} className="border-t border-border">
                <div className="bg-accent/40 px-4 py-2 font-bold text-sm text-primary">{currencyLabels[cur]}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-muted text-muted-foreground">
                      <tr><th className="p-2">التاريخ</th><th className="p-2">البيان</th><th className="p-2">النوع</th><th className="p-2">مدين</th><th className="p-2">دائن</th><th className="p-2">الرصيد</th></tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border bg-accent/20"><td className="p-2" colSpan={5}>الرصيد الافتتاحي</td><td className="p-2 font-bold">{formatCurrency(d.opening, cur)}</td></tr>
                      {d.rows.map(({ v, debit, credit, balance }) => (
                        <tr key={v.id} className="border-t border-border">
                          <td className="p-2">{v.date}</td>
                          <td className="p-2">{v.description}</td>
                          <td className="p-2 text-xs">{voucherTypeLabels[v.type]}</td>
                          <td className="p-2 text-destructive">{debit ? formatCurrency(debit, cur) : "—"}</td>
                          <td className="p-2 text-success">{credit ? formatCurrency(credit, cur) : "—"}</td>
                          <td className="p-2 font-semibold">{formatCurrency(balance, cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-muted/30 text-center text-xs">
                  <Cell k="إجمالي له" v={formatCurrency(d.totalCredit, cur)} />
                  <Cell k="إجمالي عليه" v={formatCurrency(d.totalDebit, cur)} />
                  <Cell k="إجمالي القبض" v={formatCurrency(d.totalReceipt, cur)} />
                  <Cell k="إجمالي الصرف" v={formatCurrency(d.totalPayment, cur)} />
                  <Cell k="الرصيد النهائي" v={formatCurrency(d.closing, cur)} highlight />
                </div>
              </div>
            );
          })}
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