import { getState, formatCurrency, voucherTypeLabels, clientBalances, companyDisplayName, CURRENCIES, type Voucher, type Transfer, type Currency } from "@/lib/store";
import { toast } from "sonner";
import { sendWaBusinessMessage } from "@/lib/wa-business.functions";

function normPhone(p?: string): string {
  if (!p) return "";
  let s = p.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);
  // Yemen fallback: 9-digit local -> +967
  if (s.length === 9 && s.startsWith("7")) s = "967" + s;
  return s;
}

function fmtDateTime(d: string): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${d} ${hh}:${mm}`;
}

export function buildVoucherMessage(v: Voucher, role: "from" | "to" = "from"): string {
  const s = getState();
  const company = companyDisplayName(s);
  const isCompound = v.type === "compound";
  const targetId = role === "to" ? v.toClientId : v.clientId;
  const otherId = role === "to" ? v.clientId : v.toClientId;
  const client = s.clients.find((c) => c.id === targetId);
  const other = s.clients.find((c) => c.id === otherId);
  const bals = targetId ? clientBalances(s, targetId) : null;
  const cur: Currency = v.currency;
  const bal = bals ? bals[cur] : 0;
  // For compound: "from" client is مدين (عليه), "to" client is دائن (له)
  let label = voucherTypeLabels[v.type];
  let commission = v.commission || 0;
  let compoundLine = "";
  if (isCompound) {
    if (role === "from") {
      label = "قيد بسيط — مدين (عليه)";
      commission = v.commission || 0;
      compoundLine = other ? `📝 البيان: عليكم إلى حساب ${other.name}` : "";
    } else {
      label = "قيد بسيط — دائن (له)";
      commission = v.commissionTo || 0;
      compoundLine = other ? `📝 البيان: لكم من حساب ${other.name}` : "";
    }
  }
  const lines = [
    `📄 *إشعار سند*`,
    `${company}`,
    client ? `👤 السيد: ${client.name}` : "",
    `🧾 رقم السند: ${v.number}`,
    `📅 التاريخ: ${fmtDateTime(v.date)}`,
    `⚙️ نوع العملية: ${label}`,
    isCompound && other ? `🔁 الطرف الآخر: ${other.name}` : "",
    `💵 المبلغ: ${formatCurrency(v.amount, cur)}`,
    commission ? `➕ العمولة: ${formatCurrency(commission, cur)}` : "",
    isCompound ? [compoundLine, v.description ? `🗒️ ملاحظات: ${v.description}` : ""].filter(Boolean).join("\n") : (v.description ? `📝 البيان: ${v.description}` : ""),
    bals ? `📊 الرصيد الحالي: ${formatCurrency(Math.abs(bal), cur)} ${bal >= 0 ? "لكم" : "عليكم"}` : "",
    ``,
    `شكراً لتعاملكم معنا 🌹`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildTransferMessage(t: Transfer): string {
  const s = getState();
  const client = s.clients.find((c) => c.id === t.clientId);
  const bals = t.clientId ? clientBalances(s, t.clientId) : null;
  const bal = bals ? bals[t.currency] : 0;
  const lines = [
    `📄 *إشعار حوالة*`,
    `${companyDisplayName(s)}`,
    client ? `👤 السيد: ${client.name}` : "",
    `🧾 رقم الحوالة: ${t.number}`,
    `📅 التاريخ: ${fmtDateTime(t.date)}`,
    `⚙️ النوع: حوالة ${t.transferType}`,
    `👤 المرسل: ${t.sender}`,
    `👥 المستلم: ${t.receiver}`,
    `💵 المبلغ: ${formatCurrency(t.amount, t.currency)}`,
    (t.outgoingFee || t.incomingFee) ? `➕ العمولة: ${formatCurrency((t.outgoingFee || 0) + (t.incomingFee || 0), t.currency)}` : "",
    t.description ? `📝 البيان: ${t.description}` : "",
    bals && client ? `📊 الرصيد الحالي: ${formatCurrency(Math.abs(bal), t.currency)} ${bal >= 0 ? "لكم" : "عليكم"}` : "",
    ``,
    `شكراً لتعاملكم معنا 🌹`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function sendWhatsapp(phone: string | undefined, message: string, opts?: { silent?: boolean }) {
  const p = normPhone(phone);
  if (!p) {
    if (!opts?.silent) toast.error("لا يوجد رقم واتساب للعميل");
    return false;
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  // على أنظمة الويندوز/الكمبيوتر: الإرسال مباشرة عبر جلسة واتساب ويب المفتوحة
  const url = isMobile
    ? `https://wa.me/${p}?text=${encodeURIComponent(message)}`
    : `https://web.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
  window.open(url, "wa_send");
  return true;
}

// ————— إرسال مباشر لواتساب السيد بدون فتح واتساب —————
// يتطلب ربط السيد بأداة إرسال (Webhook / CallMeBot). يدعم {message} و {phone} داخل الرابط.
export async function sendDirectWhatsapp(
  client: { phone?: string; waWebhook?: string; waApiKey?: string } | undefined,
  message: string,
  opts?: { silent?: boolean },
): Promise<boolean> {
  if (!client) return false;
  const phone = normPhone(client.phone);
  let hook = (client.waWebhook || "").trim();
  const key = (client.waApiKey || "").trim();
  // إن وُجد مفتاح CallMeBot فقط: نبني الرابط تلقائياً
  if (!hook && key && phone) {
    hook = `https://api.callmebot.com/whatsapp.php?phone=+${phone}&apikey=${encodeURIComponent(key)}&text={message}`;
  }
  if (!hook) return false;
  try {
    if (hook.includes("{message}")) {
      const url = hook.replace("{phone}", phone).replace("{message}", encodeURIComponent(message));
      await fetch(url, { mode: "no-cors" });
    } else {
      await fetch(hook, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, to: phone, message, text: message }),
      });
    }
    if (!opts?.silent) toast.success("تم إرسال الإشعار تلقائياً إلى واتساب السيد");
    return true;
  } catch {
    if (!opts?.silent) toast.error("تعذّر الإرسال التلقائي — تحقق من رابط الربط");
    return false;
  }
}

