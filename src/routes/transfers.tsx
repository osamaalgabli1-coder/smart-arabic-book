import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Send, Pencil, MessageCircle } from "lucide-react";
import { setState, useAppState, uid, formatCurrency, CURRENCIES, currencyLabels, currencySymbols, nextTransferNumber, getState, type Transfer, type Currency } from "@/lib/store";
import { buildTransferMessage, sendWhatsapp, maybeAutoSend } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/transfers")({ component: TransfersPage });

const empty = (): Transfer => ({
  id: "", number: "", clientId: "", sender: "", receiver: "", transferType: "صادرة",
  amount: 0, currency: "YER", outgoingFee: 0, incomingFee: 0,
  date: new Date().toISOString().slice(0, 10), status: "pending", description: "",
});

const statusLabels: Record<Transfer["status"], string> = { pending: "قيد التنفيذ", completed: "مكتملة", cancelled: "ملغاة" };

function TransfersPage() {
  const state = useAppState((s) => s);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Transfer>(empty());
  const isEdit = !!form.id;

  const openNew = () => { setForm({ ...empty(), number: nextTransferNumber(state) }); setOpen(true); };
  const openEdit = (t: Transfer) => { setForm({ ...t }); setOpen(true); };

  const save = () => {
    if (!form.sender || !form.receiver) { toast.error("أدخل المرسل والمستلم"); return; }
    if (form.amount <= 0) { toast.error("أدخل مبلغاً"); return; }
    const record: Transfer = { ...form };
    if (!isEdit) {
      record.id = uid();
      record.number = record.number || nextTransferNumber(state);
      setState((s) => ({ ...s, transfers: [...s.transfers, record] }));
      toast.success(`تم حفظ الحوالة #${record.number}`);
    } else {
      setState((s) => ({ ...s, transfers: s.transfers.map((x) => x.id === record.id ? record : x) }));
      toast.success(`تم تحديث الحوالة #${record.number}`);
    }
    setOpen(false);
    if (record.clientId) {
      const client = getState().clients.find((c) => c.id === record.clientId);
      if (client?.phone) maybeAutoSend(client.phone, buildTransferMessage(record));
    }
  };

  const sendWA = (t: Transfer) => {
    const client = state.clients.find((c) => c.id === t.clientId);
    if (!client?.phone) { toast.error("لا يوجد رقم واتساب للعميل"); return; }
    sendWhatsapp(client.phone, buildTransferMessage(t));
  };

  return (
    <AppShell>
      <PageHeader title="الحوالات" subtitle="حوالات صادرة/واردة مرتبطة بحساب العميل" actions={
        <Button onClick={openNew}><Plus className="w-4 h-4 ml-1" /> حوالة جديدة</Button>
      } />

      <div className="grid gap-3">
        {state.transfers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">لا توجد حوالات</div>
        )}
        {[...state.transfers].reverse().map((t) => {
          const client = state.clients.find((c) => c.id === t.clientId);
          return (
            <div key={t.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Send className="w-4 h-4 text-primary" />
                  <span className="font-bold">#{t.number}</span>
                  <span className="text-xs bg-accent/50 px-2 py-0.5 rounded-full">{t.transferType}</span>
                  {client && <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">👤 {client.name}</span>}
                </div>
                <div className="text-lg font-extrabold text-primary">{formatCurrency(t.amount, t.currency)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                <div>المرسل: <span className="text-foreground font-semibold">{t.sender}</span></div>
                <div>المستلم: <span className="text-foreground font-semibold">{t.receiver}</span></div>
                <div>عمولة صادرة: {formatCurrency(t.outgoingFee || 0, t.currency)}</div>
                <div>عمولة واردة: {formatCurrency(t.incomingFee || 0, t.currency)}</div>
                <div>التاريخ: {t.date}</div>
                <div>الحالة: <span className="font-semibold">{statusLabels[t.status]}</span></div>
              </div>
              <div className="mt-2 flex gap-1 justify-end">
                <Button size="icon" variant="ghost" onClick={() => sendWA(t)}><MessageCircle className="w-4 h-4 text-success" /></Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  if (!confirm("حذف الحوالة؟")) return;
                  setState((s) => ({ ...s, transfers: s.transfers.filter((x) => x.id !== t.id) }));
                }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEdit ? `تعديل الحوالة #${form.number}` : `حوالة جديدة #${form.number}`}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <F label="رقم الحوالة"><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></F>
            <F label="العميل المرتبط">
              <Select value={form.clientId ?? ""} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="نوع الحوالة">
              <Select value={form.transferType} onValueChange={(v) => setForm({ ...form, transferType: v as Transfer["transferType"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="صادرة">صادرة (على حساب العميل — عليه)</SelectItem>
                  <SelectItem value="واردة">واردة (لحساب العميل — له)</SelectItem>
                  <SelectItem value="داخلية">داخلية</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="المرسل"><Input value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} /></F>
            <F label="المستلم"><Input value={form.receiver} onChange={(e) => setForm({ ...form, receiver: e.target.value })} /></F>
            <F label="العملة">
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{currencyLabels[c]} ({currencySymbols[c]})</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="المبلغ"><Input type="number" inputMode="decimal" placeholder="0" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="عمولة صادرة (على حساب العميل — عليه)"><Input type="number" inputMode="decimal" placeholder="0" value={form.outgoingFee || ""} onChange={(e) => setForm({ ...form, outgoingFee: Number(e.target.value) || 0 })} /></F>
              <F label="عمولة واردة (لحساب العميل — له)"><Input type="number" inputMode="decimal" placeholder="0" value={form.incomingFee || ""} onChange={(e) => setForm({ ...form, incomingFee: Number(e.target.value) || 0 })} /></F>
            </div>
            <F label="التاريخ"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></F>
            <F label="البيان"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></F>
            <F label="الحالة">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Transfer["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(statusLabels) as Transfer["status"][]).map((k) => <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <Button onClick={save}>{isEdit ? "حفظ التعديلات" : "حفظ الحوالة"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
