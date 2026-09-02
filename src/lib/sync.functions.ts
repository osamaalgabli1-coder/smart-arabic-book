import { createServerFn } from "@tanstack/react-start";

// ---------- أنواع مشتركة ----------
export type DeviceRow = {
  id: string;
  device_id: string;
  name: string;
  platform: string;
  status: string;
  is_owner: boolean;
  last_seen: string | null;
};

type Ctx = { code: string; deviceId: string };

const codeGen = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// إنشاء مكتب جديد (الجهاز الرئيسي)
export const createWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: { deviceId: string; deviceName: string; platform: string; workspaceName?: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let code = codeGen();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabaseAdmin.from("sync_workspaces").select("id").eq("code", code).maybeSingle();
      if (!exists) break;
      code = codeGen();
    }
    const { data: ws, error } = await supabaseAdmin
      .from("sync_workspaces")
      .insert({ code, name: data.workspaceName || "مكتبي", owner_device_id: data.deviceId, max_devices: 4 })
      .select("id, code, name, max_devices")
      .single();
    if (error || !ws) throw new Error(error?.message || "تعذر إنشاء المكتب");
    await supabaseAdmin.from("sync_devices").insert({
      workspace_id: ws.id, device_id: data.deviceId, name: data.deviceName,
      platform: data.platform, status: "approved", is_owner: true, last_seen: new Date().toISOString(),
    });
    await supabaseAdmin.from("sync_snapshots").insert({ workspace_id: ws.id, data: {}, version: 0 });
    return { code: ws.code, name: ws.name, maxDevices: ws.max_devices };
  });

async function loadCtx(ctx: Ctx) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ws } = await supabaseAdmin
    .from("sync_workspaces")
    .select("id, code, name, owner_device_id, max_devices")
    .eq("code", ctx.code.trim().toUpperCase())
    .maybeSingle();
  if (!ws) throw new Error("رمز المكتب غير صحيح");
  const { data: dev } = await supabaseAdmin
    .from("sync_devices")
    .select("id, device_id, status, is_owner")
    .eq("workspace_id", ws.id)
    .eq("device_id", ctx.deviceId)
    .maybeSingle();
  return { supabaseAdmin, ws, dev };
}

// طلب اشتراك جهاز جديد — ينتظر موافقة الجهاز الرئيسي
export const requestJoin = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; deviceId: string; deviceName: string; platform: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, ws, dev } = await loadCtx(data);
    if (dev) return { status: dev.status, workspaceName: ws.name };
    const { count } = await supabaseAdmin
      .from("sync_devices").select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.id).eq("status", "approved");
    if ((count ?? 0) >= ws.max_devices) throw new Error(`تم بلوغ الحد الأقصى للأجهزة (${ws.max_devices})`);
    await supabaseAdmin.from("sync_devices").insert({
      workspace_id: ws.id, device_id: data.deviceId, name: data.deviceName,
      platform: data.platform, status: "pending", last_seen: new Date().toISOString(),
    });
    return { status: "pending", workspaceName: ws.name };
  });

// حالة الجهاز + قائمة الأجهزة (للجهاز الرئيسي)
export const getSyncStatus = createServerFn({ method: "POST" })
  .inputValidator((d: Ctx) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, ws, dev } = await loadCtx(data);
    if (dev) {
      await supabaseAdmin.from("sync_devices").update({ last_seen: new Date().toISOString() }).eq("id", dev.id);
    }
    const { data: devices } = await supabaseAdmin
      .from("sync_devices")
      .select("id, device_id, name, platform, status, is_owner, last_seen")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: true });
    const { data: snap } = await supabaseAdmin
      .from("sync_snapshots").select("version, updated_at, updated_by").eq("workspace_id", ws.id).maybeSingle();
    return {
      workspaceName: ws.name,
      maxDevices: ws.max_devices,
      isOwner: Boolean(dev?.is_owner),
      status: dev?.status ?? "none",
      devices: (devices ?? []) as DeviceRow[],
      version: snap?.version ?? 0,
      updatedAt: snap?.updated_at ?? null,
      updatedBy: snap?.updated_by ?? null,
    };
  });

// موافقة/رفض/حذف جهاز — من الجهاز الرئيسي فقط
export const manageDevice = createServerFn({ method: "POST" })
  .inputValidator((d: Ctx & { targetDeviceId: string; action: "approve" | "reject" | "remove" }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, ws, dev } = await loadCtx(data);
    if (!dev?.is_owner) throw new Error("هذه العملية من الجهاز الرئيسي فقط");
    if (data.action === "approve") {
      const { count } = await supabaseAdmin
        .from("sync_devices").select("id", { count: "exact", head: true })
        .eq("workspace_id", ws.id).eq("status", "approved");
      if ((count ?? 0) >= ws.max_devices) throw new Error(`تم بلوغ الحد الأقصى للأجهزة (${ws.max_devices})`);
      await supabaseAdmin.from("sync_devices").update({ status: "approved" })
        .eq("workspace_id", ws.id).eq("device_id", data.targetDeviceId);
    } else if (data.action === "reject") {
      await supabaseAdmin.from("sync_devices").update({ status: "rejected" })
        .eq("workspace_id", ws.id).eq("device_id", data.targetDeviceId);
    } else {
      await supabaseAdmin.from("sync_devices").delete()
        .eq("workspace_id", ws.id).eq("device_id", data.targetDeviceId).eq("is_owner", false);
    }
    return { ok: true };
  });

// تغيير الحد الأقصى للأجهزة (قابل للزيادة)
export const setMaxDevices = createServerFn({ method: "POST" })
  .inputValidator((d: Ctx & { maxDevices: number }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, ws, dev } = await loadCtx(data);
    if (!dev?.is_owner) throw new Error("هذه العملية من الجهاز الرئيسي فقط");
    const max = Math.max(1, Math.min(50, Math.floor(data.maxDevices)));
    await supabaseAdmin.from("sync_workspaces").update({ max_devices: max }).eq("id", ws.id);
    return { maxDevices: max };
  });

// رفع بيانات النظام
export const pushSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d: Ctx & { data: unknown; deviceName?: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, ws, dev } = await loadCtx(data);
    if (dev?.status !== "approved") throw new Error("الجهاز غير معتمد بعد");
    const { data: cur } = await supabaseAdmin
      .from("sync_snapshots").select("version").eq("workspace_id", ws.id).maybeSingle();
    const version = (cur?.version ?? 0) + 1;
    await supabaseAdmin.from("sync_snapshots").upsert(
      { workspace_id: ws.id, data: data.data as never, version, updated_by: data.deviceName || data.deviceId },
      { onConflict: "workspace_id" },
    );
    return { version };
  });

// تنزيل بيانات النظام
export const pullSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d: Ctx & { since?: number }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, ws, dev } = await loadCtx(data);
    if (dev?.status !== "approved") return { status: dev?.status ?? "none", version: 0, data: null };
    await supabaseAdmin.from("sync_devices").update({ last_seen: new Date().toISOString() }).eq("id", dev.id);
    const { data: snap } = await supabaseAdmin
      .from("sync_snapshots").select("data, version, updated_by, updated_at").eq("workspace_id", ws.id).maybeSingle();
    const version = snap?.version ?? 0;
    if (data.since !== undefined && version <= data.since) {
      return { status: "approved", version, data: null };
    }
    return { status: "approved", version, data: snap?.data ?? null, updatedBy: snap?.updated_by ?? null };
  });
