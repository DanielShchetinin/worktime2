import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => get("/settings") });

export const useMonthStats = (month) =>
  useQuery({ queryKey: ["stats", "month", month], queryFn: () => get("/stats/month", { month, today: todayISO() }) });

export const useYearStats = (year) =>
  useQuery({ queryKey: ["stats", "year", year], queryFn: () => get("/stats/year", { year, today: todayISO() }) });

export const useTimer = (date) =>
  useQuery({ queryKey: ["timer", date], queryFn: () => get("/timer", { date }), refetchInterval: 60000 });

export const useDay = (date, enabled = true) =>
  useQuery({ queryKey: ["day", date], queryFn: () => get(`/day/${date}`), enabled: !!date && enabled, staleTime: 0 });

export const useHolidays = (year) =>
  useQuery({ queryKey: ["holidays", year], queryFn: () => get("/holidays", { year }) });

export const useChatHistory = () => useQuery({ queryKey: ["chat"], queryFn: () => get("/chat/history") });

export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "chat" });
}

export const typeMap = (settings) => Object.fromEntries((settings?.day_types || []).map((t) => [t.key, t]));
