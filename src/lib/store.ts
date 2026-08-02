import { useSyncExternalStore } from "react";

export type Currency = "YER" | "SAR" | "USD";
export const CURRENCIES: Currency[] = ["YER", "SAR", "USD"];
export const currencyLabels: Record<Currency, string> = {
  YER: "ريال يمني",
  SAR: "ريال سعودي",
  USD: "دولار أمريكي",
};
export const currencySymbols: Record<Currency, string> = {
  YER: "﷼",
  SAR: "ر.س",
  USD: "$",
};

export type Client = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  openingBalance: number;
  openingCurrency?: Currency;
  photo?: string;
};

export type Cashbox = {
  id: string;
  name: string;
  type: "main" | "sub";
  parentId?: string;
  openingBalance: number;
  currency: Currency;
};

export type VoucherType =
  | "credit" // له
  | "debit" // عليه
  | "receipt" // قبض من العميل إلى الصندوق
  | "payment" // صرف من الصندوق للعميل
  | "transfer" // تحويل بين الصناديق
  | "adjustment" // قيد تسوية
  | "compound"; // قيد بسيط من عميل إلى عميل (+ عمولة اختيارية)

export type Voucher = {
  id: string;
  number: string;
  date: string;
  clientId?: string;
  toClientId?: string; // للقيد البسيط: الطرف الدائن
  cashboxId?: string;
  toCashboxId?: string;
  description: string;
  amount: number;
  commission?: number; // عمولة اختيارية للقيد البسيط
  commissionTo?: number; // عمولة تُضاف لحساب العميل الدائن (له)
  toAmount?: number; // للتحويل بين عملتين مختلفتين (المبلغ المستلم)
  exchangeRate?: number;
  currency: Currency;
  type: VoucherType;
};

export type Transfer = {
  id: string;
  number: string;
  clientId?: string; // العميل المرتبط بالحوالة
  sender: string;
  receiver: string;
  transferType: "صادرة" | "واردة" | "داخلية" | string;
  amount: number;
  currency: Currency;
  outgoingFee?: number;
  incomingFee?: number;
  date: string;
  status: "pending" | "completed" | "cancelled";
  description?: string;
};

export type Company = {
  name: string;
  logo?: string;
  phone?: string;
  address?: string;
  email?: string;
  notes?: string;
};

export type AppSettings = {
  whatsappAutoSend: boolean;
  smsNotifications?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  passwordEnabled?: boolean;
  password?: string;
};

export type AppState = {
  clients: Client[];
  cashboxes: Cashbox[];
  vouchers: Voucher[];
  transfers: Transfer[];
  company: Company;
  settings: AppSettings;
};

const KEY = "muhaseb-app-state-v1";

const initialState: AppState = {
  clients: [],
  cashboxes: [{ id: "main", name: "الصندوق الرئيسي", type: "main", openingBalance: 0, currency: "YER" }],
  vouchers: [],
  transfers: [],
  company: { name: "اسامه الجبلي واخوانه للتجارة" },
  settings: { whatsappAutoSend: false, smsNotifications: false, passwordEnabled: false },
};

let state: AppState = load();
const listeners = new Set<() => void>();

function load(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState;
    const parsed = { ...initialState, ...JSON.parse(raw) };
    // migration: ensure currency on cashboxes / vouchers / transfers
    parsed.cashboxes = (parsed.cashboxes ?? []).map((c: Cashbox) => ({ ...c, currency: c.currency ?? "YER" }));
    parsed.vouchers = (parsed.vouchers ?? []).map((v: Voucher, i: number) => ({ ...v, currency: v.currency ?? "YER", number: v.number ?? String(i + 1).padStart(4, "0") }));
    parsed.transfers = (parsed.transfers ?? []).map((t: Transfer) => ({ ...t, currency: t.currency ?? "YER" }));
    parsed.settings = { ...initialState.settings, ...(parsed.settings ?? {}) };
    return parsed;
  } catch {
    return initialState;
  }
}

function save() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

function emit() {
  save();
  listeners.forEach((l) => l());
}

export function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  emit();
}

export function getState() {
  return state;
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(initialState),
  );
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ------- domain helpers -------

