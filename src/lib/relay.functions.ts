import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const enc = new TextEncoder();
const dec = new TextDecoder();

async function aesKey(): Promise<CryptoKey> {
  const secret = process.env["NOTIFICATION_RELAY_ENCRYPTION_KEY"];
  if (!secret) throw new Error("مفتاح التشفير غير مهيأ");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function encrypt(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(text)));
  return `${b64(iv)}.${b64(ct)}`;
}
async function decrypt(blob: string): Promise<string> {
  const [iv, ct] = blob.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv!) }, await aesKey(), unb64(ct!));
  return dec.decode(pt);
}

// يمنع إرسال الطلبات إلى عناوين داخلية أو غير آمنة
export function isSafeRelayUrl(value: string): boolean {
  let u: URL;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") && !h.includes(":")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168) || (a === 100 && b! >= 64 && b! <= 127) || a! >= 224) return false;
  }
  if (h.includes(":")) {
    if (h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:")) return false;
  }
  return true;
}

const headerSchema = z.enum(["Authorization", "X-API-Key"]);

async function postToRelay(url: string, apiKey: string, header: string, body: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (header === "X-API-Key") headers["X-API-Key"] = apiKey; else headers["Authorization"] = `Bearer ${apiKey}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), redirect: "manual", signal: ctrl.signal });
    const text = (await res.text()).slice(0, 300);
    return { ok: res.ok, status: res.status, error: res.ok ? null : `رد تطبيق الإشعارات ${res.status}${text ? `: ${text}` : ""}` };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error && e.name === "AbortError" ? "انتهت مهلة الاتصال" : "تعذّر الاتصال بتطبيق الإشعارات" };
  } finally { clearTimeout(t); }
}

export const getRelayConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("notification_relay_settings")
      .select("url, auth_header, enabled, updated_at").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("تعذّر قراءة إعدادات الربط");
    return data ? { connected: true, url: data.url, authHeader: data.auth_header, enabled: data.enabled, updatedAt: data.updated_at } : { connected: false, url: "", authHeader: "Authorization", enabled: false, updatedAt: null };
  });

export const saveRelayConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().trim().max(500), apiKey: z.string().trim().max(1000).optional(), authHeader: headerSchema, enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!isSafeRelayUrl(data.url)) throw new Error("الرابط يجب أن يكون https لعنوان عام صالح");
    const row: { user_id: string; url: string; auth_header: string; enabled: boolean; updated_at: string; encrypted_api_key?: string } =
      { user_id: context.userId, url: data.url, auth_header: data.authHeader, enabled: data.enabled, updated_at: new Date().toISOString() };
    if (data.apiKey) row.encrypted_api_key = await encrypt(data.apiKey);
    else {
      const { data: existing } = await context.supabase.from("notification_relay_settings").select("user_id").eq("user_id", context.userId).maybeSingle();
      if (!existing) throw new Error("أدخل مفتاح الربط");
    }
    const q = row.encrypted_api_key
      ? context.supabase.from("notification_relay_settings").upsert(row as never, { onConflict: "user_id" })
      : context.supabase.from("notification_relay_settings").update(row).eq("user_id", context.userId);
    const { error } = await q;
    if (error) throw new Error("تعذّر حفظ الربط");
    return { ok: true };
  });

export const disconnectRelay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("notification_relay_settings").delete().eq("user_id", context.userId);
    if (error) throw new Error("تعذّر فصل الاتصال");
    return { ok: true };
  });

export const testRelayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().trim().max(500), apiKey: z.string().trim().max(1000).optional(), authHeader: headerSchema, companyName: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!isSafeRelayUrl(data.url)) return { ok: false, error: "الرابط يجب أن يكون https لعنوان عام صالح" };
    let key = data.apiKey;
    if (!key) {
      const { data: row } = await context.supabase.from("notification_relay_settings").select("encrypted_api_key").eq("user_id", context.userId).maybeSingle();
      if (!row) return { ok: false, error: "أدخل مفتاح الربط" };
      key = await decrypt(row.encrypted_api_key);
    }
    const r = await postToRelay(data.url, key, data.authHeader, { type: "connection_test", source: "نظام المحاسب المطور", company: { name: data.companyName }, sentAt: new Date().toISOString() });
    return { ok: r.ok, error: r.error };
  });

const recipientSchema = z.object({
  clientId: z.string().max(100), clientName: z.string().max(200), phone: z.string().max(40).optional(),
  role: z.string().max(40).optional(), balance: z.number().optional(), balanceLabel: z.string().max(20).optional(),
  message: z.string().max(4000),
});
const eventSchema = z.object({
  eventId: z.string().min(1).max(200),
  action: z.enum(["created", "updated"]),
  kind: z.string().max(40),
  company: z.object({ name: z.string().max(200), phone: z.string().max(60).optional() }),
  operation: z.object({
    number: z.string().max(60).optional(), typeLabel: z.string().max(100).optional(), amount: z.number().optional(),
    currency: z.string().max(10).optional(), date: z.string().max(40).optional(), description: z.string().max(1000).optional(),
  }),
  recipients: z.array(recipientSchema).min(1).max(5),
});

export const sendRelayEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => eventSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: cfg } = await context.supabase.from("notification_relay_settings").select("*").eq("user_id", context.userId).maybeSingle();
    if (!cfg || !cfg.enabled) return { ok: false, skipped: true, error: null };
    if (!isSafeRelayUrl(cfg.url)) return { ok: false, skipped: false, error: "رابط غير صالح" };
    const key = await decrypt(cfg.encrypted_api_key);
    const r = await postToRelay(cfg.url, key, cfg.auth_header, { type: "operation", source: "نظام المحاسب المطور", sentAt: new Date().toISOString(), ...data });
    await context.supabase.from("notification_relay_attempts").insert({ user_id: context.userId, event_id: data.eventId, status: r.ok ? "accepted" : "failed", http_status: r.status, error: r.error });
    return { ok: r.ok, skipped: false, error: r.error };
  });

export const listRelayAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("notification_relay_attempts").select("id, event_id, status, http_status, error, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(15);
    return data ?? [];
  });
