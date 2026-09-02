import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Monitor, Check, X, Trash2, RefreshCw, Copy, Cloud, LogOut } from "lucide-react";
import {
  getLocal, setLocal, createOffice, joinOffice, statusOffice, deviceAction,
  changeMaxDevices, leaveOffice, startSync, push, getSyncInfo, watchSync, type DeviceRow,
} from "@/lib/sync";
import { toast } from "sonner";

export const Route = createFileRoute("/devices")({
  component: DevicesPage,
  head: () => ({
    meta: [
      { title: "الأجهزة والمزامنة — نظام المحاسب المطور" },
      { name: "description", content: "اربط حتى 4 أجهزة أو أكثر (أندرويد وويندوز) بموافقة الجهاز الرئيسي مع مزامنة كل البيانات لحظياً." },
      { property: "og:title", content: "الأجهزة والمزامنة" },
      { property: "og:description", content: "ربط عدة أجهزة بموافقة الجهاز الرئيسي ومزامنة البيانات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Status = Awaited<ReturnType<typeof statusOffice>>;

function DevicesPage() {
  const [local, setLocalState] = useState(() => getLocal());
  const [status, setStatus] = useState<Status>(null);
  const [joinCode, setJoinCode] = useState("");
  const [officeName, setOfficeName] = useState("مكتبي");
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);

  useEffect(() => watchSync(() => { setLocalState(getLocal()); force((n) => n + 1); }), []);

  const refresh = useCallback(async () => {
    try {
      const s = await statusOffice();
      setStatus(s);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => { void refresh(); }, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  const info = getSyncInfo();

  const create = async () => {
    setBusy(true);
    try {
      const res = await createOffice(officeName);
      toast.success(`تم إنشاء المكتب — رمز الاشتراك: ${res.code}`);
      await refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const join = async () => {
    setBusy(true);
    try {
      const res = await joinOffice(joinCode);
      toast.success(res.status === "approved" ? "تم الربط" : "تم إرسال الطلب — بانتظار موافقة الجهاز الرئيسي");
      await refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const act = async (d: DeviceRow, action: "approve" | "reject" | "remove") => {
    try {
      await deviceAction(d.device_id, action);
      toast.success(action === "approve" ? "تمت الموافقة على الجهاز" : action === "reject" ? "تم رفض الجهاز" : "تم حذف الجهاز");
      await refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <AppShell>
      <PageHeader title="الأجهزة والمزامنة" subtitle="اعمل من عدة أجهزة (أندرويد / ويندوز) بموافقة الجهاز الرئيسي" />

      <div className="bg-card border-2 border-border rounded-xl p-4 grid gap-3 mb-4">
        <div className="flex items-center gap-2 font-bold text-sm"><Cloud className="w-4 h-4 text-primary" /> حالة هذا الجهاز</div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold">اسم الجهاز</Label>
          <Input value={local.deviceName} onChange={(e) => setLocal({ deviceName: e.target.value })} />
        </div>
        <div className="text-xs text-muted-foreground">
          المنصة: {local.platform} • الحالة: {labelStatus(info.status)}{info.lastSync ? ` • آخر مزامنة ${info.lastSync}` : ""}
          {info.message ? ` • ${info.message}` : ""}
        </div>
      </div>

      {!local.code ? (
        <div className="grid gap-4">
          <div className="bg-card border-2 border-border rounded-xl p-4 grid gap-3">
            <div className="font-bold text-sm">الجهاز الرئيسي — إنشاء مكتب جديد</div>
            <Input value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="اسم المكتب" />
            <Button disabled={busy} onClick={create}>إنشاء مكتب ومزامنة بياناتي</Button>
          </div>
          <div className="bg-card border-2 border-border rounded-xl p-4 grid gap-3">
            <div className="font-bold text-sm">جهاز إضافي — الاشتراك برمز المكتب</div>
            <Input dir="ltr" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" />
            <Button variant="outline" disabled={busy} onClick={join}>إرسال طلب اشتراك</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="bg-card border-2 border-border rounded-xl p-4 grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-sm">{status?.workspaceName ?? "المكتب"}</div>
                <div className="text-xs text-muted-foreground">رمز الاشتراك</div>
              </div>
              <div className="flex items-center gap-2">
                <span dir="ltr" className="font-black text-lg text-primary tracking-widest">{local.code}</span>
                <Button size="icon" variant="ghost" onClick={() => { void navigator.clipboard.writeText(local.code); toast.success("تم نسخ الرمز"); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { startSync(); void push(); toast.success("تمت المزامنة"); }}>
                <RefreshCw className="w-4 h-4 ml-1" /> مزامنة الآن
              </Button>
              <Button variant="destructive" onClick={() => { leaveOffice(); setStatus(null); toast.success("تم فصل الجهاز"); }}>
                <LogOut className="w-4 h-4 ml-1" /> فصل هذا الجهاز
              </Button>
            </div>
            {status?.isOwner && (
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">الحد الأقصى للأجهزة (قابل للزيادة)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    defaultValue={status.maxDevices}
                    onBlur={async (e) => {
                      const v = Number(e.target.value) || 4;
                      try { await changeMaxDevices(v); toast.success("تم تحديث الحد الأقصى"); await refresh(); }
                      catch (err) { toast.error((err as Error).message); }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <h3 className="text-xs font-bold text-muted-foreground">الأجهزة المشتركة {status ? `(${status.devices.length}/${status.maxDevices})` : ""}</h3>
            {(status?.devices ?? []).map((d) => (
              <div key={d.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                {d.platform === "windows" || d.platform === "mac" ? <Monitor className="w-5 h-5 text-primary" /> : <Smartphone className="w-5 h-5 text-primary" />}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{d.name}{d.is_owner ? " — رئيسي" : ""}{d.device_id === local.deviceId ? " (هذا الجهاز)" : ""}</div>
                  <div className="text-[11px] text-muted-foreground">{labelStatus(d.status)} • {d.platform}</div>
                </div>
                {status?.isOwner && !d.is_owner && (
                  <div className="flex gap-1">
                    {d.status !== "approved" && (
                      <Button size="icon" variant="ghost" title="موافقة" onClick={() => act(d, "approve")}><Check className="w-4 h-4 text-success" /></Button>
                    )}
                    {d.status !== "rejected" && (
                      <Button size="icon" variant="ghost" title="رفض" onClick={() => act(d, "reject")}><X className="w-4 h-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" title="حذف" onClick={() => act(d, "remove")}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function labelStatus(s: string): string {
  switch (s) {
    case "approved": return "معتمد ومتزامن";
    case "pending": return "بانتظار موافقة الجهاز الرئيسي";
    case "rejected": return "مرفوض";
    case "error": return "خطأ في المزامنة";
    case "off": return "غير مفعّل";
    default: return "غير مشترك";
  }
}
