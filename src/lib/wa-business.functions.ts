import { createServerFn } from "@tanstack/react-start";

export type WaConfigPublic = {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
  webhookVerifyToken: string;
  defaultTemplate: string;
  defaultLang: string;
  hasToken: boolean;
};

function normPhone(p?: string | null): string {
  if (!p) return "";
  let s = String(p).replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);
  if (s.length === 9 && s.startsWith("7")) s = "967" + s;
  return s;
}

export const getWaConfig = createServerFn({ method: "GET" }).handler(async (): Promise<WaConfigPublic> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("wa_config").select("*").eq("id", "default").maybeSingle();
  return {
    enabled: Boolean(data?.enabled),
    phoneNumberId: data?.phone_number_id ?? "",
    businessAccountId: data?.business_account_id ?? "",
    apiVersion: data?.api_version ?? "v21.0",
    webhookVerifyToken: data?.webhook_verify_token ?? "",
    defaultTemplate: data?.default_template ?? "",
    defaultLang: data?.default_lang ?? "ar",
    hasToken: Boolean(data?.access_token),
  };
});

export const saveWaConfig = createServerFn({ method: "POST" })
  .inputValidator((d: {
    enabled: boolean;
    phoneNumberId: string;
    businessAccountId: string;
    apiVersion: string;
    webhookVerifyToken: string;
    defaultTemplate: string;
    defaultLang: string;
    accessToken?: string;
  }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row: Record<string, unknown> = {
      id: "default",
      enabled: data.enabled,
      phone_number_id: data.phoneNumberId.trim(),
      business_account_id: data.businessAccountId.trim(),
      api_version: data.apiVersion.trim() || "v21.0",
      webhook_verify_token: data.webhookVerifyToken.trim(),
      default_template: data.defaultTemplate.trim(),
      default_lang: data.defaultLang.trim() || "ar",
    };
    const token = (data.accessToken ?? "").trim();
    if (token) row["access_token"] = token;
    const { error } = await supabaseAdmin.from("wa_config").upsert(row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertWaRecipient = createServerFn({ method: "POST" })
  .inputValidator((d: {
    clientId: string; clientName?: string; phone?: string;
    groupId?: string; groupLink?: string;
    notifyWhatsapp?: boolean; notifyGroup?: boolean; active?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wa_recipients").upsert({
      client_id: data.clientId,
      client_name: data.clientName ?? null,
      phone: normPhone(data.phone) || null,
      group_id: data.groupId?.trim() || null,
      group_link: data.groupLink?.trim() || null,
      notify_whatsapp: data.notifyWhatsapp ?? true,
      notify_group: data.notifyGroup ?? false,
      active: data.active ?? true,
    }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWaMessages = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number; clientId?: string } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("wa_messages").select("*").order("created_at", { ascending: false }).limit(data.limit ?? 30);
    if (data.clientId) q = q.eq("client_id", data.clientId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id, clientName: r.client_name, toPhone: r.to_phone, body: r.body,
      status: r.status, error: r.error, refNumber: r.ref_number, createdAt: r.created_at,
    }));
  });

/** إرسال فوري عبر WhatsApp Business Cloud API (ميتا) مع تسجيل كامل في قاعدة البيانات */
export const sendWaBusinessMessage = createServerFn({ method: "POST" })
  .inputValidator((d: {
    message: string; phone?: string; clientId?: string; clientName?: string;
    refNumber?: string; kind?: string; groupId?: string;
  }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("wa_config").select("*").eq("id", "default").maybeSingle();

    const to = normPhone(data.phone);
    const logBase = {
      client_id: data.clientId ?? null,
      client_name: data.clientName ?? null,
      channel: data.groupId ? "group" : "whatsapp",
      kind: data.kind ?? "notification",
      ref_number: data.refNumber ?? null,
      to_phone: to || null,
      group_id: data.groupId ?? null,
      body: data.message,
    };

    const fail = async (reason: string) => {
      await supabaseAdmin.from("wa_messages").insert({ ...logBase, status: "failed", error: reason });
      return { ok: false as const, error: reason };
    };

    if (!cfg?.enabled) return await fail("خدمة WhatsApp Business غير مفعّلة في الإعدادات");
    if (!cfg.access_token || !cfg.phone_number_id) return await fail("لم يتم إدخال رمز الوصول أو معرّف رقم الهاتف من ميتا");
    if (!to) return await fail("لا يوجد رقم واتساب صالح للمستلم");

    try {
      const url = `https://graph.facebook.com/${cfg.api_version || "v21.0"}/${cfg.phone_number_id}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: data.message },
        }),
      });
      const json = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } };
      if (!res.ok) return await fail(json.error?.message || `HTTP ${res.status}`);
      const providerId = json.messages?.[0]?.id ?? null;
      await supabaseAdmin.from("wa_messages").insert({ ...logBase, status: "sent", provider_message_id: providerId });
      return { ok: true as const, providerMessageId: providerId };
    } catch (e) {
      return await fail(e instanceof Error ? e.message : "تعذّر الاتصال بخوادم ميتا");
    }
  });
