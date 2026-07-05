import { getState, formatCurrency, voucherTypeLabels, clientBalances, type Voucher, type Transfer, type Currency } from "@/lib/store";
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

export function buildVoucherMessage(v: Voucher): string {
  const s = getState();
  const company = s.company.name;
  const client = s.clients.find((c) => c.id === v.clientId);
  const bals = v.clientId ? clientBalances(s, v.clientId) : null;
  const cur: Currency = v.currency;
  const bal = bals ? bals[cur] : 0;
  const label = voucherTypeLabels[v.type];
  const lines = [
    `📄 *إشعار سند*`,
    `🏢 الشركة: ${company}`,
    client ? `👤 العميل: ${client.name}` : "",
    `🧾 رقم السند: ${v.number}`,
    `📅 التاريخ: ${fmtDateTime(v.date)}`,
    `⚙️ نوع العملية: ${label}`,
    `💵 المبلغ: ${formatCurrency(v.amount, cur)}`,
    v.commission ? `➕ العمولة: ${formatCurrency(v.commission, cur)}` : "",
    v.description ? `📝 البيان: ${v.description}` : "",
    bals ? `📊 الرصيد الحالي ${bal >= 0 ? "لكم" : "عليكم"}: ${formatCurrency(Math.abs(bal), cur)}` : "",
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
    `🏢 الشركة: ${s.company.name}`,
    client ? `👤 العميل: ${client.name}` : "",
    `🧾 رقم الحوالة: ${t.number}`,
    `📅 التاريخ: ${fmtDateTime(t.date)}`,
    `⚙️ النوع: حوالة ${t.transferType}`,
    `👤 المرسل: ${t.sender}`,
    `👥 المستلم: ${t.receiver}`,
    `💵 المبلغ: ${formatCurrency(t.amount, t.currency)}`,
    (t.outgoingFee || t.incomingFee) ? `➕ العمولة: ${formatCurrency((t.outgoingFee || 0) + (t.incomingFee || 0), t.currency)}` : "",
    t.description ? `📝 البيان: ${t.description}` : "",
    bals && client ? `📊 الرصيد الحالي ${bal >= 0 ? "لكم" : "عليكم"}: ${formatCurrency(Math.abs(bal), t.currency)}` : "",
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
  const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
  return true;
}

export function maybeAutoSend(phone: string | undefined, message: string): void {
  const auto = getState().settings.whatsappAutoSend;
  if (!auto) return;
  if (!phone) return;
  if (!confirm("إرسال إشعار واتساب للعميل الآن؟")) return;
  sendWhatsapp(phone, message);
}
