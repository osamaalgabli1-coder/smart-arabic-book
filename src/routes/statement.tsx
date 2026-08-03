import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown, Users, MessageCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAppState, clientLedger, formatNumber, formatBalanceNumber, currencyLabels, currencySymbols, CURRENCIES, type Currency } from "@/lib/store";
import { openStatementPDF, openStatementPDFFile, sendClientStatementToWhatsapp } from "@/lib/statement-pdf";

export const Route = createFileRoute("/statement")({ component: StatementPage });

function StatementPage() {
  const state = useAppState((s) => s);
  const [clientId, setClientId] = useState<string>(state.clients[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const client = state.clients.find((c) => c.id === clientId);

  const perCurrency = useMemo(() => {
    if (!client) return null;
    const ledger = clientLedger(state, client.id);
    const openingCur: Currency = client.openingCurrency ?? "YER";
    const out: Record<Currency, { rows: { e: (typeof ledger)[Currency][number]; balance: number }[]; opening: number; closing: number; totalDebit: number; totalCredit: number }> = {
      YER: { rows: [], opening: 0, closing: 0, totalDebit: 0, totalCredit: 0 },
      SAR: { rows: [], opening: 0, closing: 0, totalDebit: 0, totalCredit: 0 },
      USD: { rows: [], opening: 0, closing: 0, totalDebit: 0, totalCredit: 0 },
    };
    out[openingCur].opening = client.openingBalance || 0;
    for (const cur of CURRENCIES) out[cur].closing = out[cur].opening;
    for (const cur of CURRENCIES) {
      const list = ledger[cur].filter((e) => (from ? e.date >= from : true) && (to ? e.date <= to : true));
      for (const e of list) {
        out[cur].totalDebit += e.debit;
        out[cur].totalCredit += e.credit;
        out[cur].closing += e.credit - e.debit;
        out[cur].rows.push({ e, balance: out[cur].closing });
      }
    }
    return out;
  }, [client, state, from, to]);

  return (
    <AppShell>
      <PageHeader title="كشف الحساب التفصيلي" subtitle="جميع عمليات العميل: قبض، صرف، له، عليه، حوالات، قيد بسيط" />
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

      <div className="flex flex-wrap gap-2 mb-4">
        <Button disabled={!client} onClick={() => client && openStatementPDF([client.id], { from, to, title: `كشف حساب — ${client.name}` })}>
          <FileDown className="w-4 h-4 ml-1" /> تصدير PDF (هذا العميل)
        </Button>
        <Button variant="outline" onClick={() => openStatementPDF(state.clients.map((c) => c.id), { from, to, title: "كشف حسابات كل العملاء" })}>
          <Users className="w-4 h-4 ml-1" /> تصدير PDF لكل العملاء
        </Button>
        <Button
          variant="outline"
          disabled={!client}
          onClick={async () => {
            if (!client) return;
            toast.info("جاري تجهيز الكشف بجودة عالية…");
            try {
              const r = await sendClientStatementToWhatsapp(client.id, { from, to });
              if (r === "downloaded") {
                const phone = (client.phone || "").replace(/\D/g, "");
                if (phone) window.open(`https://wa.me/${phone.startsWith("967") ? phone : "967" + phone}`, "_blank");
                toast.success("تم تنزيل الملف — أرفقه في محادثة واتساب");
              }
            } catch {
              toast.error("تعذر إنشاء الملف");
            }
          }}
        >
          <MessageCircle className="w-4 h-4 ml-1" /> إرسال PDF لواتساب العميل
        </Button>
        <Button
          variant="outline"
          disabled={!client}
          onClick={async () => {
            if (!client) return;
            toast.info("جاري فتح الملف…");
            await openStatementPDFFile([client.id], { from, to, title: `كشف حساب — ${client.name}` });
          }}
        >
          <FileText className="w-4 h-4 ml-1" /> فتح الكشف في تطبيق PDF
        </Button>
      </div>

      {!client && <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">اختر عميلاً لعرض الكشف</div>}

      {client && perCurrency && (
        <div className="bg-card border-2 border-border rounded-xl overflow-hidden" style={{ fontFamily: '"Amiri","Tajawal","Cairo",Arial,sans-serif', letterSpacing: "0.03em", wordSpacing: "0.12em" }}>
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
            const finalLabel = d.closing >= 0 ? "لكم" : "عليكم";
            return (
              <div key={cur} className="border-t border-border">
                <div className="bg-accent/40 px-4 py-2 font-bold text-sm text-primary">{currencyLabels[cur]} ({currencySymbols[cur]})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-center">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="p-2">التاريخ</th>
                        <th className="p-2">رقم السند</th>
                        <th className="p-2 text-right">التفاصيل</th>
                        <th className="p-2">عليه</th>
                        <th className="p-2">له</th>
                        <th className="p-2">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border bg-accent/20">
                        <td className="p-2" colSpan={5}>الرصيد الافتتاحي</td>
                        <td className="p-2 font-bold">{formatBalanceNumber(d.opening)}</td>
                      </tr>
                      {d.rows.map(({ e, balance }) => (
                        <tr key={e.id} className="border-t border-border">
                          <td className="p-2 whitespace-nowrap">{e.date}</td>
                          <td className="p-2 text-xs">{e.number}</td>
                          <td className="p-2 text-right">{e.description}</td>
                          <td className="p-2 text-destructive font-semibold">{e.debit ? formatNumber(e.debit) : "—"}</td>
                          <td className="p-2 text-success font-semibold">{e.credit ? formatNumber(e.credit) : "—"}</td>
                          <td className="p-2 font-bold text-destructive">{formatBalanceNumber(balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/60 font-bold">
                        <td className="p-2 text-primary" colSpan={3}>إجمالي العمليات</td>
                        <td className="p-2 text-destructive">{formatNumber(d.totalDebit)}</td>
                        <td className="p-2 text-success">{formatNumber(d.totalCredit)}</td>
                        <td></td>
                      </tr>
                      <tr className="bg-destructive/15 font-extrabold">
                        <td className="p-2 text-primary" colSpan={3}>الرصيد الإجمالي — {finalLabel}</td>
                        <td className="p-2 text-destructive text-base" colSpan={3}>{formatNumber(Math.abs(d.closing))} {currencySymbols[cur]}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
          <div className="p-3 flex gap-2 justify-end border-t border-border">
            <Button onClick={() => client && openStatementPDF([client.id], { from, to, title: `كشف حساب — ${client.name}` })}>
              <FileDown className="w-4 h-4 ml-1" /> طباعة / PDF
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
