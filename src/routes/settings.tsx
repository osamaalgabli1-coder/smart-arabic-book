import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Moon, Sun, Trash2 } from "lucide-react";
import { setState } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    document.documentElement.classList.toggle("dark");
    setDark(document.documentElement.classList.contains("dark"));
  };
  return (
    <AppShell>
      <PageHeader title="الإعدادات" subtitle="تخصيص التطبيق" />
      <div className="grid gap-3 max-w-lg">
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
            setState(() => ({ clients: [], cashboxes: [{ id: "main", name: "الصندوق الرئيسي", type: "main", openingBalance: 0, currency: "YER" }], vouchers: [], transfers: [], company: { name: "شركتي" } }));
            toast.success("تم مسح البيانات");
          }}>
            <Trash2 className="w-4 h-4 ml-1" /> مسح
          </Button>
        </div>
      </div>
    </AppShell>
  );
}