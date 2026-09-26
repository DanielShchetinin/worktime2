import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
const ACCESS = "smena_access";
const REFRESH = "smena_refresh";

export const tokens = {
  get: () => localStorage.getItem(ACCESS),
  set: (a, r) => {
    if (a) localStorage.setItem(ACCESS, a);
    if (r) localStorage.setItem(REFRESH, r);
  },
  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export const api = axios.create({ baseURL: `${BASE}/api`, withCredentials: true });

api.interceptors.request.use((c) => {
  const t = tokens.get();
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

const NO_RETRY = ["/auth/login", "/auth/register", "/auth/refresh"];

async function refreshAccess() {
  const { data } = await axios.post(
    `${BASE}/api/auth/refresh`,
    { refresh_token: localStorage.getItem(REFRESH) },
    { withCredentials: true }
  );
  tokens.set(data.access_token);
  return data.access_token;
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && orig && !orig._retry && !NO_RETRY.some((u) => orig.url?.includes(u))) {
      orig._retry = true;
      try {
        await refreshAccess();
        return api(orig);
      } catch {
        tokens.clear();
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(err);
  }
);

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Что-то пошло не так";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export async function transcribe(blob, filename) {
  const fd = new FormData();
  fd.append("file", blob, filename);
  const { data } = await api.post("/chat/transcribe", fd);
  return data.text;
}

export async function downloadReport(month, format, today) {
  const { data } = await api.get("/reports/month", { params: { month, format, today }, responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smena-${month}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function streamChat(message, today, history, onEvent) {
  await api.get("/auth/me");
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.get()}` },
    body: JSON.stringify({ message, today, history }),
  });
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (chunk.startsWith("data: ")) onEvent(JSON.parse(chunk.slice(6)));
    }
  }
}
