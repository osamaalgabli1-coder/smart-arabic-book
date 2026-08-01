import { getState, setState, type AppState } from "@/lib/store";

const API = "https://api.telegram.org";

export function telegramConfig() {
  const s = getState().settings;
  return { token: (s.telegramBotToken ?? "").trim(), chatId: (s.telegramChatId ?? "").trim() };
}

export function telegramReady() {
  const { token, chatId } = telegramConfig();
  return Boolean(token && chatId);
}

export async function telegramBackup(): Promise<void> {
  const { token, chatId } = telegramConfig();
  if (!token || !chatId) throw new Error("لم يتم ضبط بوت تيليجرام");
  const data = JSON.stringify(getState(), null, 2);
  const name = `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  const fd = new FormData();
  fd.append("chat_id", chatId);
  fd.append("caption", `نسخة احتياطية — ${getState().company.name}`);
  fd.append("document", new Blob([data], { type: "application/json" }), name);
  const res = await fetch(`${API}/bot${token}/sendDocument`, { method: "POST", body: fd });
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || "فشل الإرسال إلى تيليجرام");
}

type TgUpdate = { message?: { document?: { file_id: string; file_name?: string }; date?: number } };

export async function telegramRestore(): Promise<void> {
  const { token, chatId } = telegramConfig();
  if (!token || !chatId) throw new Error("لم يتم ضبط بوت تيليجرام");
  const res = await fetch(`${API}/bot${token}/getUpdates?limit=100`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || "تعذّر جلب الرسائل");
  const docs = (json.result as TgUpdate[])
    .map((u) => u.message)
    .filter((m): m is NonNullable<TgUpdate["message"]> => Boolean(m?.document))
    .sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
  const doc = docs[0]?.document;
  if (!doc) throw new Error("لا توجد نسخة احتياطية في محادثة البوت — أرسل ملف النسخة إلى البوت أولاً");
  const fRes = await fetch(`${API}/bot${token}/getFile?file_id=${doc.file_id}`);
  const fJson = await fRes.json();
  if (!fJson.ok) throw new Error(fJson.description || "تعذّر جلب الملف");
  const dl = await fetch(`${API}/file/bot${token}/${fJson.result.file_path}`);
  const text = await dl.text();
  const parsed = JSON.parse(text) as AppState;
  setState(() => parsed);
}
