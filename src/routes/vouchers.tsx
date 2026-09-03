import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DescriptionField } from "@/components/DescriptionField";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, MessageCircle } from "lucide-react";
import {
  setState, useAppState, uid, formatCurrency, voucherTypeLabels,
  currencyLabels, currencySymbols, CURRENCIES, nextVoucherNumber,
  type Voucher, type VoucherType, type Currency, getState, checkCreditLimit, formatCurrency as fc,
} from "@/lib/store";
import { buildVoucherMessage, sendWhatsapp, notifyClient } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/vouchers")({ component: VouchersPage });

const emptyForm = (): Voucher => ({
  id: "", number: "", date: new Date().toISOString().slice(0, 10),
  clientId: "", toClientId: "", cashboxId: "main", toCashboxId: "",
  description: "", amount: 0, commission: 0, commissionTo: 0, type: "receipt", currency: "YER",
});

function VouchersPage() {
  const state = useAppState((s) => s);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Voucher>(emptyForm());
  const isEdit = !!form.id;

  const needsClient = ["credit", "debit", "receipt", "payment", "adjustment", "compound"].includes(form.type);
  const needsToClient = form.type === "compound";
  const needsCashbox = ["receipt", "payment", "transfer"].includes(form.type);
  const needsToCashbox = form.type === "transfer";

  const srcBox = state.cashboxes.find((c) => c.id === form.cashboxId);
  const dstBox = state.cashboxes.find((c) => c.id === form.toCashboxId);
  const isCrossCurrency = needsToCashbox && srcBox && dstBox && srcBox.currency !== dstBox.currency;
  const effectiveCurrency: Currency = needsCashbox && srcBox ? srcBox.currency : form.currency;

  const openNew = () => { setForm({ ...emptyForm(), number: nextVoucherNumber(state) }); setOpen(true); };
  const openEdit = (v: Voucher) => { setForm({ ...v }); setOpen(true); };

  const save = () => {
    if (form.amount <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (needsClient && !form.clientId) { toast.error("اختر السيد"); return; }
    if (needsToClient && !form.toClientId) { toast.error("اختر السيد الثاني"); return; }
    const finalCurrency: Currency = needsCashbox && srcBox ? srcBox.currency : form.currency;
    const finalToAmount = form.type === "transfer" && isCrossCurrency ? (form.toAmount || form.amount) : (form.type === "transfer" ? form.amount : undefined);
    // سقف المديونية: المعاملات التي تزيد مديونية السيد تتوقف عند بلوغ السقف
    const debtorId = form.type === "compound" ? form.clientId : (["debit", "receipt"].includes(form.type) ? form.clientId : undefined);
    if (debtorId) {
      const added = form.amount + (form.type === "compound" ? (form.commission || 0) : 0);
      const prev = isEdit ? (state.vouchers.find((x) => x.id === form.id)?.amount || 0) : 0;
      const chk = checkCreditLimit(state, debtorId, finalCurrency, added - prev);
      if (chk.blocked) {
        toast.error(`تم إيقاف العملية: تجاوز سقف مديونية السيد (السقف ${fc(chk.limit, finalCurrency)} — بعد العملية ${fc(chk.after, finalCurrency)})`);
        return;
      }
    }
    const record: Voucher = { ...form, currency: finalCurrency, toAmount: finalToAmount };
    if (!isEdit) {
      record.id = uid();
      record.number = record.number || nextVoucherNumber(state);
      setState((s) => ({ ...s, vouchers: [...s.vouchers, record] }));
      toast.success(`تم حفظ السند #${record.number}`);
    } else {
      setState((s) => ({ ...s, vouchers: s.vouchers.map((x) => x.id === record.id ? record : x) }));
      toast.success(`تم تحديث السند #${record.number}`);
    }
    setOpen(false);
    // auto-send whatsapp
    if (needsClient) {
      const client = getState().clients.find((c) => c.id === record.clientId);
      notifyClient(client, buildVoucherMessage(record, "from"));
    }
    if (record.type === "compound") {
      const toClient = getState().clients.find((c) => c.id === record.toClientId);
      notifyClient(toClient, buildVoucherMessage(record, "to"));
    }
  };

  const remove = (id: string) => {
    if (!confirm("حذف السند؟")) return;
    setState((s) => ({ ...s, vouchers: s.vouchers.filter((x) => x.id !== id) }));
  };

  const sendWA = (v: Voucher, role: "from" | "to" = "from") => {
    const id = role === "to" ? v.toClientId : v.clientId;
    const client = state.clients.find((c) => c.id === id);
    if (!client?.phone) { toast.error("لا يوجد رقم واتساب"); return; }
    sendWhatsapp(client.phone, buildVoucherMessage(v, role));
  };

  const sortedTypes: VoucherType[] = useMemo(() => ["debit", "credit", "compound", "transfer", "adjustment"], []);

  return (
    <AppShell>
      <PageHeader title="السندات والقيود" subtitle="مدين · دائن · قيد بسيط · قبض/صرف · حوالات صناديق" actions={
        <Button onClick={openNew}><Plus className="w-4 h-4 ml-1" /> سند جديد</Button>
      } />

      <div className="grid gap-2">
        {state.vouchers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">لا توجد سندات بعد</div>
        )}
        {[...state.vouchers].reverse().map((v) => {
          const client = state.clients.find((c) => c.id === v.clientId);
          const toClient = state.clients.find((c) => c.id === v.toClientId);
          const cash = state.cashboxes.find((c) => c.id === v.cashboxId);
          return (
            <div key={v.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-primary/15 text-primary text-xs px-2 py-0.5 rounded-full font-bold">{voucherTypeLabels[v.type]}</span>
                  <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">#{v.number}</span>
                  <span className="text-xs text-muted-foreground">{v.date}</span>
                </div>
                <div className="text-sm mt-1 truncate">{v.description || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {client?.name && <>السيد: {client.name} </>}
                  {toClient?.name && <> ← {toClient.name} </>}
                  {cash?.name && <> · الصندوق: {cash.name}</>}
                </div>
              </div>
              <div className="text-lg font-extrabold text-primary text-left">
                {formatCurrency(v.amount, v.currency)}
                {v.type === "transfer" && v.toAmount != null && v.toAmount !== v.amount && (
                  <div className="text-[10px] font-normal text-muted-foreground">← {formatCurrency(v.toAmount, state.cashboxes.find((c) => c.id === v.toCashboxId)?.currency ?? v.currency)}</div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => sendWA(v, "from")} title={v.type === "compound" ? `واتساب — ${client?.name ?? "المدين"} (عليه)` : "إرسال واتساب"}>
                  <MessageCircle className="w-4 h-4 text-success" />
                </Button>
                {v.type === "compound" && (
                  <Button size="icon" variant="ghost" onClick={() => sendWA(v, "to")} title={`واتساب — ${toClient?.name ?? "الدائن"} (له)`}>
                    <MessageCircle className="w-4 h-4 text-primary" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => openEdit(v)} title="تعديل"><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(v.id)} title="حذف"><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEdit ? `تعديل السند #${form.number}` : `سند جديد #${form.number}`}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>نوع العملية</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as VoucherType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sortedTypes.map((k) => <SelectItem key={k} value={k}>{voucherTypeLabels[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>رقم السند</Label><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>التاريخ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            {needsClient && (
              <div className="grid gap-1.5"><Label>{needsToClient ? "من السيد (مدين)" : "السيد"}</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                  <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {needsToClient && (
              <div className="grid gap-1.5"><Label>إلى السيد (دائن)</Label>
                <Select value={form.toClientId} onValueChange={(v) => setForm({ ...form, toClientId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                  <SelectContent>{state.clients.filter((c) => c.id !== form.clientId).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
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
              <Input type="number" inputMode="decimal" placeholder="0" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
            </div>
            {form.type === "compound" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label className="text-xs">عمولة على المدين (عليه)</Label>
                  <Input type="number" inputMode="decimal" placeholder="0" value={form.commission || ""} onChange={(e) => setForm({ ...form, commission: Number(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-1.5"><Label className="text-xs">عمولة للدائن (له)</Label>
                  <Input type="number" inputMode="decimal" placeholder="0" value={form.commissionTo || ""} onChange={(e) => setForm({ ...form, commissionTo: Number(e.target.value) || 0 })} />
                </div>
              </div>
            )}
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
              </div>
            )}
            {form.type === "compound" && form.clientId && form.toClientId && (
              <div className="grid gap-2 p-3 bg-accent/30 rounded-lg border border-border text-xs">
                <div className="font-bold text-primary">البيان التلقائي للطرفين</div>
                <div>
                  <span className="font-bold">{state.clients.find(c => c.id === form.clientId)?.name} (عليه):</span>{" "}
                  عليكم إلى حساب {state.clients.find(c => c.id === form.toClientId)?.name}
                </div>
                <div>
                  <span className="font-bold">{state.clients.find(c => c.id === form.toClientId)?.name} (له):</span>{" "}
                  لكم من حساب {state.clients.find(c => c.id === form.clientId)?.name}
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>{form.type === "compound" ? "بيان إضافي (اختياري)" : "البيان"}</Label>
              <DescriptionField
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                placeholder={form.type === "compound" ? "ملاحظات إضافية تُضاف لبيان الطرفين" : "اكتب بيان السند…"}
              />
            </div>
            <Button onClick={save}>{isEdit ? "حفظ التعديلات" : "حفظ السند"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