// رسالة إجمالي رصيد السيد — مدين عليكم / دائن لكم
export function buildBalanceMessage(clientId: string): string {
  const s = getState();
  const client = s.clients.find((c) => c.id === clientId);
  const bals = clientBalances(s, clientId);
  const parts: string[] = [];
  let anyCredit = false, anyDebit = false;
  for (const cur of CURRENCIES) {
    const b = bals[cur];
    if (!b) continue;
    if (b > 0) anyCredit = true; else anyDebit = true;
    parts.push(`• ${formatCurrency(Math.abs(b), cur)} ${b > 0 ? "لكم" : "عليكم"}`);
  }
  const head = anyCredit && !anyDebit ? "سند اشعار دائن لكم" : (!anyCredit && anyDebit ? "سند اشعار مدين عليكم" : "سند اشعار رصيد");
  const lines = [
    `📄 *${head}*`,
    `${companyDisplayName(s)}`,
    client ? `👤 السيد: ${client.name}` : "",
    `📅 التاريخ: ${fmtDateTime(new Date().toISOString().slice(0, 10))}`,
    `📊 *إجمالي الرصيد:*`,
    parts.length ? parts.join("\n") : "• لا يوجد رصيد",
    ``,
    `شكراً لتعاملكم معنا 🌹`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function maybeAutoSend(phone: string | undefined, message: string): void {
  const auto = getState().settings.whatsappAutoSend;
  if (!auto) return;
  if (!phone) return;
  if (!confirm("إرسال إشعار واتساب للعميل الآن؟")) return;
  sendWhatsapp(phone, message);
}

// إرسال عبر الرسائل النصية (SMS) عند تفعيلها في الإعدادات
export function sendSMS(phone: string | undefined, message: string): boolean {
  const p = normPhone(phone);
  if (!p) { toast.error("لا يوجد رقم هاتف للعميل"); return false; }
  window.location.href = `sms:+${p}?body=${encodeURIComponent(message)}`;
  return true;
}

export function maybeSendSMS(phone: string | undefined, message: string): void {
  if (!getState().settings.smsNotifications) return;
  if (!phone) return;
  sendSMS(phone, message);
}

// ————— إرسال إلى مجموعة واتساب —————
// إن وُجدت أداة ربط تلقائي (Webhook / CallMeBot) تُرسل الرسالة تلقائياً بدون فتح واتساب،
// وإلا يُفتح رابط المجموعة مع نسخ نص الرسالة للحافظة للصقها.
export async function sendToGroup(client: { groupInviteLink?: string; groupWebhook?: string }, message: string): Promise<boolean> {
  const hook = (client.groupWebhook || "").trim();
  if (hook) {
    try {
      if (hook.includes("{message}")) {
        await fetch(hook.replace("{message}", encodeURIComponent(message)), { mode: "no-cors" });
      } else {
        await fetch(hook, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, text: message }),
        });
      }
      toast.success("تم إرسال الإشعار إلى مجموعة واتساب");
      return true;
    } catch {
      toast.error("تعذّر الإرسال التلقائي إلى المجموعة");
    }
  }
  const link = (client.groupInviteLink || "").trim();
  if (!link) { toast.error("لم يتم ربط مجموعة واتساب لهذا السيد"); return false; }
  try { await navigator.clipboard.writeText(message); toast.success("تم نسخ الرسالة — الصقها في المجموعة"); } catch { /* ignore */ }
  window.open(link, "wa_group");
  return true;
}

