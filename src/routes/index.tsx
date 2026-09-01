import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Users, Wallet, FileText, Send, ClipboardList, BarChart3,
  Building2, Tags,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAppState, formatCurrency, sumCashboxesByCurrency, sumClientsByCurrency, CURRENCIES, currencySymbols } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Index,
});

const cards = [
  { to: "/clients", label: "إضافة السادة العملاء", icon: Users, tone: "text-primary" },
  { to: "/categories", label: "تصنيفات العملاء", icon: Tags, tone: "text-primary" },
  { to: "/cashboxes", label: "إضافة الصناديق", icon: Wallet, tone: "text-primary" },
  { to: "/vouchers", label: "إضافة سند جديد", icon: FileText, tone: "text-success" },
  { to: "/transfers", label: "إضافة حوالة جديدة", icon: Send, tone: "text-success" },
  { to: "/statement", label: "إدارة الحسابات", icon: ClipboardList, tone: "text-primary" },
  { to: "/reports", label: "التقارير", icon: BarChart3, tone: "text-primary" },
  { to: "/company", label: "إعدادات الشركة", icon: Building2, tone: "text-primary" },
] as const;

function Index() {
  const state = useAppState((s) => s);
  const clientTotals = sumClientsByCurrency(state);
  const cashTotals = sumCashboxesByCurrency(state);

  return (
    <AppShell>
      <section className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="عدد العملاء" value={String(state.clients.length)} />
        <StatCard label="عدد الحوالات" value={String(state.transfers.length)} />
      </section>
      <section className="mb-5">
        <h3 className="text-xs font-bold text-muted-foreground mb-2">أرصدة الصناديق حسب العملة</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {CURRENCIES.map((c) => (
            <StatCard key={c} label={currencySymbols[c]} value={formatCurrency(cashTotals[c], c)} />
          ))}
        </div>
        <h3 className="text-xs font-bold text-muted-foreground mb-2">أرصدة العملاء حسب العملة</h3>
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map((c) => (
            <StatCard key={c} label={currencySymbols[c]} value={formatCurrency(clientTotals[c], c)} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="group bg-card border-2 border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow-md hover:border-primary transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-accent/40 flex items-center justify-center group-hover:scale-105 transition">
                <Icon className={`w-7 h-7 ${c.tone}`} />
              </div>
              <div className="text-sm font-bold text-card-foreground leading-tight">{c.label}</div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-extrabold text-primary mt-1">{value}</div>
    </div>
  );
}
