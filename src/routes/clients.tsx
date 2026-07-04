import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Phone, Contact } from "lucide-react";
import { setState, useAppState, uid, clientBalance, formatCurrency, type Client } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({ component: ClientsPage });

function ClientsPage() {
  const clients = useAppState((s) => s.clients);
  const state = useAppState((s) => s);
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);

  const startNew = () => { setEditing(null); setOpen(true); };
  const startEdit = (c: Client) => { setEditing(c); setOpen(true); };
  const remove = (id: string) => {
    if (!confirm("حذف العميل؟")) return;
    setState((s) => ({ ...s, clients: s.clients.filter((c) => c.id !== id) }));
  };

  return (
    <AppShell>
      <PageHeader title="إدارة العملاء" subtitle="إضافة وتعديل وحذف العملاء" actions={
        <Button onClick={startNew}><Plus className="w-4 h-4 ml-1" /> عميل جديد</Button>
      } />

      {clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">لا يوجد عملاء بعد</div>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => {
            const bal = clientBalance(state, c.id);
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent/60 text-accent-foreground flex items-center justify-center font-bold">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{c.name}</div>
                  {c.phone && <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</div>}
                </div>
                <div className={`text-sm font-bold ${bal >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(bal)}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClientDialog open={open} onOpenChange={setOpen} initial={editing} />
    </AppShell>
  );
}

// Contacts API type (experimental)
type ContactsManager = { select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{ tel?: string[]; name?: string[] }>> };

function ClientDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial: Client | null }) {
  const emptyC: Client = { id: "", name: "", phone: "", address: "", notes: "", openingBalance: 0 };
  const [form, setForm] = useState<Client>(initial ?? emptyC);
  const key = initial?.id ?? "new";

  const pickContact = async () => {
    const nav = navigator as unknown as { contacts?: ContactsManager };
    if (!nav.contacts?.select) {
      toast.error("جهات الاتصال غير مدعومة على هذا الجهاز — أدخل الرقم يدوياً");
      return;
    }
    try {
      const [c] = await nav.contacts.select(["name", "tel"], { multiple: false });
      if (!c) return;
      const phone = c.tel?.[0] ?? "";
      const name = c.name?.[0] ?? form.name;
      setForm((f) => ({ ...f, phone, name: f.name || name }));
      toast.success("تم اختيار جهة الاتصال");
    } catch {
      toast.error("تعذّر الوصول إلى جهات الاتصال");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) setForm(initial ?? emptyC); }}>
      <DialogContent key={key}>
        <DialogHeader><DialogTitle>{initial ? "تعديل عميل" : "عميل جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <F label="اسم العميل"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="رقم الهاتف">
            <div className="flex gap-2">
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="مثال: 771234567" />
              <Button type="button" variant="outline" size="icon" onClick={pickContact} title="من جهات الاتصال">
                <Contact className="w-4 h-4" />
              </Button>
            </div>
          </F>
          <F label="العنوان"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
          <F label="الرصيد الافتتاحي">
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.openingBalance ? Math.abs(form.openingBalance) : ""}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  const sign = (form.openingBalance ?? 0) < 0 ? -1 : 1;
                  setForm({ ...form, openingBalance: v * sign });
                }}
              />
              <Button
                type="button"
                variant={(form.openingBalance ?? 0) >= 0 ? "default" : "outline"}
                onClick={() => setForm({ ...form, openingBalance: Math.abs(form.openingBalance || 0) })}
                title="له (دائن)"
              >له</Button>
              <Button
                type="button"
                variant={(form.openingBalance ?? 0) < 0 ? "destructive" : "outline"}
                onClick={() => setForm({ ...form, openingBalance: -Math.abs(form.openingBalance || 0) })}
                title="عليه (مدين)"
              >عليه</Button>
            </div>
          </F>
          <F label="ملاحظات"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
          <Button onClick={() => {
            if (!form.name.trim()) return;
            setState((s) => {
              if (initial) return { ...s, clients: s.clients.map((c) => c.id === initial.id ? { ...form, id: initial.id } : c) };
              return { ...s, clients: [...s.clients, { ...form, id: uid() }] };
            });
            onOpenChange(false);
          }}>حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
