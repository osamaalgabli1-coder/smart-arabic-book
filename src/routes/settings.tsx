import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Moon, Sun, Trash2, MessageCircle, MessageSquare, Lock, Send } from "lucide-react";
import { setState, useAppState, defaultCategories } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const [dark, setDark] = useState(false);
  const wa = useAppState((s) => s.settings.whatsappAutoSend);
  const sms = useAppState((s) => Boolean(s.settings.smsNotifications));
  const pwEnabled = useAppState((s) => Boolean(s.settings.passwordEnabled));
  const pw = useAppState((s) => s.settings.password ?? "");
  const tgToken = useAppState((s) => s.settings.telegramBotToken ?? "");
  const tgChat = useAppState((s) => s.settings.telegramChatId ?? "");
  const [pwInput, setPwInput] = useState("");
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    document.documentElement.classList.toggle("dark");
    setDark(document.documentElement.classList.contains("dark"));
  };
  return (
    <AppShell>
      <PageHeader title="الإعدادات" subtitle="تخصيص التطبيق" />
      <div className="grid gap-3 max-w-lg">
        <div className="bg-card border-2 border-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-success mt-0.5" />
            <div>
              <div className="font-bold">إشعارات واتساب التلقائية</div>
              <div className="text-xs text-muted-foreground">يطلب تأكيد قبل الإرسال عند حفظ أي سند/حوالة</div>
            </div>
          </div>
          <Switch checked={wa} onCheckedChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, whatsappAutoSend: v } }))} />
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <div className="font-bold">إرسال الإشعارات عبر الرسائل النصية (SMS)</div>
              <div className="text-xs text-muted-foreground">يفتح تطبيق الرسائل برقم السيد ونص الإشعار</div>
            </div>
          </div>
          <Switch checked={sms} onCheckedChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, smsNotifications: v } }))} />
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4 grid gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <div className="font-bold">كلمة مرور الدخول (اختياري)</div>
                <div className="text-xs text-muted-foreground">تُطلب كلمة المرور عند فتح التطبيق</div>
              </div>
            </div>
            <Switch
              checked={pwEnabled}
              onCheckedChange={(v) => {
                if (v && !pw) { toast.error("أدخل كلمة المرور واحفظها أولاً"); return; }
                setState((s) => ({ ...s, settings: { ...s.settings, passwordEnabled: v } }));
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">كلمة المرور</Label>
            <div className="flex gap-2">
              <Input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} placeholder={pw ? "••••••" : "أدخل كلمة مرور"} />
              <Button onClick={() => {
                if (!pwInput.trim()) { toast.error("أدخل كلمة مرور"); return; }
                setState((s) => ({ ...s, settings: { ...s.settings, password: pwInput.trim() } }));
                setPwInput("");
                toast.success("تم حفظ كلمة المرور");
              }}>حفظ</Button>
            </div>
          </div>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4 grid gap-3">
          <div className="flex items-start gap-3">
            <Send className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <div className="font-bold">إعدادات بوت تيليجرام للنسخ الاحتياطي</div>
              <div className="text-xs text-muted-foreground">أنشئ بوتاً عبر BotFather وضع التوكن ومعرّف المحادثة</div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Bot Token</Label>
            <Input value={tgToken} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, telegramBotToken: e.target.value } }))} placeholder="123456:ABC..." />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Chat ID</Label>
            <Input value={tgChat} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, telegramChatId: e.target.value } }))} placeholder="مثال: 123456789" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="font-bold">الوضع الليلي</div>
            <div className="text-xs text-muted-foreground">تبديل بين الوضع النهاري والليلي</div>
          </div>
          <Button variant="outline" onClick={toggle}>
            {dark ? <Sun className="w-4 h-4 ml-1" /> : <Moon className="w-4 h-4 ml-1" />}
            {dark ? "نهاري" : "ليلي"}
          </Button>
        </div>
        <div className="bg-card border border-destructive/40 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-destructive">مسح جميع البيانات</div>
            <div className="text-xs text-muted-foreground">لا يمكن التراجع عن هذه العملية</div>
          </div>
          <Button variant="destructive" onClick={() => {
            if (!confirm("مسح كل البيانات؟")) return;
            setState(() => ({ clients: [], categories: defaultCategories, cashboxes: [{ id: "main", name: "الصندوق الرئيسي", type: "main", openingBalance: 0, currency: "YER" }], vouchers: [], transfers: [], company: { name: "شركتي" }, settings: { whatsappAutoSend: false } }));
            toast.success("تم مسح البيانات");
          }}>
            <Trash2 className="w-4 h-4 ml-1" /> مسح
          </Button>
        </div>
      </div>
    </AppShell>
  );
}