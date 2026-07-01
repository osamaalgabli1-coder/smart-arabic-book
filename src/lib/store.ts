import { useSyncExternalStore } from "react";

export type Client = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  openingBalance: number;
  photo?: string;
};

export type Cashbox = {
  id: string;
  name: string;
  type: "main" | "sub";
  parentId?: string;
  openingBalance: number;
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
  type: VoucherType;
};

export type Transfer = {
  id: string;
  number: string;
  sender: string;
  receiver: string;
  transferType: string;
  amount: number;
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
  cashboxes: [{ id: "main", name: "الصندوق الرئيسي", type: "main", openingBalance: 0 }],
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
    return { ...initialState, ...JSON.parse(raw) };
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

export function clientBalance(state: AppState, clientId: string): number {
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return 0;
  let bal = c.openingBalance;
  for (const v of state.vouchers) {
    if (v.clientId !== clientId) continue;
    if (v.type === "credit" || v.type === "payment") bal += v.amount;
    if (v.type === "debit" || v.type === "receipt") bal -= v.amount;
    if (v.type === "adjustment") bal += v.amount;
  }
  return bal;
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
      if (v.toCashboxId === cashboxId) bal += v.amount;
    }
  }
  return bal;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("ar", { maximumFractionDigits: 2 }).format(n);
}

export const voucherTypeLabels: Record<VoucherType, string> = {
  credit: "له",
  debit: "عليه",
  receipt: "قبض من العميل",
  payment: "صرف للعميل",
  transfer: "تحويل بين الصناديق",
  adjustment: "قيد تسوية",
};