import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { setState, useAppState, type Company } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/company")({ component: CompanyPage });

function CompanyPage() {
  const company = useAppState((s) => s.company);
  const [form, setForm] = useState<Company>(company);
  return (
    <AppShell>
      <PageHeader title="إعدادات الشركة" subtitle="تظهر هذه البيانات تلقائياً في كشوف الحسابات والتقارير" />
      <div className="grid gap-3 max-w-lg">
        <F label="اسم الشركة"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
        <F label="الهاتف"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
        <F label="العنوان"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
        <F label="البريد الإلكتروني"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
        <F label="رابط الشعار (URL)"><Input value={form.logo ?? ""} onChange={(e) => setForm({ ...form, logo: e.target.value })} /></F>
        <F label="ملاحظات"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        <Button onClick={() => { setState((s) => ({ ...s, company: form })); toast.success("تم حفظ بيانات الشركة"); }}>حفظ</Button>
      </div>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}