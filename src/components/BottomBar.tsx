import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, BarChart3, ReceiptText, ArrowLeftRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/settings" as const, label: "الإعدادات", icon: Settings, search: undefined },
  { to: "/reports" as const, label: "التقارير", icon: BarChart3, search: undefined },
  { to: "/vouchers" as const, label: "دائن له", icon: ReceiptText, search: { new: "credit" } },
  { to: "/vouchers" as const, label: "مدين عليه", icon: ReceiptText, search: { new: "debit" } },
  { to: "/vouchers" as const, label: "قيد بسيط", icon: ArrowLeftRight, search: { new: "compound" } },
];

const quick = [
  { label: "مدين عليه", type: "debit" },
  { label: "دائن له", type: "credit" },
  { label: "قيد بسيط", type: "compound" },
];

export function BottomBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <>
      {open && (
        <button
          aria-label="إغلاق"
          className="fixed inset-0 z-40 bg-foreground/40"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 grid gap-2 w-56">
          {quick.map((q) => (
            <button
              key={q.type}
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/vouchers", search: { new: q.type } });
              }}
              className="w-full rounded-full bg-card border-2 border-primary text-primary font-bold py-2.5 shadow-lg text-sm"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-50">
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-end justify-between bg-card border-t-2 border-border rounded-t-2xl shadow-[0_-4px_16px_hsl(0_0%_0%/0.08)] px-2 pt-2 pb-1">
            <div className="flex flex-1 justify-around">
              {left.map((it) => <BarItem key={it.label} item={it} path={path} />)}
            </div>
            <div className="w-16 shrink-0" />
            <div className="flex flex-1 justify-around">
              {right.map((it) => <BarItem key={it.label} item={it} path={path} />)}
            </div>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="إضافة عملية"
            className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-xl border-4 border-background flex items-center justify-center active:scale-95 transition-transform"
          >
            {open ? <X className="w-7 h-7" /> : <Plus className="w-8 h-8" />}
          </button>
        </div>
      </nav>
    </>
  );
}

function BarItem({ item, path }: { item: (typeof items)[number]; path: string }) {
  const Icon = item.icon;
  const active = path === item.to;
  return (
    <Link
      to={item.to}
      search={item.search as never}
      className={cn(
        "flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg min-w-0",
        active ? "text-primary font-bold" : "text-muted-foreground",
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] whitespace-nowrap">{item.label}</span>
    </Link>
  );
}
