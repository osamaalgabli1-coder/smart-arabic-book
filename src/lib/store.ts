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
  | "adjustment"; // قيد تسوية

export type Voucher = {
  id: string;
  date: string;
  clientId?: string;
  cashboxId?: string;
  toCashboxId?: string;
  description: string;
  amount: number;
  toAmount?: number; // للتحويل بين عملتين مختلفتين (المبلغ المستلم)
  exchangeRate?: number;
  currency: Currency;
  type: VoucherType;
};

export type Transfer = {
  id: string;
  number: string;
  sender: string;
  receiver: string;
  transferType: string;
  amount: number;
  currency: Currency;
  outgoingFee?: number;
  incomingFee?: number;
  date: string;
  status: "pending" | "completed" | "cancelled";
};

export type Company = {
  name: string;
  logo?: string;
  phone?: string;
  address?: string;
  email?: string;
  notes?: string;
};

export type AppState = {
  clients: Client[];
  cashboxes: Cashbox[];
  vouchers: Voucher[];
  transfers: Transfer[];
  company: Company;
};

const KEY = "muhaseb-app-state-v1";

const initialState: AppState = {
  clients: [],
  cashboxes: [{ id: "main", name: "الصندوق الرئيسي", type: "main", openingBalance: 0, currency: "YER" }],
  vouchers: [],
  transfers: [],
  company: { name: "شركتي" },
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
    parsed.vouchers = (parsed.vouchers ?? []).map((v: Voucher) => ({ ...v, currency: v.currency ?? "YER" }));
    parsed.transfers = (parsed.transfers ?? []).map((t: Transfer) => ({ ...t, currency: t.currency ?? "YER" }));
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
    if (v.clientId !== clientId) continue;
    const cur: Currency = v.currency ?? "YER";
    if (v.type === "credit" || v.type === "payment") out[cur] += v.amount;
    else if (v.type === "debit" || v.type === "receipt") out[cur] -= v.amount;
    else if (v.type === "adjustment") out[cur] += v.amount;
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

export function formatCurrency(n: number, currency: Currency = "YER"): string {
  return `${formatNumber(n)} ${currencySymbols[currency]}`;
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
  credit: "له",
  debit: "عليه",
  receipt: "قبض من العميل",
  payment: "صرف للعميل",
  transfer: "تحويل بين الصناديق",
  adjustment: "قيد تسوية",
};