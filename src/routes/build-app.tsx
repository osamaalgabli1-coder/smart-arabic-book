import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Package, Smartphone, Image as ImageIcon, Tag, Layers, FolderDown } from "lucide-react";

export const Route = createFileRoute("/build-app")({ component: BuildAppPage });

const items = [
  { icon: Package, label: "إنشاء APK" },
  { icon: Layers, label: "إنشاء AAB" },
  { icon: Tag, label: "تغيير اسم الحزمة" },
  { icon: ImageIcon, label: "تغيير الأيقونة" },
  { icon: Smartphone, label: "تغيير شاشة البداية" },
  { icon: FolderDown, label: "تصدير المشروع بالكامل" },
];

function BuildAppPage() {
  return (
    <AppShell>
      <PageHeader title="إنشاء تطبيق مستقل" subtitle="حوّل النظام إلى تطبيق أندرويد جاهز للنشر" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.label} className="bg-card border-2 border-border rounded-xl p-5 flex flex-col items-center gap-2 hover:border-primary transition">
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center"><Icon className="w-7 h-7 text-primary" /></div>
              <div className="text-sm font-bold text-center">{it.label}</div>
              <div className="text-[10px] text-muted-foreground">قريباً</div>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}