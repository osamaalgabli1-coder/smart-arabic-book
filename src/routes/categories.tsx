import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, Tags } from "lucide-react";
import { setState, useAppState, uid, type ClientCategory } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "تصنيفات السادة العملاء — نظام المحاسب المطور" },
      { name: "description", content: "إدارة تصنيفات العملاء: عام، عملاء، موردين، مع إمكانية التعديل والنقل بين التصنيفات." },
      { property: "og:title", content: "تصنيفات السادة العملاء" },
      { property: "og:description", content: "إدارة تصنيفات العملاء والموردين ونقل الحسابات بينها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CategoriesPage() {
  const categories = useAppState((s) => s.categories);
  const clients = useAppState((s) => s.clients);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    setState((s) => ({ ...s, categories: [...s.categories, { id: uid(), name }] }));
    setNewName("");
    toast.success("تمت إضافة التصنيف");
  };

  const rename = (c: ClientCategory) => {
    const name = editName.trim();
    if (!name) return;
    setState((s) => ({ ...s, categories: s.categories.map((x) => (x.id === c.id ? { ...x, name } : x)) }));
    setEditId(null);
    toast.success("تم تعديل اسم التصنيف");
  };

  const remove = (c: ClientCategory) => {
    if (categories.length <= 1) { toast.error("يجب إبقاء تصنيف واحد على الأقل"); return; }
    if (!confirm(`حذف التصنيف "${c.name}"؟ سيتم نقل حساباته إلى أول تصنيف.`)) return;
    const fallback = categories.find((x) => x.id !== c.id)!.id;
    setState((s) => ({
      ...s,
      categories: s.categories.filter((x) => x.id !== c.id),
      clients: s.clients.map((cl) => (cl.categoryId === c.id ? { ...cl, categoryId: fallback } : cl)),
    }));
  };

  const move = (clientId: string, categoryId: string) => {
    setState((s) => ({ ...s, clients: s.clients.map((c) => (c.id === clientId ? { ...c, categoryId } : c)) }));
  };

  return (
    <AppShell>
      <PageHeader title="تصنيفات السادة العملاء" subtitle="أضف وعدّل التصنيفات وانقل الحسابات بينها" />

      <div className="flex gap-2 mb-4">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم تصنيف جديد (مثال: موردين)" />
        <Button onClick={add}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
      </div>

      <div className="grid gap-3">
        {categories.map((c) => {
          const list = clients.filter((cl) => (cl.categoryId ?? categories[0]?.id) === c.id);
          return (
            <div key={c.id} className="bg-card border-2 border-border rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-primary" />
                {editId === c.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" />
                    <Button size="icon" variant="ghost" onClick={() => rename(c)}><Check className="w-4 h-4 text-success" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 font-bold">{c.name}</div>
                    <span className="text-xs text-muted-foreground">{list.length}</span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(c.id); setEditName(c.name); }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </>
                )}
              </div>
              {list.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {list.map((cl) => (
                    <div key={cl.id} className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2">
                      <span className="truncate">{cl.name}</span>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={c.id}
                        onChange={(e) => move(cl.id, e.target.value)}
                      >
                        {categories.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
