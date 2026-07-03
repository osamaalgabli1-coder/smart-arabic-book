import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { Moon, Sun, Trash2, MessageCircle } from "lucide-react";
import { setState, useAppState } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const [dark, setDark] = useState(false);
  const wa = useAppState((s) => s.settings.whatsappAutoSend);
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
            setState(() => ({ clients: [], cashboxes: [{ id: "main", name: "الصندوق الرئيسي", type: "main", openingBalance: 0, currency: "YER" }], vouchers: [], transfers: [], company: { name: "شركتي" }, settings: { whatsappAutoSend: false } }));
            toast.success("تم مسح البيانات");
          }}>
            <Trash2 className="w-4 h-4 ml-1" /> مسح
          </Button>
        </div>
      </div>
    </AppShell>
  );
}