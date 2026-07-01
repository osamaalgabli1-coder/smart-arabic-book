import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Download, Upload, Send } from "lucide-react";
import { getState, setState, type AppState } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/backup")({ component: BackupPage });

function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadBackup = () => {
    const data = JSON.stringify(getState(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل النسخة الاحتياطية");
  };

  const restore = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as AppState;
      setState(() => data);
      toast.success("تمت الاستعادة بنجاح");
    } catch {
      toast.error("ملف غير صالح");
    }
  };

  return (
    <AppShell>
      <PageHeader title="النسخ الاحتياطي والاستعادة" subtitle="احفظ بياناتك بأمان محلياً أو عبر تيليجرام" />
      <div className="grid sm:grid-cols-2 gap-3">
        <Card icon={<Download className="w-6 h-6" />} title="نسخة احتياطية إلى ملفات الجهاز" desc="تنزيل ملف JSON لكامل البيانات">
          <Button onClick={downloadBackup} className="w-full">تنزيل النسخة</Button>
        </Card>
        <Card icon={<Upload className="w-6 h-6" />} title="استعادة من ملفات الجهاز" desc="اختر ملف نسخة احتياطية سابقاً">
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full">اختيار ملف</Button>
        </Card>
        <Card icon={<Send className="w-6 h-6" />} title="نسخة احتياطية إلى تيليجرام" desc="سيتم دمج بوت تيليجرام لاحقاً">
          <Button disabled variant="outline" className="w-full">قريباً</Button>
        </Card>
        <Card icon={<Send className="w-6 h-6 rotate-180" />} title="استعادة من تيليجرام" desc="اختيار قناة أو بوت لجلب النسخة">
          <Button disabled variant="outline" className="w-full">قريباً</Button>
        </Card>
      </div>
    </AppShell>
  );
}

function Card({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border-2 border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <div className="font-bold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}