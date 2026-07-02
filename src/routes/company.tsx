import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { setState, useAppState, type Company } from "@/lib/store";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Trash2, Repeat2 } from "lucide-react";

export const Route = createFileRoute("/company")({ component: CompanyPage });

function CompanyPage() {
  const company = useAppState((s) => s.company);
  const [form, setForm] = useState<Company>(company);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const onPick = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("حجم الصورة كبير جداً (الحد الأقصى 2MB)"); return; }
    const dataUrl = await readAsDataUrl(f);
    const next = { ...form, logo: dataUrl };
    setForm(next);
    setState((s) => ({ ...s, company: next }));
    toast.success("تم حفظ الشعار");
    input.value = "";
  };

  const deleteLogo = () => {
    const next = { ...form, logo: "" };
    setForm(next);
    setState((s) => ({ ...s, company: next }));
    toast.success("تم حذف الشعار");
  };

  return (
    <AppShell>
      <PageHeader title="إعدادات الشركة" subtitle="تظهر هذه البيانات تلقائياً في كشوف الحسابات والتقارير" />
      <div className="grid gap-3 max-w-lg">
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <Label className="text-xs font-semibold mb-2 block">شعار الشركة</Label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-background flex items-center justify-center overflow-hidden hover:border-primary transition"
            >
              {form.logo ? (
                <img src={form.logo} alt="شعار الشركة" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="w-4 h-4 ml-1" /> {form.logo ? "استبدال" : "من الجهاز"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                <Camera className="w-4 h-4 ml-1" /> الكاميرا
              </Button>
              {form.logo && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Repeat2 className="w-4 h-4 ml-1" /> تغيير
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={deleteLogo}>
                    <Trash2 className="w-4 h-4 ml-1" /> حذف
                  </Button>
                </>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPick(e.currentTarget)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPick(e.currentTarget)} />
          <p className="text-[11px] text-muted-foreground mt-2">يظهر الشعار في كشف الحساب والسندات والتقارير ورأس الصفحة الرئيسية.</p>
        </div>

        <F label="اسم الشركة"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
        <F label="الهاتف"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
        <F label="العنوان"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
        <F label="البريد الإلكتروني"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
        <F label="ملاحظات"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        <Button onClick={() => { setState((s) => ({ ...s, company: form })); toast.success("تم حفظ بيانات الشركة"); }}>حفظ</Button>
      </div>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}