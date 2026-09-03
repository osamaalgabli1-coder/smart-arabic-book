import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Share2, Users, User, Download, FileDown, MessageCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useAppState, getState, clientBalance, formatCurrency } from "@/lib/store";
import { openStatementPDF, downloadStatementHTML, downloadStatementPDF, sendClientStatementToWhatsapp } from "@/lib/statement-pdf";
import { sendWhatsapp, buildBalanceMessage } from "@/lib/whatsapp";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/export")({ component: ExportPage });

function ExportPage() {
  const state = useAppState((s) => s);
  const [clientId, setClientId] = useState<string>(state.clients[0]?.id ?? "");

  const allIds = () => state.clients.map((c) => c.id);
  const guardAll = () => {
    if (state.clients.length === 0) { toast.error("لا يوجد عملاء"); return false; }
    return true;
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
            <Label>اختر السيد</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
              <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Btn icon={<User />} label="كشف تفصيلي — هذا السيد" onClick={() => {
            const c = state.clients.find((x) => x.id === clientId);
            if (!c) { toast.error("اختر عميلاً"); return; }
            openStatementPDF([c.id], { title: `كشف حساب — ${c.name}` });
          }} />
          <Btn icon={<Users />} label="كشف تفصيلي — كل العملاء" onClick={() => {
            if (state.clients.length === 0) { toast.error("لا يوجد عملاء"); return; }
            openStatementPDF(state.clients.map((c) => c.id), { title: "كشف حسابات كل العملاء" });
          }} />
          <Btn icon={<Download />} label="تنزيل كشف هذا السيد (إلى التنزيلات)" onClick={() => {
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
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div className="grid gap-1.5">
            <Label>اختر السيد لتصدير كشفه PDF</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
              <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Btn icon={<FileDown />} label="كشف حساب عميل PDF" onClick={async () => {
            const c = state.clients.find((x) => x.id === clientId);
            if (!c) { toast.error("اختر عميلاً"); return; }
            toast.info("جاري إنشاء ملف PDF...");
            try { await downloadStatementPDF([c.id], { title: `كشف-حساب-${c.name}` }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <Btn icon={<Share2 />} label="مشاركة عبر واتساب" onClick={shareWhatsapp} />
          <Btn icon={<MessageCircle />} label="إرسال كشف السيد PDF إلى واتساب السيد" onClick={async () => {
            const c = state.clients.find((x) => x.id === clientId);
            if (!c) { toast.error("اختر عميلاً"); return; }
            toast.info("جاري تجهيز الكشف...");
            try {
              const r = await sendClientStatementToWhatsapp(c.id);
              if (r === "shared") { toast.success("تمت المشاركة"); return; }
              toast.success("تم تنزيل الكشف — أرفقه في محادثة واتساب");
              sendWhatsapp(c.phone, buildBalanceMessage(c.id));
            } catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
        </div>
      </section>

      <section className="mt-6">
        <h3 className="font-bold text-primary mb-3 text-sm">تصدير حسب نوع الرصيد</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Btn icon={<TrendingUp />} label="PDF — كل العملاء دائن (له)" onClick={async () => {
            const s = getState();
            const ids = s.clients.filter((c) => clientBalance(s, c.id) > 0).map((c) => c.id);
            if (!ids.length) { toast.error("لا يوجد عملاء دائنون"); return; }
            toast.info("جاري إنشاء ملف PDF...");
            try { await downloadStatementPDF(ids, { title: "كشف-العملاء-الدائنين-له" }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <Btn icon={<TrendingDown />} label="PDF — كل العملاء مدين (عليه)" onClick={async () => {
            const s = getState();
            const ids = s.clients.filter((c) => clientBalance(s, c.id) < 0).map((c) => c.id);
            if (!ids.length) { toast.error("لا يوجد عملاء مدينون"); return; }
            toast.info("جاري إنشاء ملف PDF...");
            try { await downloadStatementPDF(ids, { title: "كشف-العملاء-المدينين-عليه" }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
        </div>
      </section>

      <section className="mt-6">
        <h3 className="font-bold text-primary mb-3 text-sm">تصدير كل العملاء — PDF (إلى التنزيلات)</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Btn icon={<FileDown />} label="PDF — كشف تفصيلي لكل العملاء" onClick={async () => {
            if (!guardAll()) return;
            toast.info("جاري إنشاء ملف PDF...");
            try { await downloadStatementPDF(allIds(), { title: "كشف-تفصيلي-كل-العملاء" }); toast.success("تم التنزيل"); }
            catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
          }} />
          <Btn icon={<FileDown />} label="PDF — كشف إجمالي لكل العملاء" onClick={async () => {
            if (!guardAll()) return;
            const s = getState();
            const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف إجمالي</title>
<style>body{font-family:"Cairo","Tajawal",Arial,sans-serif;padding:16px;color:#111}
h1{color:#1a4b8f;text-align:center;margin:8px 0}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
th,td{border:1px solid #bbb;padding:8px;text-align:center}
th{background:#e9e9e9}
.name{text-align:right}
.bal{font-weight:800;color:#c0392b}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;padding-bottom:8px}
.logo{width:60px;height:60px;object-fit:contain}</style></head><body>
<div class="header"><div>${s.company.logo ? `<img class="logo" src="${s.company.logo}">` : ""}</div>
<div style="text-align:left"><div style="font-weight:800">${s.company.name}</div><div style="font-size:12px">${s.company.phone ?? ""}</div></div></div>
<h1>كشف إجمالي — كل العملاء</h1>
<table><thead><tr><th>#</th><th>الاسم</th><th>الهاتف</th><th>الرصيد الإجمالي</th></tr></thead><tbody>
${s.clients.map((c, i) => `<tr><td>${i + 1}</td><td class="name">${c.name}</td><td>${c.phone ?? "—"}</td><td class="bal">${formatCurrency(clientBalance(s, c.id))}</td></tr>`).join("")}
</tbody></table></body></html>`;
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:1200px";
            document.body.appendChild(iframe);
            const doc = iframe.contentDocument!;
            doc.open(); doc.write(html); doc.close();
            await new Promise((r) => setTimeout(r, 300));
            try {
              const { default: jsPDF } = await import("jspdf");
              const html2canvas = (await import("html2canvas")).default;
              const canvas = await html2canvas(doc.body, { scale: 2, backgroundColor: "#fff" });
              const pdf = new jsPDF({ unit: "mm", format: "a4" });
              const w = pdf.internal.pageSize.getWidth();
              const h = (canvas.height * w) / canvas.width;
              pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
              pdf.save("كشف-اجمالي-كل-العملاء-" + new Date().toISOString().slice(0, 10) + ".pdf");
              toast.success("تم التنزيل");
            } catch (e) { toast.error("تعذّر إنشاء PDF"); console.error(e); }
            document.body.removeChild(iframe);
          }} />
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
