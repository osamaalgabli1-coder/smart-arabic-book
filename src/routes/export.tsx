import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Share2, Save, Users, User, Download } from "lucide-react";
import { useAppState, getState, clientBalance, formatCurrency } from "@/lib/store";
import { openStatementPDF, downloadStatementHTML } from "@/lib/statement-pdf";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  const state = useAppState((s) => s);
  const [clientId, setClientId] = useState<string>(state.clients[0]?.id ?? "");

  const exportClientsCSV = () => {
    const s = getState();
    const rows = [["الاسم", "الهاتف", "العنوان", "الرصيد"]];
    s.clients.forEach((c) => rows.push([c.name, c.phone ?? "", c.address ?? "", formatCurrency(clientBalance(s, c.id))]));
    download("clients.csv", toCSV(rows), "text/csv;charset=utf-8");
    toast.success("تم تصدير الملف");
  };

  const shareWhatsapp = () => {
    const s = getState();
    const text = `كشف عملاء ${s.company.name}\n\n` + s.clients.map((c) => `• ${c.name}: ${formatCurrency(clientBalance(s, c.id))}`).join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <AppShell>
      <PageHeader title="تصدير البيانات" subtitle="PDF تفصيلي · إجمالي · Excel · واتساب" />

      <section className="mb-5">
        <h3 className="font-bold text-primary mb-3 text-sm">تصدير كشف الحساب PDF</h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div className="grid gap-1.5">
            <Label>اختر العميل</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
              <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Btn icon={<User />} label="كشف تفصيلي — هذا العميل" onClick={() => {
            const c = state.clients.find((x) => x.id === clientId);
            if (!c) { toast.error("اختر عميلاً"); return; }
            openStatementPDF([c.id], { title: `كشف حساب — ${c.name}` });
          }} />
          <Btn icon={<Users />} label="كشف تفصيلي — كل العملاء" onClick={() => {
            if (state.clients.length === 0) { toast.error("لا يوجد عملاء"); return; }
            openStatementPDF(state.clients.map((c) => c.id), { title: "كشف حسابات كل العملاء" });
          }} />
          <Btn icon={<Download />} label="تنزيل كشف هذا العميل (إلى التنزيلات)" onClick={() => {
            const c = state.clients.find((x) => x.id === clientId);
            if (!c) { toast.error("اختر عميلاً"); return; }
            downloadStatementHTML([c.id], { title: `كشف-حساب-${c.name}` });
            toast.success("تم التنزيل إلى مجلد التنزيلات");
          }} />
          <Btn icon={<Download />} label="تنزيل كشف كل العملاء (إلى التنزيلات)" onClick={() => {
            if (state.clients.length === 0) { toast.error("لا يوجد عملاء"); return; }
            downloadStatementHTML(state.clients.map((c) => c.id), { title: "كشف-حسابات-كل-العملاء" });
            toast.success("تم التنزيل إلى مجلد التنزيلات");
          }} />
        </div>
      </section>

      <section>
        <h3 className="font-bold text-primary mb-3 text-sm">تصدير إجمالي</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Btn icon={<FileText />} label="كشف العملاء الإجمالي (طباعة)" onClick={() => window.print()} />
          <Btn icon={<FileSpreadsheet />} label="Excel — قائمة العملاء (CSV)" onClick={exportClientsCSV} />
          <Btn icon={<Share2 />} label="مشاركة عبر واتساب" onClick={shareWhatsapp} />
          <Btn icon={<Save />} label="حفظ في الجهاز (CSV)" onClick={exportClientsCSV} />
        </div>
      </section>
    </AppShell>
  );
}

function Btn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="h-auto py-4 justify-start gap-3">
      <span className="text-primary">{icon}</span>
      <span className="font-bold text-right flex-1">{label}</span>
    </Button>
  );
}
