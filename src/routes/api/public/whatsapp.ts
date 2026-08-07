import { createFileRoute } from "@tanstack/react-router";

// ويب هوك ميتا / WhatsApp Business — التحقق (GET) واستقبال الأحداث (POST)
export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("wa_config").select("webhook_verify_token").eq("id", "default").maybeSingle();
        const expected = (cfg?.webhook_verify_token ?? "").trim();
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as unknown;
        if (!body || typeof body !== "object") return new Response("ok");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const entries = (body as { entry?: unknown[] }).entry ?? [];
        const rows: Record<string, unknown>[] = [];
        for (const entry of entries) {
          const changes = (entry as { changes?: unknown[] }).changes ?? [];
          for (const change of changes) {
            const value = (change as { value?: Record<string, unknown> }).value ?? {};
            for (const st of (value["statuses"] as { id?: string; status?: string }[] | undefined) ?? []) {
              rows.push({ event_type: `status.${st.status ?? "unknown"}`, provider_message_id: st.id ?? null, payload: st as unknown as object });
              if (st.id && st.status) {
                await supabaseAdmin.from("wa_messages").update({ status: st.status }).eq("provider_message_id", st.id);
              }
            }
            for (const msg of (value["messages"] as { id?: string; from?: string }[] | undefined) ?? []) {
              rows.push({ event_type: "message.inbound", provider_message_id: msg.id ?? null, from_phone: msg.from ?? null, payload: msg as unknown as object });
            }
          }
        }
        if (rows.length) await supabaseAdmin.from("wa_events").insert(rows as never);
        return new Response("ok");
      },
    },
  },
});
