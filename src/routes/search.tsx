import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Users, FileText, Send } from "lucide-react";
import {
  useAppState, formatCurrency, voucherTypeLabels, categoryName,
  clientBalance, formatBalanceDisplay,
} from "@/lib/store";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s['q'] === "string" ? (s['q'] as string) : "" }),
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "البحث في العمليات — نظام المحاسب المطور" },
      { name: "description", content: "بحث شامل في العملاء والسندات والحوالات بالبيان أو المبلغ أو اسم السيد." },
      { property: "og:title", content: "البحث في العمليات — نظام المحاسب المطور" },
      { property: "og:description", content: "بحث شامل في العملاء والسندات والحوالات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const state = useAppState((s) => s);
  const [term, setTerm] = useState(q);

  const needle = q.trim().toLowerCase();
  const num = Number(needle.replace(/,/g, ""));
  const hasNum = needle !== "" && !Number.isNaN(num);
  const nameOf = (id?: string) => state.clients.find((c) => c.id === id)?.name ?? "";

  const clients = needle
    ? state.clients.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? "").includes(needle))
    : [];
  const vouchers = needle
    ? state.vouchers.filter((v) =>
        (v.description ?? "").toLowerCase().includes(needle) ||
        v.number.includes(needle) ||
        nameOf(v.clientId).toLowerCase().includes(needle) ||
        nameOf(v.toClientId).toLowerCase().includes(needle) ||
        (hasNum && v.amount === num))
    : [];
  const transfers = needle
    ? state.transfers.filter((t) =>
        (t.description ?? "").toLowerCase().includes(needle) ||
        t.number.toLowerCase().includes(needle) ||
        t.sender.toLowerCase().includes(needle) ||
        t.receiver.toLowerCase().includes(needle) ||
        nameOf(t.clientId).toLowerCase().includes(needle) ||
        (hasNum && t.amount === num))
    : [];

  const total = clients.length + vouchers.length + transfers.length;

  return (
    <AppShell>
      <PageHeader title="البحث الشامل" subtitle="ابحث بالبيان أو المبلغ أو اسم السيد في كل العمليات" />
      <form
        className="flex gap-2 mb-4"
        onSubmit={(e) => { e.preventDefault(); void navigate({ to: "/search", search: { q: term } }); }}
      >
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="بيان / مبلغ / اسم السيد / رقم السند" />
        <Button type="submit"><SearchIcon className="w-4 h-4" /></Button>
      </form>

      {needle === "" ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">أدخل كلمة أو مبلغاً للبحث</div>
      ) : total === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">لا توجد نتائج مطابقة</div>
      ) : (
        <div className="grid gap-4">
          {clients.length > 0 && (
            <Section icon={<Users className="w-4 h-4 text-primary" />} title={`السادة العملاء (${clients.length})`}>
              {clients.map((c) => (
                <Link key={c.id} to="/statement" className="block bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{categoryName(state, c.categoryId)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{c.phone} • {formatBalanceDisplay(clientBalance(state, c.id))}</div>
                </Link>
              ))}
            </Section>
          )}
          {vouchers.length > 0 && (
            <Section icon={<FileText className="w-4 h-4 text-success" />} title={`السندات (${vouchers.length})`}>
              {vouchers.map((v) => (
                <div key={v.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 text-sm font-bold">
                    <span>#{v.number} — {voucherTypeLabels[v.type]}</span>
                    <span>{formatCurrency(v.amount, v.currency)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{v.date} • {nameOf(v.clientId)} {v.description ? `• ${v.description}` : ""}</div>
                </div>
              ))}
            </Section>
          )}
          {transfers.length > 0 && (
            <Section icon={<Send className="w-4 h-4 text-success" />} title={`الحوالات (${transfers.length})`}>
              {transfers.map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 text-sm font-bold">
                    <span>#{t.number} — {t.transferType}</span>
                    <span>{formatCurrency(t.amount, t.currency)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{t.date} • {t.sender} ← {t.receiver} {t.description ? `• ${t.description}` : ""}</div>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2">{icon}{title}</h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}
