import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, Trash2 } from "lucide-react";
import { setState, useAppState, uid, cashboxBalance, formatCurrency, type Cashbox } from "@/lib/store";

export const Route = createFileRoute("/cashboxes")({ component: CashboxesPage });

function CashboxesPage() {
  const state = useAppState((s) => s);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Cashbox>({ id: "", name: "", type: "main", openingBalance: 0 });
  const mains = state.cashboxes.filter((c) => c.type === "main");

  return (
    <AppShell>
      <PageHeader title="إدارة الصناديق" subtitle="صناديق رئيسية وفرعية بلا حدود" actions={
        <Button onClick={() => { setForm({ id: "", name: "", type: "main", openingBalance: 0 }); setOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> صندوق جديد
        </Button>
      } />

      <div className="grid gap-3">
        {state.cashboxes.map((c) => {
          const bal = cashboxBalance(state, c.id);
          return (
            <div key={c.id} className={`bg-card border-2 border-border rounded-xl p-4 flex items-center gap-3 ${c.type === "sub" ? "mr-8" : ""}`}>
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.type === "main" ? "صندوق رئيسي" : "صندوق فرعي"}</div>
              </div>
              <div className={`text-lg font-extrabold ${bal >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(bal)}</div>
              {c.id !== "main" && (
                <Button size="icon" variant="ghost" onClick={() => {
                  if (!confirm("حذف الصندوق؟")) return;
                  setState((s) => ({ ...s, cashboxes: s.cashboxes.filter((x) => x.id !== c.id) }));
                }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>صندوق جديد</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "main" | "sub" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">رئيسي</SelectItem>
                  <SelectItem value="sub">فرعي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "sub" && mains.length > 0 && (
              <div className="grid gap-1.5"><Label>الصندوق الأب</Label>
                <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{mains.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5"><Label>الرصيد الافتتاحي</Label><Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) || 0 })} /></div>
            <Button onClick={() => {
              if (!form.name.trim()) return;
              setState((s) => ({ ...s, cashboxes: [...s.cashboxes, { ...form, id: uid() }] }));
              setOpen(false);
            }}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}