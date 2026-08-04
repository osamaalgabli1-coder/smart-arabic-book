import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown, Users, FileText, Download, Share2, MessageCircle, TrendingUp, TrendingDown, User, LayoutList } from "lucide-react";
import { toast } from "sonner";
import { useAppState, getState, clientBalance, formatCurrency, clientLedger, formatNumber, formatBalanceNumber, currencyLabels, currencySymbols, CURRENCIES, type Currency } from "@/lib/store";
import { openStatementPDF, openStatementPDFFile, downloadStatementHTML, downloadStatementPDF, sendClientStatementToWhatsapp, downloadAggregateStatementPDF } from "@/lib/statement-pdf";
import { sendWhatsapp, buildBalanceMessage } from "@/lib/whatsapp";

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
      <PageHeader title="إدارة الحسابات" subtitle="كشف تفصيلي · تصدير PDF · مشاركة واتساب" />
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
            toast.info("جاري فتح الملف…");
            await openStatementPDFFile([client.id], { from, to, title: `كشف حساب — ${client.name}` });
          }}
        >
          <FileText className="w-4 h-4 ml-1" /> فتح الكشف في تطبيق PDF
        </Button>
      </div>

      {!client && <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">اختر عميلاً لعرض الكشف</div>}

      <section className="mb-5 border-2 border-border rounded-xl p-3">
        <h3 className="font-bold text-primary mb-2 text-sm">تصدير البيانات</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <MiniBtn icon={<User className="w-4 h-4" />} label="كشف تفصيلي — هذا العميل" onClick={() => {
            if (!client) { toast.error("اختر عميلاً"); return; }
            openStatementPDF([client.id], { from, to, title: `كشف حساب — ${client.name}` });
          }} />
          <MiniBtn icon={<Users className="w-4 h-4" />} label="كشف تفصيلي — كل العملاء" onClick={() => {
            if (!state.clients.length) { toast.error("لا يوجد عملاء"); return; }
            openStatementPDF(state.clients.map((c) => c.id), { from, to, title: "كشف حسابات كل العملاء" });
          }} />
          <MiniBtn icon={<Download className="w-4 h-4" />} label="تنزيل كشف هذا العميل" onClick={() => {
            if (!client) { toast.error("اختر عميلاً"); return; }
            downloadStatementHTML([client.id], { from, to, title: `كشف-حساب-${client.name}` });
            toast.success("تم التنزيل");
          }} />
          <MiniBtn icon={<FileDown className="w-4 h-4" />} label="كشف حساب عميل PDF" onClick={async () => {
            if (!client) { toast.error("اختر عميلاً"); return; }
            toast.info("جاري إنشاء PDF...");
            try { await downloadStatementPDF([client.id], { from, to, title: `كشف-حساب-${client.name}` }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <MiniBtn icon={<FileDown className="w-4 h-4" />} label="PDF — كل العملاء تفصيلي" onClick={async () => {
            if (!state.clients.length) { toast.error("لا يوجد عملاء"); return; }
            toast.info("جاري إنشاء PDF...");
            try { await downloadStatementPDF(state.clients.map((c) => c.id), { from, to, title: "كشف-تفصيلي-كل-العملاء" }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <MiniBtn icon={<LayoutList className="w-4 h-4" />} label="PDF — كل العملاء إجمالي" onClick={async () => {
            if (!state.clients.length) { toast.error("لا يوجد عملاء"); return; }
            toast.info("جاري إنشاء PDF...");
            try { await downloadAggregateStatementPDF({ title: "كشف-إجمالي-كل-العملاء" }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <MiniBtn icon={<TrendingUp className="w-4 h-4" />} label="PDF — العملاء دائن (له)" onClick={async () => {
            const s = getState();
            const ids = s.clients.filter((c) => clientBalance(s, c.id) > 0).map((c) => c.id);
            if (!ids.length) { toast.error("لا يوجد عملاء دائنون"); return; }
            toast.info("جاري إنشاء PDF...");
            try { await downloadStatementPDF(ids, { from, to, title: "كشف-العملاء-الدائنين-له" }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <MiniBtn icon={<TrendingDown className="w-4 h-4" />} label="PDF — العملاء مدين (عليه)" onClick={async () => {
            const s = getState();
            const ids = s.clients.filter((c) => clientBalance(s, c.id) < 0).map((c) => c.id);
            if (!ids.length) { toast.error("لا يوجد عملاء مدينون"); return; }
            toast.info("جاري إنشاء PDF...");
            try { await downloadStatementPDF(ids, { from, to, title: "كشف-العملاء-المدينين-عليه" }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <MiniBtn icon={<Share2 className="w-4 h-4" />} label="مشاركة عبر واتساب" onClick={() => {
            const s = getState();
            const text = `كشف عملاء ${s.company.name}\n\n` + s.clients.map((c) => `• ${c.name}: ${formatCurrency(clientBalance(s, c.id))}`).join("\n");
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
          }} />
          <MiniBtn icon={<MessageCircle className="w-4 h-4" />} label="إرسال كشف العميل PDF لواتساب" onClick={async () => {
            if (!client) { toast.error("اختر عميلاً"); return; }
            toast.info("جاري تجهيز الكشف...");
            try {
              const r = await sendClientStatementToWhatsapp(client.id, { from, to });
              if (r === "shared") { toast.success("تمت المشاركة"); return; }
              toast.success("تم تنزيل الكشف — أرفقه في المحادثة");
              sendWhatsapp(client.phone, buildBalanceMessage(client.id));
            } catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
        </div>
      </section>

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

function MiniBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="h-auto py-2 px-2 justify-start gap-2 text-[11px] leading-tight">
      <span className="text-primary shrink-0">{icon}</span>
      <span className="font-bold text-right flex-1">{label}</span>
    </Button>
  );
}
