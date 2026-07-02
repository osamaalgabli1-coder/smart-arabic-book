import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Home, Users, Wallet, FileText, Send, BarChart3, Settings, Download, Upload, Building2, Code2, Package, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

const menu = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/clients", label: "العملاء", icon: Users },
  { to: "/cashboxes", label: "الصناديق", icon: Wallet },
  { to: "/vouchers", label: "السندات والقيود", icon: FileText },
  { to: "/transfers", label: "الحوالات", icon: Send },
  { to: "/statement", label: "كشف الحساب", icon: FileText },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/backup", label: "النسخ الاحتياطي والاستعادة", icon: Upload },
  { to: "/export", label: "تصدير البيانات", icon: Download },
  { to: "/company", label: "إعدادات الشركة", icon: Building2 },
  { to: "/customize", label: "تعديل وتطوير البرنامج", icon: Code2 },
  { to: "/build-app", label: "إنشاء تطبيق مستقل", icon: Package },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const company = useAppState((s) => s.company);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="sticky top-0 z-30 bg-header text-header-foreground shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="القائمة"
            className="p-2 rounded-md hover:bg-black/10"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">نظام المحاسب المطور</h1>
            <p className="text-[11px] opacity-80">إعداد وتطوير: أسامة الجبلي • الإصدار 1.0</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-brand-dark text-primary flex items-center justify-center font-bold overflow-hidden">
            {company.logo ? (
              <img src={company.logo} alt="شعار" className="w-full h-full object-contain bg-white" />
            ) : (
              <span>$</span>
            )}
          </div>
        </div>
        <div className="bg-destructive text-destructive-foreground text-center text-xs py-1.5 font-semibold">
          {company.name} — نظام محاسبي عربي متكامل
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>

      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <aside
            className="w-80 max-w-[85vw] bg-card text-card-foreground h-full overflow-y-auto shadow-2xl mr-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-brand-dark text-header-foreground p-6 text-center relative">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 left-3 p-1 rounded hover:bg-white/10"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 rounded-full bg-primary mx-auto flex items-center justify-center text-2xl font-black text-primary-foreground overflow-hidden">
                {company.logo ? (
                  <img src={company.logo} alt="شعار" className="w-full h-full object-contain bg-white" />
                ) : (
                  <span>$</span>
                )}
              </div>
              <div className="mt-3 font-bold">نظام المحاسب المطور</div>
              <div className="text-xs opacity-70">أسامة الجبلي</div>
            </div>
            <nav className="p-2">
              {menu.map((m) => {
                const Icon = m.icon;
                const active = path === m.to;
                return (
                  <Link
                    key={m.to}
                    to={m.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm",
                      active ? "bg-accent text-accent-foreground font-bold" : "hover:bg-muted",
                    )}
                  >
                    <span>{m.label}</span>
                    <Icon className="w-5 h-5 text-primary" />
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}