// إرسال الإشعار عبر القنوات المفعّلة للعميل (نصية / واتساب / مجموعة واتساب)
// إرسال فوري عبر WhatsApp Business (ميتا) — بدون فتح واتساب إطلاقاً
export async function sendCloudWhatsapp(
  client: { id?: string; name?: string; phone?: string } | undefined,
  message: string,
  opts?: { silent?: boolean; refNumber?: string },
): Promise<boolean> {
  if (!client?.phone) return false;
  try {
    const res = await sendWaBusinessMessage({
      data: {
        message,
        phone: client.phone,
        clientId: client.id ?? "",
        clientName: client.name ?? "",
        refNumber: opts?.refNumber ?? "",
      },
    });
    if (res.ok) {
      if (!opts?.silent) toast.success("تم إرسال الإشعار فوراً عبر WhatsApp Business");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// إرسال الإشعار عبر القنوات المفعّلة للعميل (WhatsApp Business أولاً ثم البدائل)
export function notifyClient(
  client: { id?: string; name?: string; phone?: string; notifySms?: boolean; notifyWhatsapp?: boolean; notifyGroup?: boolean; groupInviteLink?: string; groupWebhook?: string; waWebhook?: string; waApiKey?: string } | undefined,
  message: string,
): void {
  if (!client) return;
  const any = client.notifySms || client.notifyWhatsapp || client.notifyGroup;
  const hasDirect = Boolean((client.waWebhook || "").trim() || (client.waApiKey || "").trim());

  void (async () => {
    // 1) القناة الرسمية: WhatsApp Business Cloud API عبر الخادم — إرسال فوري
    const sent = await sendCloudWhatsapp(client, message, { silent: true });
    if (sent) {
      if (client.notifyGroup) void sendToGroup(client, message);
      return;
    }
    // 2) البدائل عند عدم تفعيل الربط الرسمي
    if (!any) {
      if (hasDirect) { void sendDirectWhatsapp(client, message, { silent: true }); return; }
      maybeAutoSend(client.phone, message); maybeSendSMS(client.phone, message); return;
    }
    if (client.notifyGroup) void sendToGroup(client, message);
    if (client.notifyWhatsapp) {
      if (hasDirect) void sendDirectWhatsapp(client, message, { silent: true });
      else sendWhatsapp(client.phone, message, { silent: true });
    }
    if (client.notifySms) sendSMS(client.phone, message);
  })();
}
