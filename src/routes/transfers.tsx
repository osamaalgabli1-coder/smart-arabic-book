import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send } from "lucide-react";
import { setState, useAppState, uid, formatCurrency, type Transfer } from "@/lib/store";

export const Route = createFileRoute("/transfers")({ component: TransfersPage });

const empty = (): Transfer => ({
  id: "", number: "", sender: "", receiver: "", transferType: "صادرة",
  amount: 0, outgoingFee: 0, incomingFee: 0,
  date: new Date().toISOString().slice(0, 10), status: "pending",
});

const statusLabels: Record<Transfer["status"], string> = { pending: "قيد التنفيذ", completed: "مكتملة", cancelled: "ملغاة" };

function TransfersPage() {
  const transfers = useAppState((s) => s.transfers);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Transfer>(empty());

  return (
    <AppShell>
      <PageHeader title="الحوالات" subtitle="إدارة الحوالات الصادرة والواردة" actions={
        <Button onClick={() => { setForm({ ...empty(), number: `HW-${Date.now().toString().slice(-6)}` }); setOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> حوالة جديدة
        </Button>
      } />

      <div className="grid gap-3">
        {transfers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">لا توجد حوالات</div>
        )}
        {[...transfers].reverse().map((t) => (
          <div key={t.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                <span className="font-bold">#{t.number}</span>
                <span className="text-xs bg-accent/50 px-2 py-0.5 rounded-full">{t.transferType}</span>
              </div>
              <div className="text-lg font-extrabold text-primary">{formatCurrency(t.amount)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
              <div>المرسل: <span className="text-foreground font-semibold">{t.sender}</span></div>
              <div>المستلم: <span className="text-foreground font-semibold">{t.receiver}</span></div>
              <div>عمولة صادرة: {formatCurrency(t.outgoingFee || 0)}</div>
              <div>عمولة واردة: {formatCurrency(t.incomingFee || 0)}</div>
              <div>التاريخ: {t.date}</div>
              <div>الحالة: <span className="font-semibold">{statusLabels[t.status]}</span></div>
            </div>
            <div className="mt-2 text-left">
              <Button size="sm" variant="ghost" onClick={() => {
                if (!confirm("حذف الحوالة؟")) return;
                setState((s) => ({ ...s, transfers: s.transfers.filter((x) => x.id !== t.id) }));
              }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>حوالة جديدة</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <F label="رقم الحوالة"><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></F>
            <F label="المرسل"><Input value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} /></F>
            <F label="المستلم"><Input value={form.receiver} onChange={(e) => setForm({ ...form, receiver: e.target.value })} /></F>
            <F label="نوع الحوالة">
              <Select value={form.transferType} onValueChange={(v) => setForm({ ...form, transferType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="صادرة">صادرة</SelectItem>
                  <SelectItem value="واردة">واردة</SelectItem>
                  <SelectItem value="داخلية">داخلية</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="المبلغ"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="عمولة صادرة"><Input type="number" value={form.outgoingFee ?? 0} onChange={(e) => setForm({ ...form, outgoingFee: Number(e.target.value) || 0 })} /></F>
              <F label="عمولة واردة"><Input type="number" value={form.incomingFee ?? 0} onChange={(e) => setForm({ ...form, incomingFee: Number(e.target.value) || 0 })} /></F>
            </div>
            <F label="التاريخ"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></F>
            <F label="الحالة">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Transfer["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(statusLabels) as Transfer["status"][]).map((k) => <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <Button onClick={() => {
              if (!form.sender || !form.receiver || form.amount <= 0) return;
              setState((s) => ({ ...s, transfers: [...s.transfers, { ...form, id: uid() }] }));
              setOpen(false);
            }}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}