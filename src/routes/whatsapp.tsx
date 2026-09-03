import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Save, Send, RefreshCw, ShieldCheck } from "lucide-react";
import { useAppState } from "@/lib/store";
import { getWaConfig, saveWaConfig, listWaMessages, sendWaBusinessMessage, upsertWaRecipient, type WaConfigPublic } from "@/lib/wa-business.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/whatsapp")({
  component: WhatsappPage,
  head: () => ({
    meta: [
      { title: "إشعارات WhatsApp Business — نظام المحاسب المطور" },
      { name: "description", content: "ربط النظام المحاسبي بحساب WhatsApp Business من ميتا لإرسال إشعارات السندات والحوالات فوراً للعملاء." },
      { property: "og:title", content: "إشعارات WhatsApp Business — نظام المحاسب المطور" },
      { property: "og:description", content: "ربط ميتا وإرسال إشعارات واتساب تلقائية للعملاء مع سجل رسائل كامل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type LogRow = { id: string; clientName: string | null; toPhone: string | null; body: string; status: string; error: string | null; refNumber: string | null; createdAt: string };

const emptyCfg: WaConfigPublic = {
  enabled: false, phoneNumberId: "", businessAccountId: "", apiVersion: "v21.0",
  webhookVerifyToken: "", defaultTemplate: "", defaultLang: "ar", hasToken: false,
};

function WhatsappPage() {
  const clients = useAppState((s) => s.clients);
  const [cfg, setCfg] = useState<WaConfigPublic>(emptyCfg);
  const [token, setToken] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [testId, setTestId] = useState("");

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/whatsapp` : "/api/public/whatsapp";

  const refresh = async () => {
    try {
      setCfg(await getWaConfig());
      setLogs((await listWaMessages({ data: { limit: 25 } })) as LogRow[]);
    } catch { /* ignore */ }
  };
  useEffect(() => { void refresh(); }, []);

  const save = async () => {
    setBusy(true);
    try {
      await saveWaConfig({ data: { ...cfg, accessToken: token } });
      setToken("");
      toast.success("تم حفظ إعدادات WhatsApp Business");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"); }
    setBusy(false);
  };

  const syncClients = async () => {
    setBusy(true);
    try {
      for (const c of clients) {
        await upsertWaRecipient({ data: {
          clientId: c.id, clientName: c.name, phone: c.phone ?? "",
          groupLink: c.groupInviteLink ?? "", notifyWhatsapp: c.notifyWhatsapp ?? true, notifyGroup: c.notifyGroup ?? false,
        } });
      }
      toast.success(`تمت مزامنة ${clients.length} عميل مع قاعدة بيانات الإشعارات`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذّرت المزامنة"); }
    setBusy(false);
  };

  const sendTest = async () => {
    const c = clients.find((x) => x.id === testId);
    if (!c) { toast.error("اختر عميلاً"); return; }
    setBusy(true);
    const res = await sendWaBusinessMessage({ data: {
      message: `رسالة تجريبية من نظام المحاسب المطور ✅\nالسيد: ${c.name}`,
      phone: c.phone ?? "", clientId: c.id, clientName: c.name, kind: "test",
    } });
    if (res.ok) toast.success("تم الإرسال الفوري بنجاح"); else toast.error(res.error ?? "فشل الإرسال");
    await refresh();
    setBusy(false);
  };

  return (
    <AppShell>
      <PageHeader title="إشعارات WhatsApp Business" subtitle="ربط رسمي مع ميتا — إرسال فوري للعملاء والمجموعات دون فتح واتساب" />

      <div className="grid gap-4">
        <section className="bg-card border border-border rounded-xl p-4 grid gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold"><MessageCircle className="w-5 h-5 text-success" /> ربط ميتا (Meta Cloud API)</div>
            <div className="flex items-center gap-2 text-xs">
              <span>تفعيل</span>
              <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
            </div>
          </div>
          <F label="معرّف رقم الهاتف (Phone Number ID)"><Input value={cfg.phoneNumberId} onChange={(e) => setCfg({ ...cfg, phoneNumberId: e.target.value })} placeholder="1234567890" /></F>
          <F label="معرّف حساب الأعمال (WABA ID)"><Input value={cfg.businessAccountId} onChange={(e) => setCfg({ ...cfg, businessAccountId: e.target.value })} placeholder="1234567890" /></F>
          <F label={`رمز الوصول الدائم (Access Token)${cfg.hasToken ? " — محفوظ ✅ (اتركه فارغاً للإبقاء عليه)" : ""}`}>
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG..." />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="إصدار الواجهة"><Input value={cfg.apiVersion} onChange={(e) => setCfg({ ...cfg, apiVersion: e.target.value })} /></F>
            <F label="لغة القوالب"><Input value={cfg.defaultLang} onChange={(e) => setCfg({ ...cfg, defaultLang: e.target.value })} /></F>
          </div>
          <F label="اسم القالب الافتراضي (اختياري)"><Input value={cfg.defaultTemplate} onChange={(e) => setCfg({ ...cfg, defaultTemplate: e.target.value })} placeholder="account_notification" /></F>
          <F label="رمز التحقق للويب هوك (Verify Token)"><Input value={cfg.webhookVerifyToken} onChange={(e) => setCfg({ ...cfg, webhookVerifyToken: e.target.value })} placeholder="اكتب أي كلمة سرية وضعها في ميتا" /></F>
          <F label="رابط الويب هوك (Callback URL) — انسخه إلى ميتا">
            <Input readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} />
          </F>
          <Button onClick={save} disabled={busy}><Save className="w-4 h-4 ml-1" /> حفظ الإعدادات</Button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="w-3 h-3 inline ml-1" />
            الرموز محفوظة في قاعدة بيانات مؤمّنة على الخادم ولا تظهر في المتصفح. ملاحظة: واجهة ميتا الرسمية لا تدعم الإرسال إلى مجموعات واتساب —
            تُرسل الإشعارات إلى أرقام العملاء فوراً، وتبقى المجموعات عبر رابط/أداة الربط في بطاقة السيد.
          </p>
        </section>

        <section className="bg-card border border-border rounded-xl p-4 grid gap-3">
          <div className="font-bold">قاعدة بيانات العملاء والإشعارات</div>
          <Button variant="secondary" onClick={syncClients} disabled={busy}><RefreshCw className="w-4 h-4 ml-1" /> مزامنة كل العملاء ({clients.length})</Button>
          <div className="grid gap-2">
            <Label className="text-xs font-semibold">إرسال رسالة تجريبية</Label>
            <div className="flex gap-2">
              <Select value={testId} onValueChange={setTestId}>
                <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={sendTest} disabled={busy}><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-4 grid gap-2">
          <div className="flex items-center justify-between">
            <div className="font-bold">سجل الرسائل</div>
            <Button size="sm" variant="ghost" onClick={() => void refresh()}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          {logs.length === 0 && <div className="text-center text-muted-foreground text-sm py-6">لا توجد رسائل بعد</div>}
          {logs.map((l) => (
            <div key={l.id} className="border border-border rounded-lg p-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-bold">{l.clientName || l.toPhone || "—"}</span>
                <span className={l.status === "failed" ? "text-destructive font-bold" : "text-success font-bold"}>{l.status}</span>
              </div>
              <div className="text-muted-foreground truncate">{l.error || l.body.split("\n")[0]}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(l.createdAt).toLocaleString("ar-EG")}</div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
