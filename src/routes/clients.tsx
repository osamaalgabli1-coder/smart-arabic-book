import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Phone, Contact, MessageCircle, Users, MessageSquare, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { setState, useAppState, uid, clientBalance, formatCurrency, categoryName, CURRENCIES, currencyLabels, type Client, type Currency } from "@/lib/store";
import { buildBalanceMessage, sendWhatsapp, maybeSendSMS, sendDirectWhatsapp } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({ component: ClientsPage });

function ClientsPage() {
  const clients = useAppState((s) => s.clients);
  const state = useAppState((s) => s);
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [waClient, setWaClient] = useState<Client | null>(null);

  const startNew = () => { setEditing(null); setOpen(true); };
  const startEdit = (c: Client) => { setEditing(c); setOpen(true); };
  const remove = (id: string) => {
    if (!confirm("حذف السيد؟")) return;
    setState((s) => ({ ...s, clients: s.clients.filter((c) => c.id !== id) }));
  };

  return (
    <AppShell>
      <PageHeader title="إدارة السادة العملاء" subtitle="إضافة وتعديل وحذف السادة العملاء" actions={
        <Button onClick={startNew}><Plus className="w-4 h-4 ml-1" /> سيد جديد</Button>
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
                  <div className="text-[10px] text-muted-foreground">{categoryName(state, c.categoryId)}{c.creditLimit ? ` • سقف: ${formatCurrency(c.creditLimit, c.creditLimitCurrency ?? "YER")}` : ""}</div>
                  {c.phone && <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</div>}
                </div>
                <div className={`text-sm font-bold ${bal >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(bal)}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" title="إرسال الإشعارات عبر واتساب" onClick={() => setWaClient(c)}>
                    <MessageCircle className="w-4 h-4 text-success" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClientDialog open={open} onOpenChange={setOpen} initial={editing} />
      <WhatsappLinkDialog client={waClient} onOpenChange={(v) => { if (!v) setWaClient(null); }} />
    </AppShell>
  );
}

function WhatsappLinkDialog({ client, onOpenChange }: { client: Client | null; onOpenChange: (v: boolean) => void }) {
  const [phone, setPhone] = useState("");
  const [hook, setHook] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (client) {
      setPhone(client.phone ?? "");
      setHook(client.waWebhook ?? "");
      setApiKey(client.waApiKey ?? "");
    }
  }, [client]);

  const persist = () => {
    if (!client) return null;
    const updated: Client = { ...client, phone, waWebhook: hook, waApiKey: apiKey };
    setState((s) => ({ ...s, clients: s.clients.map((c) => (c.id === client.id ? updated : c)) }));
    return updated;
  };

  return (
    <Dialog open={Boolean(client)} onOpenChange={onOpenChange}>
      <DialogContent key={client?.id ?? "wa"}>
        <DialogHeader><DialogTitle>ربط واتساب العميل وإرسال الإشعارات</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <F label="رقم واتساب العميل">
            <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="مثال: 771234567" />
          </F>
          <F label="مفتاح CallMeBot (إرسال تلقائي)">
            <Input dir="ltr" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="123456" />
          </F>
          <F label="أو رابط أداة ربط مخصص (Webhook)">
            <Input dir="ltr" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://example.com/send?to={phone}&text={message}" />
          </F>
          <p className="text-[11px] text-muted-foreground leading-5">
            عند إدخال المفتاح أو الرابط تُرسَل كل الإشعارات تلقائياً إلى واتساب العميل بدون فتح واتساب.
            استخدم <span dir="ltr">{"{message}"}</span> و <span dir="ltr">{"{phone}"}</span> داخل الرابط المخصص.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={async () => {
              const u = persist();
              if (!u) return;
              const msg = buildBalanceMessage(u.id);
              const ok = await sendDirectWhatsapp(u, msg);
              if (!ok) { sendWhatsapp(u.phone, msg); maybeSendSMS(u.phone, msg); }
              onOpenChange(false);
            }}>حفظ وإرسال الآن</Button>
            <Button variant="outline" onClick={() => { persist(); toast.success("تم حفظ ربط واتساب"); onOpenChange(false); }}>حفظ فقط</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Contacts API type (experimental)
type ContactsManager = { select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{ tel?: string[]; name?: string[] }>> };

function ClientDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial: Client | null }) {
  const emptyC: Client = { id: "", name: "", phone: "", address: "", notes: "", openingBalance: 0, notifySms: false, notifyWhatsapp: true, notifyGroup: false, groupInviteLink: "", groupWebhook: "" };
  const categories = useAppState((s) => s.categories);
  const [form, setForm] = useState<Client>(initial ?? emptyC);
  const key = initial?.id ?? "new";

  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : { ...emptyC });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={key}>
        <DialogHeader><DialogTitle>{initial ? "تعديل بيانات السيد" : "سيد جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <F label="اسم السيد"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="التصنيف">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.categoryId ?? categories[0]?.id ?? ""}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </F>
          <F label="سقف المديونية (0 = بدون سقف)">
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.creditLimit ? form.creditLimit : ""}
                onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) || 0 })}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-xs"
                value={form.creditLimitCurrency ?? "YER"}
                onChange={(e) => setForm({ ...form, creditLimitCurrency: e.target.value as Currency })}
              >
                {CURRENCIES.map((c) => (<option key={c} value={c}>{currencyLabels[c]}</option>))}
              </select>
            </div>
          </F>
          <p className="text-[11px] text-muted-foreground -mt-1">عند بلوغ السقف يتم إيقاف العمليات التي تزيد مديونية السيد.</p>
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

          <div className="border-2 border-border rounded-xl p-3 grid gap-3">
            <div className="flex items-center gap-2 font-bold text-sm"><Bell className="w-4 h-4 text-primary" /> الرسائل والإشعارات</div>
            <ChannelRow icon={<MessageSquare className="w-4 h-4 text-primary" />} label="رسالة نصية (SMS)" checked={Boolean(form.notifySms)} onChange={(v) => setForm({ ...form, notifySms: v })} />
            <ChannelRow icon={<MessageCircle className="w-4 h-4 text-success" />} label="رسالة واتساب" checked={Boolean(form.notifyWhatsapp)} onChange={(v) => setForm({ ...form, notifyWhatsapp: v })} />
            <ChannelRow icon={<Users className="w-4 h-4 text-success" />} label="رسالة إلى مجموعة واتساب" checked={Boolean(form.notifyGroup)} onChange={(v) => setForm({ ...form, notifyGroup: v })} />
            {form.notifyGroup && (
              <div className="grid gap-3 bg-accent/30 rounded-lg p-3">
                <F label="رابط مجموعة واتساب (رابط الدعوة)">
                  <Input dir="ltr" value={form.groupInviteLink ?? ""} onChange={(e) => setForm({ ...form, groupInviteLink: e.target.value })} placeholder="https://chat.whatsapp.com/XXXXXXXX" />
                </F>
                <F label="أداة الربط التلقائي (Webhook / CallMeBot)">
                  <Input dir="ltr" value={form.groupWebhook ?? ""} onChange={(e) => setForm({ ...form, groupWebhook: e.target.value })} placeholder="https://api.callmebot.com/...&text={message}" />
                </F>
                <p className="text-[11px] text-muted-foreground leading-5">
                  عند وضع رابط أداة الربط تُرسَل إشعارات السندات والحوالات تلقائياً إلى المجموعة بدون فتح واتساب.
                  استخدم <span dir="ltr">{"{message}"}</span> في الرابط لموضع نص الرسالة، أو اترك الرابط بدونها ليتم الإرسال بطريقة POST بصيغة JSON.
                  بدون أداة ربط: تُنسخ الرسالة تلقائياً ويُفتح رابط المجموعة للصقها.
                </p>
              </div>
            )}
          </div>

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

function ChannelRow({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{label}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
