import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { setState, useAppState, uid, formatCurrency, voucherTypeLabels, currencyLabels, currencySymbols, CURRENCIES, type Voucher, type VoucherType, type Currency } from "@/lib/store";

export const Route = createFileRoute("/vouchers")({ component: VouchersPage });

const emptyForm = (): Voucher => ({
  id: "", date: new Date().toISOString().slice(0, 10),
  clientId: "", cashboxId: "main", toCashboxId: "",
  description: "", amount: 0, type: "receipt", currency: "YER",
});

function VouchersPage() {
  const state = useAppState((s) => s);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Voucher>(emptyForm());

  const needsClient = ["credit", "debit", "receipt", "payment", "adjustment"].includes(form.type);
  const needsCashbox = ["receipt", "payment", "transfer"].includes(form.type);
  const needsToCashbox = form.type === "transfer";

  const srcBox = state.cashboxes.find((c) => c.id === form.cashboxId);
  const dstBox = state.cashboxes.find((c) => c.id === form.toCashboxId);
  const isCrossCurrency = needsToCashbox && srcBox && dstBox && srcBox.currency !== dstBox.currency;
  // For non-transfer vouchers, the currency follows the cashbox if picked; else user selects.
  const effectiveCurrency: Currency = needsCashbox && srcBox ? srcBox.currency : form.currency;

  return (
    <AppShell>
      <PageHeader title="السندات والقيود" subtitle="سند بسيط: تاريخ، عميل، صندوق، بيان، مبلغ، نوع" actions={
        <Button onClick={() => { setForm(emptyForm()); setOpen(true); }}><Plus className="w-4 h-4 ml-1" /> سند جديد</Button>
      } />

      <div className="grid gap-2">
        {state.vouchers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">لا توجد سندات بعد</div>
        )}
        {[...state.vouchers].reverse().map((v) => {
          const client = state.clients.find((c) => c.id === v.clientId);
          const cash = state.cashboxes.find((c) => c.id === v.cashboxId);
          return (
            <div key={v.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-primary/15 text-primary text-xs px-2 py-0.5 rounded-full font-bold">{voucherTypeLabels[v.type]}</span>
                  <span className="text-xs text-muted-foreground">{v.date}</span>
                </div>
                <div className="text-sm mt-1 truncate">{v.description || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {client?.name && <>العميل: {client.name} · </>}
                  {cash?.name && <>الصندوق: {cash.name}</>}
                </div>
              </div>
              <div className="text-lg font-extrabold text-primary text-left">
                {formatCurrency(v.amount, v.currency)}
                {v.type === "transfer" && v.toAmount != null && v.toAmount !== v.amount && (
                  <div className="text-[10px] font-normal text-muted-foreground">← {formatCurrency(v.toAmount, state.cashboxes.find((c) => c.id === v.toCashboxId)?.currency ?? v.currency)}</div>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => {
                if (!confirm("حذف السند؟")) return;
                setState((s) => ({ ...s, vouchers: s.vouchers.filter((x) => x.id !== v.id) }));
              }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>سند جديد</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>نوع العملية</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as VoucherType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(voucherTypeLabels) as VoucherType[]).map((k) =>
                    <SelectItem key={k} value={k}>{voucherTypeLabels[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>التاريخ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            {needsClient && (
              <div className="grid gap-1.5"><Label>العميل</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                  <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {needsCashbox && (
              <div className="grid gap-1.5"><Label>{needsToCashbox ? "من صندوق" : "الصندوق"}</Label>
                <Select value={form.cashboxId} onValueChange={(v) => setForm({ ...form, cashboxId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{state.cashboxes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {currencySymbols[c.currency]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {needsToCashbox && (
              <div className="grid gap-1.5"><Label>إلى صندوق</Label>
                <Select value={form.toCashboxId} onValueChange={(v) => setForm({ ...form, toCashboxId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{state.cashboxes.filter((c) => c.id !== form.cashboxId).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {currencySymbols[c.currency]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {!needsCashbox && (
              <div className="grid gap-1.5"><Label>العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{currencyLabels[c]} ({currencySymbols[c]})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>المبلغ {needsCashbox && srcBox ? `(${currencySymbols[srcBox.currency]})` : `(${currencySymbols[effectiveCurrency]})`}</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
            </div>
            {isCrossCurrency && srcBox && dstBox && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-accent/30 rounded-lg border border-border">
                <div className="grid gap-1.5"><Label className="text-xs">سعر الصرف</Label>
                  <Input type="number" step="0.0001" value={form.exchangeRate ?? ""} placeholder={`1 ${currencySymbols[srcBox.currency]} = ? ${currencySymbols[dstBox.currency]}`}
                    onChange={(e) => {
                      const rate = Number(e.target.value) || 0;
                      setForm({ ...form, exchangeRate: rate, toAmount: rate > 0 ? Number((form.amount * rate).toFixed(2)) : form.toAmount });
                    }} />
                </div>
                <div className="grid gap-1.5"><Label className="text-xs">المبلغ المستلم ({currencySymbols[dstBox.currency]})</Label>
                  <Input type="number" value={form.toAmount ?? ""} onChange={(e) => setForm({ ...form, toAmount: Number(e.target.value) || 0 })} />
                </div>
                <div className="col-span-2 text-[11px] text-muted-foreground">تحويل من عملة إلى أخرى — أدخل سعر الصرف أو المبلغ المستلم يدوياً.</div>
              </div>
            )}
            <div className="grid gap-1.5"><Label>البيان</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button onClick={() => {
              if (form.amount <= 0) return;
              const finalCurrency: Currency = needsCashbox && srcBox ? srcBox.currency : form.currency;
              const finalToAmount = form.type === "transfer" && isCrossCurrency ? (form.toAmount || form.amount) : (form.type === "transfer" ? form.amount : undefined);
              setState((s) => ({ ...s, vouchers: [...s.vouchers, { ...form, id: uid(), currency: finalCurrency, toAmount: finalToAmount }] }));
              setOpen(false);
            }}>حفظ السند</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}