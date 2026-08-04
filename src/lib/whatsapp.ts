import { getState, formatCurrency, voucherTypeLabels, clientBalances, companyDisplayName, CURRENCIES, type Voucher, type Transfer, type Currency } from "@/lib/store";
import { toast } from "sonner";

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
    client ? `👤 العميل: ${client.name}` : "",
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
    client ? `👤 العميل: ${client.name}` : "",
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

// رسالة إجمالي رصيد العميل — مدين عليكم / دائن لكم
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
    client ? `👤 العميل: ${client.name}` : "",
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
