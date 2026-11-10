import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BellRing, PlugZap, Unplug, Save, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { setState, getState } from "@/lib/store";
import { getRelayConfig, saveRelayConfig, disconnectRelay, testRelayConnection, listRelayAttempts } from "@/lib/relay.functions";

export const Route = createFileRoute("/notification-relay")({
  head: () => ({
    meta: [
      { title: "ربط تطبيق الإشعارات — نظام المحاسب المطور" },
      { name: "description", content: "ربط نظام المحاسب المطور بتطبيق الإشعارات التلقائية لإرسال العمليات للسادة العملاء." },
      { property: "og:title", content: "ربط تطبيق الإشعارات — نظام المحاسب المطور" },
      { property: "og:description", content: "إرسال السندات والحوالات والقيود تلقائياً إلى تطبيق الإشعارات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelayPage,
});

function RelayPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <AppShell>
      <PageHeader title="ربط تطبيق الإشعارات" subtitle="المحاسب المطور مصدر البيانات — وتطبيق الإشعارات يرسل للسادة" />
      {!ready ? null : session ? <RelayForm /> : <SignIn />}
    </AppShell>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${window.location.origin}/notification-relay` } });
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    if (mode === "up" && !r.data.session) toast.success("تحقق من بريدك لتأكيد الحساب");
  };
  const oauth = async (p: "google" | "lovable") => {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
    if (r.error) toast.error("تعذّر تسجيل الدخول");
  };
  return (
    <div className="max-w-md bg-card border-2 border-border rounded-xl p-4 grid gap-3">
      <p className="text-sm text-muted-foreground">سجّل الدخول لحفظ بيانات الربط بأمان؛ يُحفظ المفتاح مشفراً ولا يظهر بعد حفظه.</p>
      <button type="button" onClick={() => void oauth("google")} className="flex items-center justify-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium" style={{ background: "#FFFFFF", border: "1px solid #747775", color: "#1F1F1F" }}>
        <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
        المتابعة باستخدام Google
      </button>
      <button type="button" className="lovable-auth-button" onClick={() => void oauth("lovable")}>Continue with Lovable</button>
      <div className="grid gap-1.5"><Label>البريد الإلكتروني</Label><Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label>كلمة المرور</Label><Input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <Button disabled={busy || !email || pw.length < 6} onClick={() => void submit()}>{mode === "in" ? "تسجيل الدخول" : "إنشاء حساب"}</Button>
      <button className="text-xs text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "ليس لديك حساب؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}</button>
    </div>
  );
}

function RelayForm() {
  const getCfg = useServerFn(getRelayConfig);
  const save = useServerFn(saveRelayConfig);
  const disconnect = useServerFn(disconnectRelay);
  const test = useServerFn(testRelayConnection);
  const listAttempts = useServerFn(listRelayAttempts);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [authHeader, setAuthHeader] = useState<"Authorization" | "X-API-Key">("Authorization");
  const [enabled, setEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState<{ id: string; event_id: string; status: string; error: string | null; created_at: string }[]>([]);

  const load = async () => {
    const c = await getCfg();
    setConnected(c.connected); setUrl(c.url); setAuthHeader(c.authHeader as "Authorization" | "X-API-Key"); setEnabled(c.connected ? c.enabled : true);
    setState((s) => ({ ...s, settings: { ...s.settings, notificationRelayEnabled: c.connected && c.enabled } }));
    setAttempts(await listAttempts());
  };
  useEffect(() => { void load().catch(() => toast.error("تعذّر تحميل الإعدادات")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "حدث خطأ"); } finally { setBusy(false); } };

  return (
    <div className="grid gap-3 max-w-lg">
      <div className="bg-card border-2 border-border rounded-xl p-4 grid gap-3">
        <div className="flex items-center gap-2 font-bold"><BellRing className="w-5 h-5 text-primary" /> بيانات الربط
          <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{connected ? "متصل" : "غير متصل"}</span>
        </div>
        <div className="grid gap-1.5"><Label>رابط تطبيق الإشعارات (URL)</Label><Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
        <div className="grid gap-1.5"><Label>مفتاح الربط الآمن (API Key)</Label><Input dir="ltr" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={connected ? "محفوظ — اتركه فارغاً للإبقاء عليه" : "أدخل المفتاح"} /></div>
        <div className="grid gap-1.5"><Label>طريقة إرسال المفتاح</Label>
          <Select value={authHeader} onValueChange={(v) => setAuthHeader(v as typeof authHeader)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Authorization">Authorization: Bearer</SelectItem><SelectItem value="X-API-Key">X-API-Key</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between"><Label>الإرسال التلقائي بعد حفظ العمليات</Label><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" disabled={busy || !url} onClick={() => void run(async () => {
            const r = await test({ data: { url, apiKey: apiKey || undefined, authHeader, companyName: getState().company.name } });
            r.ok ? toast.success("نجح الاتصال بتطبيق الإشعارات") : toast.error(r.error ?? "فشل الاتصال");
          })}><PlugZap className="w-4 h-4 ml-1" />اختبار</Button>
          <Button disabled={busy || !url} onClick={() => void run(async () => {
            await save({ data: { url, apiKey: apiKey || undefined, authHeader, enabled } });
            setApiKey(""); toast.success("تم حفظ الربط"); await load();
          })}><Save className="w-4 h-4 ml-1" />حفظ</Button>
          <Button variant="destructive" disabled={busy || !connected} onClick={() => void run(async () => {
            if (!confirm("فصل الاتصال وحذف بيانات الربط؟")) return;
            await disconnect(); setUrl(""); setApiKey(""); toast.success("تم فصل الاتصال"); await load();
          })}><Unplug className="w-4 h-4 ml-1" />فصل</Button>
        </div>
        <p className="text-xs text-muted-foreground">تُرسل العمليات بعد حفظها: إضافة/تعديل سيد، السندات، الحوالات، والقيد البسيط للطرفين. فشل الإرسال لا يؤثر على الحسابات.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="font-bold mb-2 text-sm">آخر محاولات الإرسال</div>
        {attempts.length === 0 ? <div className="text-xs text-muted-foreground">لا توجد محاولات بعد</div> : (
          <div className="grid gap-1.5">{attempts.map((a) => (
            <div key={a.id} className="text-xs flex justify-between gap-2 border-b border-border pb-1">
              <span className={a.status === "accepted" ? "text-success font-bold" : "text-destructive font-bold"}>{a.status === "accepted" ? "استُلمت" : "فشلت"}</span>
              <span className="truncate flex-1 text-muted-foreground" dir="ltr">{a.error || a.event_id.split(":").slice(0, 2).join(":")}</span>
              <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("ar")}</span>
            </div>
          ))}</div>
        )}
      </div>
      <Button variant="ghost" className="justify-self-start" onClick={() => void supabase.auth.signOut()}><LogOut className="w-4 h-4 ml-1" />تسجيل الخروج</Button>
    </div>
  );
}
