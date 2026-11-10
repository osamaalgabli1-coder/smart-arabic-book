import { getState, clientBalances, voucherTypeLabels, uid, type Client, type Voucher, type Transfer, type Currency } from "@/lib/store";
import { buildVoucherMessage, buildTransferMessage } from "@/lib/whatsapp";
import { sendRelayEvent } from "@/lib/relay.functions";
import { supabase } from "@/integrations/supabase/client";

const THANKS = "شكراً لتعاملكم معنا";

function recipient(c: Client | undefined, cur: Currency, message: string, role?: string) {
  if (!c) return null;
  const bal = clientBalances(getState(), c.id)[cur] || 0;
  return {
    clientId: c.id, clientName: c.name, phone: c.phone || undefined, role,
    balance: Math.abs(bal), balanceLabel: bal >= 0 ? "لكم" : "عليكم",
    message: message.replace(/شكراً لتعاملكم معنا.*$/m, THANKS),
  };
}

// يُرسل بعد نجاح الحفظ فقط؛ أي فشل لا يمس الحسابات أو العمليات
async function dispatch(payload: Parameters<typeof sendRelayEvent>[0]["data"]) {
  try {
    if (!getState().settings.notificationRelayEnabled) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const r = await sendRelayEvent({ data: payload });
    if (!r.ok && !r.skipped) console.warn("Notification relay failed:", r.error);
  } catch (e) {
    console.warn("Notification relay error", e);
  }
}

function company() {
  const s = getState();
  return { name: s.company.name, phone: s.company.phone || undefined };
}

export function relayVoucher(v: Voucher, action: "created" | "updated") {
  const s = getState();
  const from = s.clients.find((c) => c.id === v.clientId);
  const to = s.clients.find((c) => c.id === v.toClientId);
  const recipients = [
    recipient(from, v.currency, buildVoucherMessage(v, "from"), v.type === "compound" ? "مدين" : undefined),
    v.type === "compound" ? recipient(to, v.currency, buildVoucherMessage(v, "to"), "دائن") : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);
  if (!recipients.length) return;
  void dispatch({
    eventId: `voucher:${v.id}:${action}:${uid()}`, action, kind: `voucher.${v.type}`, company: company(),
    operation: { number: v.number, typeLabel: voucherTypeLabels[v.type], amount: v.amount, currency: v.currency, date: v.date, description: v.description || undefined },
    recipients,
  });
}

export function relayTransfer(t: Transfer, action: "created" | "updated") {
  const c = getState().clients.find((x) => x.id === t.clientId);
  const r = recipient(c, t.currency, buildTransferMessage(t));
  if (!r) return;
  void dispatch({
    eventId: `transfer:${t.id}:${action}:${uid()}`, action, kind: "transfer", company: company(),
    operation: { number: t.number, typeLabel: `حوالة ${t.transferType}`, amount: t.amount, currency: t.currency, date: t.date, description: t.description || undefined },
    recipients: [r],
  });
}

export function relayClient(c: Client, action: "created" | "updated") {
  const cur = c.openingCurrency ?? "YER";
  const msg = [`📄 *${action === "created" ? "تم فتح حساب جديد" : "تحديث بيانات الحساب"}*`, `*${getState().company.name}*`, `👤 السيد: ${c.name}`, "", THANKS].join("\n");
  const r = recipient(c, cur, msg);
  if (!r) return;
  void dispatch({
    eventId: `client:${c.id}:${action}:${uid()}`, action, kind: "client", company: company(),
    operation: { typeLabel: action === "created" ? "إضافة سيد جديد" : "تعديل بيانات السيد", amount: c.openingBalance || 0, currency: cur, date: new Date().toISOString().slice(0, 10) },
    recipients: [r],
  });
}
