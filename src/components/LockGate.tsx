import { useEffect, useState, type ReactNode } from "react";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

const SESSION_KEY = "muhaseb-unlocked";

export function LockGate({ children }: { children: ReactNode }) {
  const enabled = useAppState((s) => Boolean(s.settings.passwordEnabled && s.settings.password));
  const password = useAppState((s) => s.settings.password ?? "");
  const [unlocked, setUnlocked] = useState(true);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) { setUnlocked(true); return; }
    setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
  }, [enabled]);

  if (!enabled || unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value === password) {
            sessionStorage.setItem(SESSION_KEY, "1");
            setUnlocked(true);
          } else setError(true);
        }}
        className="w-full max-w-sm bg-card border-2 border-border rounded-2xl p-6 text-center grid gap-4"
      >
        <div className="w-14 h-14 rounded-full bg-primary/15 text-primary mx-auto flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <div className="font-extrabold text-lg">نظام المحاسب المطور</div>
          <div className="text-xs text-muted-foreground">أدخل كلمة المرور للدخول</div>
        </div>
        <Input type="password" value={value} onChange={(e) => { setValue(e.target.value); setError(false); }} placeholder="كلمة المرور" className="text-center" />
        {error && <div className="text-xs text-destructive font-bold">كلمة المرور غير صحيحة</div>}
        <Button type="submit">دخول</Button>
      </form>
    </div>
  );
}

export function lockApp() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.reload();
}
