import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Palette, Type, Image as ImageIcon, FileText, Layout, Tag } from "lucide-react";

export const Route = createFileRoute("/customize")({ component: CustomizePage });

const items = [
  { icon: Layout, label: "محرر الواجهات" },
  { icon: Type, label: "محرر النصوص" },
  { icon: Palette, label: "محرر الألوان" },
  { icon: ImageIcon, label: "تعديل الشعار" },
  { icon: Tag, label: "تعديل اسم التطبيق" },
  { icon: FileText, label: "تعديل التقارير" },
];

function CustomizePage() {
  return (
    <AppShell>
      <PageHeader title="تعديل وتطوير البرنامج" subtitle="خصص التطبيق ليطابق هوية شركتك" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.label} className="bg-card border-2 border-border rounded-xl p-5 flex flex-col items-center gap-2 hover:border-primary transition">
              <div className="w-14 h-14 rounded-full bg-accent/50 flex items-center justify-center"><Icon className="w-7 h-7 text-primary" /></div>
              <div className="text-sm font-bold text-center">{it.label}</div>
              <div className="text-[10px] text-muted-foreground">قريباً</div>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}