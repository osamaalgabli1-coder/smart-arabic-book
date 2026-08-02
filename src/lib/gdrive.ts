import { getState, setState, type AppState } from "@/lib/store";

// حفظ نسخة احتياطية إلى جوجل درايف:
// يتم تنزيل ملف النسخة ثم فتح صفحة الرفع في درايف لاختيار الملف.
export function googleDriveBackup(): string {
  const data = JSON.stringify(getState(), null, 2);
  const name = `backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  window.open("https://drive.google.com/drive/my-drive", "_blank");
  return name;
}

// استعادة نسخة احتياطية من جوجل درايف:
// يفتح درايف لتنزيل الملف، ثم يختار المستخدم الملف من الجهاز لاستعادته.
export function googleDriveOpen(): void {
  window.open("https://drive.google.com/drive/my-drive", "_blank");
}

export async function googleDriveRestoreFromFile(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text) as AppState;
  setState(() => parsed);
}