export function clientBalances(state: AppState, clientId: string): Record<Currency, number> {
  const c = state.clients.find((x) => x.id === clientId);
  const out: Record<Currency, number> = { YER: 0, SAR: 0, USD: 0 };
  if (!c) return out;
  out[c.openingCurrency ?? "YER"] += c.openingBalance || 0;
  for (const v of state.vouchers) {
    const cur: Currency = v.currency ?? "YER";
    if (v.type === "compound") {
      if (v.clientId === clientId) out[cur] -= (v.amount + (v.commission || 0));
      if (v.toClientId === clientId) out[cur] += (v.amount + (v.commissionTo || 0));
    } else if (v.clientId === clientId) {
      if (v.type === "credit" || v.type === "payment") out[cur] += v.amount;
      else if (v.type === "debit" || v.type === "receipt") out[cur] -= v.amount;
      else if (v.type === "adjustment") out[cur] += v.amount;
    }
  }
  for (const t of state.transfers) {
    if (t.clientId !== clientId) continue;
    const cur = t.currency;
    if (t.transferType === "واردة") out[cur] += t.amount;
    else if (t.transferType === "صادرة") out[cur] -= t.amount;
    // العمولات: الصادرة على حساب العميل (عليه)، الواردة لحساب العميل (له)
    if (t.outgoingFee) out[cur] -= t.outgoingFee;
    if (t.incomingFee) out[cur] += t.incomingFee;
  }
  return out;
}

// رصيد إجمالي (يجمع كل العملات دون تحويل) — للإحصاءات السريعة فقط
export function clientBalance(state: AppState, clientId: string): number {
  const b = clientBalances(state, clientId);
  return b.YER + b.SAR + b.USD;
}

export function cashboxBalance(state: AppState, cashboxId: string): number {
  const c = state.cashboxes.find((x) => x.id === cashboxId);
  if (!c) return 0;
  let bal = c.openingBalance;
  for (const v of state.vouchers) {
    if (v.type === "receipt" && v.cashboxId === cashboxId) bal += v.amount;
    if (v.type === "payment" && v.cashboxId === cashboxId) bal -= v.amount;
    if (v.type === "transfer") {
      if (v.cashboxId === cashboxId) bal -= v.amount;
      if (v.toCashboxId === cashboxId) bal += (v.toAmount ?? v.amount);
    }
  }
  return bal;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ar", { maximumFractionDigits: 2 }).format(n);
}

// اسم الشركة في الإشعارات: نجمة قبل وبعد الاسم بدون كلمة "الشركة"
export function companyDisplayName(state: AppState): string {
  return `*${state.company.name}*`;
}

export function formatCurrency(n: number, currency: Currency = "YER"): string {
  return `${formatNumber(n)} ${currencySymbols[currency]}`;
}

// عرض الرصيد وفق اتفاقية العرض للمستخدم:
// - الرصيد على العميل (سالب داخلياً) يُعرض بدون علامة سالب
// - الرصيد للعميل (موجب داخلياً) يُعرض بعلامة سالب "-"
export function formatBalanceDisplay(n: number, currency: Currency = "YER"): string {
  if (n === 0) return formatCurrency(0, currency);
  const abs = Math.abs(n);
  const sign = n > 0 ? "-" : "";
  return `${sign}${formatCurrency(abs, currency)}`;
}

export function formatBalanceNumber(n: number): string {
  if (n === 0) return formatNumber(0);
  const abs = Math.abs(n);
  const sign = n > 0 ? "-" : "";
  return `${sign}${formatNumber(abs)}`;
}

export function sumCashboxesByCurrency(state: AppState): Record<Currency, number> {
  const out: Record<Currency, number> = { YER: 0, SAR: 0, USD: 0 };
  for (const c of state.cashboxes) out[c.currency] += cashboxBalance(state, c.id);
  return out;
}

export function sumClientsByCurrency(state: AppState): Record<Currency, number> {
  const out: Record<Currency, number> = { YER: 0, SAR: 0, USD: 0 };
  for (const c of state.clients) {
    const b = clientBalances(state, c.id);
    out.YER += b.YER; out.SAR += b.SAR; out.USD += b.USD;
  }
  return out;
}

export const voucherTypeLabels: Record<VoucherType, string> = {
  credit: "دائن (له)",
  debit: "مدين (عليه)",
  receipt: "قبض من العميل",
  payment: "صرف للعميل",
  transfer: "تحويل بين الصناديق",
  adjustment: "قيد تسوية",
  compound: "قيد بسيط (عميل → عميل)",
};

