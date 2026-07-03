import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Share2, Save } from "lucide-react";
import { getState, clientBalance, formatCurrency } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/export")({ component: ExportPage });

function toCSV(rows: string[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function download(name: string, content: string, type: string) {
  const blob = new Blob(["\uFEFF" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportPage() {
  const exportClientsCSV = () => {
    const s = getState();
    const rows = [["الاسم", "الهاتف", "العنوان", "الرصيد"]];
    s.clients.forEach((c) => rows.push([c.name, c.phone ?? "", c.address ?? "", formatCurrency(clientBalance(s, c.id))]));
    download("clients.csv", toCSV(rows), "text/csv;charset=utf-8");
    toast.success("تم تصدير الملف");
  };
  const exportDetailPDF = () => { window.print(); };
  const shareWhatsapp = () => {
    const s = getState();
    const text = `كشف عملاء ${s.company.name}\n\n` + s.clients.map((c) => `• ${c.name}: ${formatCurrency(clientBalance(s, c.id))}`).join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  return (
    <AppShell>
      <PageHeader title="تصدير البيانات" subtitle="PDF · Excel · واتساب · حفظ في الجهاز" />
      <div className="grid sm:grid-cols-2 gap-3">
        <Btn icon={<FileText />} label="تصدير كشف العملاء الإجمالي PDF" onClick={exportDetailPDF} />
        <Btn icon={<FileText />} label="تصدير كشف العملاء التفصيلي PDF" onClick={exportDetailPDF} />
        <Btn icon={<FileSpreadsheet />} label="تصدير Excel (CSV)" onClick={exportClientsCSV} />
        <Btn icon={<Share2 />} label="مشاركة عبر واتساب" onClick={shareWhatsapp} />
        <Btn icon={<Save />} label="حفظ في الجهاز" onClick={exportClientsCSV} />
      </div>
    </AppShell>
  );
}

function Btn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="h-auto py-4 justify-start gap-3">
      <span className="text-primary">{icon}</span>
      <span className="font-bold">{label}</span>
    </Button>
  );
}