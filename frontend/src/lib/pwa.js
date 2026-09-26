import { api } from "@/lib/api";

let deferred = null;
const listeners = new Set();

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((l) => l(e));
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((l) => l(null));
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

export const getInstallPrompt = () => deferred;
export const onInstallPromptChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const b64ToUint8 = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function getSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function subscribePush() {
  if (!pushSupported()) {
    throw new Error(isIOS() ? "Сначала установите приложение на экран «Домой»" : "Браузер не поддерживает уведомления");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Разрешите уведомления в настройках браузера");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const { data } = await api.get("/push/key");
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(data.key) }));
  await api.post("/push/subscribe", sub.toJSON());
  return sub;
}

export async function unsubscribePush() {
  const sub = await getSubscription();
  if (!sub) return;
  await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
