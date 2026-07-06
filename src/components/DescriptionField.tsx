import { useMemo, useRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { getState } from "@/lib/store";

function collectSuggestions(): string[] {
  const s = getState();
  const set = new Set<string>();
  for (const v of s.vouchers) if (v.description?.trim()) set.add(v.description.trim());
  for (const t of s.transfers) if (t.description?.trim()) set.add(t.description.trim());
  return Array.from(set);
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
};

export function DescriptionField({ value, onChange, placeholder, rows = 3, id }: Props) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setAll(collectSuggestions()); }, []);

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    return all.filter((s) => s.toLowerCase().includes(ql) && s !== q).slice(0, 6);
  }, [value, all]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onPaste={(e) => {
          const text = e.clipboardData?.getData("text");
          if (text != null) {
            e.preventDefault();
            const target = e.currentTarget;
            const start = target.selectionStart ?? value.length;
            const end = target.selectionEnd ?? value.length;
            const next = value.slice(0, start) + text + value.slice(end);
            onChange(next);
            requestAnimationFrame(() => {
              try { target.setSelectionRange(start + text.length, start + text.length); } catch { /* noop */ }
            });
            setOpen(true);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-40 top-full mt-1 right-0 left-0 bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent border-b last:border-b-0 border-border"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}