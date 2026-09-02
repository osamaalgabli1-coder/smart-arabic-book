import { getState, replaceState, subscribe, type AppState } from "@/lib/store";
import {
  createWorkspace, requestJoin, getSyncStatus, manageDevice, setMaxDevices,
  pushSnapshot, pullSnapshot, type DeviceRow,
} from "@/lib/sync.functions";

const LKEY = "muhaseb-sync-v1";

export type SyncLocal = {
  deviceId: string;
  deviceName: string;
  platform: string;
  code: string; // رمز المكتب
  enabled: boolean;
  version: number;
};

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad/i.test(ua)) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS/i.test(ua)) return "mac";
  return "web";
}

function defaults(): SyncLocal {
  return {
    deviceId: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    deviceName: detectPlatform() === "windows" ? "جهاز ويندوز" : "جوال",
    platform: detectPlatform(),
    code: "",
    enabled: false,
    version: 0,
  };
}

let local: SyncLocal | null = null;

export function getLocal(): SyncLocal {
  if (local) return local;
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(LKEY);
    local = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    local = defaults();
  }
  saveLocal();
  return local!;
}

export function setLocal(patch: Partial<SyncLocal>) {
  local = { ...getLocal(), ...patch };
  saveLocal();
  notify();
}

function saveLocal() {
  if (typeof window === "undefined" || !local) return;
  window.localStorage.setItem(LKEY, JSON.stringify(local));
}

// ---------- مراقبو الحالة ----------
export type SyncInfo = {
  status: "off" | "none" | "pending" | "approved" | "rejected" | "error";
  message?: string;
  lastSync?: string;
};

let info: SyncInfo = { status: "off" };
const watchers = new Set<() => void>();
function notify() { watchers.forEach((w) => w()); }
export function watchSync(cb: () => void) { watchers.add(cb); return () => { watchers.delete(cb); }; }
export function getSyncInfo() { return info; }
function setInfo(next: SyncInfo) { info = next; notify(); }

// ---------- المحرك ----------
let applying = false;
let timer: ReturnType<typeof setInterval> | null = null;
let unsub: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pull() {
  const l = getLocal();
  if (!l.enabled || !l.code) return;
  try {
    const res = await pullSnapshot({ data: { code: l.code, deviceId: l.deviceId, since: l.version } });
    if (res.status !== "approved") {
      setInfo({ status: res.status as SyncInfo["status"] });
      return;
    }
    if (res.data && res.version > l.version) {
      applying = true;
      replaceState(res.data as unknown as AppState, { silent: true });
      applying = false;
      setLocal({ version: res.version });
    }
    setInfo({ status: "approved", lastSync: new Date().toLocaleTimeString("ar") });
  } catch (e) {
    setInfo({ status: "error", message: (e as Error).message });
  }
}

function schedulePush() {
  const l = getLocal();
  if (!l.enabled || !l.code || applying) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void push(); }, 800);
}

export async function push() {
  const l = getLocal();
  if (!l.enabled || !l.code) return;
  try {
    const res = await pushSnapshot({ data: { code: l.code, deviceId: l.deviceId, deviceName: l.deviceName, data: getState() } });
    setLocal({ version: res.version });
    setInfo({ status: "approved", lastSync: new Date().toLocaleTimeString("ar") });
  } catch (e) {
    setInfo({ status: "error", message: (e as Error).message });
  }
}

export function startSync() {
  if (typeof window === "undefined") return;
  stopSync();
  const l = getLocal();
  if (!l.enabled || !l.code) { setInfo({ status: "off" }); return; }
  unsub = subscribe(schedulePush);
  void pull();
  timer = setInterval(() => { void pull(); }, 5000);
}

export function stopSync() {
  if (timer) { clearInterval(timer); timer = null; }
  if (unsub) { unsub(); unsub = null; }
}

// ---------- واجهات عالية المستوى ----------
export async function createOffice(workspaceName: string) {
  const l = getLocal();
  const res = await createWorkspace({ data: { deviceId: l.deviceId, deviceName: l.deviceName, platform: l.platform, workspaceName } });
  setLocal({ code: res.code, enabled: true, version: 0 });
  await push();
  startSync();
  return res;
}

export async function joinOffice(code: string) {
  const l = getLocal();
  const res = await requestJoin({ data: { code: code.trim().toUpperCase(), deviceId: l.deviceId, deviceName: l.deviceName, platform: l.platform } });
  setLocal({ code: code.trim().toUpperCase(), enabled: true, version: 0 });
  startSync();
  return res;
}

export async function statusOffice() {
  const l = getLocal();
  if (!l.code) return null;
  return getSyncStatus({ data: { code: l.code, deviceId: l.deviceId } });
}

export async function deviceAction(targetDeviceId: string, action: "approve" | "reject" | "remove") {
  const l = getLocal();
  return manageDevice({ data: { code: l.code, deviceId: l.deviceId, targetDeviceId, action } });
}

export async function changeMaxDevices(maxDevices: number) {
  const l = getLocal();
  return setMaxDevices({ data: { code: l.code, deviceId: l.deviceId, maxDevices } });
}

export function leaveOffice() {
  stopSync();
  setLocal({ code: "", enabled: false, version: 0 });
  setInfo({ status: "off" });
}

export type { DeviceRow };