// ---------- Unified Client Ledger ----------
export type LedgerEntry = {
  id: string;
  number: string;
  date: string;
  description: string;
  typeLabel: string;
  debit: number; // عليه
  credit: number; // له
  currency: Currency;
};

export function clientLedger(state: AppState, clientId: string): Record<Currency, LedgerEntry[]> {
  const out: Record<Currency, LedgerEntry[]> = { YER: [], SAR: [], USD: [] };
  const nameOf = (id?: string) => state.clients.find((c) => c.id === id)?.name ?? "";
  for (const v of state.vouchers) {
    const cur: Currency = v.currency ?? "YER";
    if (v.type === "compound") {
      if (v.clientId === clientId) {
        const note = v.description ? ` — ${v.description}` : "";
        out[cur].push({
          id: v.id, number: v.number, date: v.date,
          description: `عليكم إلى حساب ${nameOf(v.toClientId)}${v.commission ? ` (عمولة ${v.commission})` : ""}${note}`,
          typeLabel: "قيد بسيط (مدين)",
          debit: v.amount + (v.commission || 0), credit: 0, currency: cur,
        });
      }
      if (v.toClientId === clientId) {
        const note = v.description ? ` — ${v.description}` : "";
        out[cur].push({
          id: v.id + "-to", number: v.number, date: v.date,
          description: `لكم من حساب ${nameOf(v.clientId)}${v.commissionTo ? ` (عمولة ${v.commissionTo})` : ""}${note}`,
          typeLabel: "قيد بسيط (دائن)",
          debit: 0, credit: v.amount + (v.commissionTo || 0), currency: cur,
        });
      }
      continue;
    }
    if (v.clientId !== clientId) continue;
    let debit = 0, credit = 0, label = voucherTypeLabels[v.type];
    if (v.type === "credit") credit = v.amount;
    else if (v.type === "debit") debit = v.amount;
    else if (v.type === "receipt") debit = v.amount;
    else if (v.type === "payment") credit = v.amount;
    else if (v.type === "adjustment") credit = v.amount;
    else continue;
    out[cur].push({ id: v.id, number: v.number, date: v.date, description: v.description || label, typeLabel: label, debit, credit, currency: cur });
  }
  for (const t of state.transfers) {
    if (t.clientId !== clientId) continue;
    const cur = t.currency;
    const isOut = t.transferType === "صادرة";
    out[cur].push({
      id: t.id, number: t.number, date: t.date,
      description: `${isOut ? "حوالة صادرة" : "حوالة واردة"} #${t.number} — ${isOut ? `إلى ${t.receiver}` : `من ${t.sender}`}${t.description ? " · " + t.description : ""}`,
      typeLabel: isOut ? "حوالة صادرة (مدين)" : "حوالة واردة (دائن)",
      debit: isOut ? t.amount : 0, credit: isOut ? 0 : t.amount, currency: cur,
    });
    if (t.outgoingFee) {
      out[cur].push({
        id: t.id + "-ofee", number: t.number, date: t.date,
        description: `عمولة حوالة صادرة #${t.number}`,
        typeLabel: "عمولة صادرة (مدين)",
        debit: t.outgoingFee, credit: 0, currency: cur,
      });
    }
    if (t.incomingFee) {
      out[cur].push({
        id: t.id + "-ifee", number: t.number, date: t.date,
        description: `عمولة حوالة واردة #${t.number}`,
        typeLabel: "عمولة واردة (دائن)",
        debit: 0, credit: t.incomingFee, currency: cur,
      });
    }
  }
  for (const cur of CURRENCIES) out[cur].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  return out;
}

export function nextVoucherNumber(state: AppState): string {
  const max = state.vouchers.reduce((m, v) => Math.max(m, Number(v.number) || 0), 0);
  return String(max + 1).padStart(4, "0");
}

export function nextTransferNumber(state: AppState): string {
  const max = state.transfers.reduce((m, t) => {
    const n = Number(String(t.number).replace(/\D/g, "")) || 0;
    return Math.max(m, n);
  }, 0);
  return `HW-${String(max + 1).padStart(4, "0")}`;
}