import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Flame, Wallet, Coins, PartyPopper, Sparkles, ArrowUpRight } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useMonthStats, useSettings, useHolidays } from "@/hooks/useData";
import { monthKey, todayISO, hrs, money, dateShort, parseISO, WD_SHORT, rateColor, HOLIDAY_KIND } from "@/lib/format";
import { GlassCard, Label, Kpi } from "@/components/Glass";
import { ActivityRings, RING_COLORS } from "@/components/ActivityRings";
import { TimerCard } from "@/components/TimerCard";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
};

const RingsCard = ({ stats }) => {
  const t = stats?.totals || {};
  const g = stats?.goals || {};
  const rows = [
    { label: "Часы месяца", value: t.credited_hours, max: g.hours, colors: RING_COLORS.red, fmt: `${hrs(t.credited_hours)} / ${Math.round(g.hours || 0)}ч` },
    { label: "Норма к сегодня", value: t.worked_hours + (t.leave_hours || 0), max: t.expected_to_date, colors: RING_COLORS.green, fmt: `${hrs(t.worked_hours + (t.leave_hours || 0))} / ${hrs(t.expected_to_date)}` },
    { label: "Доход", value: t.gross, max: g.income, colors: RING_COLORS.blue, fmt: `${money(t.gross)} / ${money(g.income)}` },
  ];
  return (
    <GlassCard className="p-6 h-full flex flex-col" data-testid="rings-card">
      <Label>Кольца месяца</Label>
      <div className="flex-1 grid place-items-center py-4">
        <ActivityRings size={200} stroke={20} gap={5} rings={rows} testId="month-rings">
          <div>
            <div className="num text-3xl font-semibold">{Math.round(((t.credited_hours || 0) / (g.hours || 1)) * 100)}%</div>
            <div className="text-[11px] txt-2">цели</div>
          </div>
        </ActivityRings>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 txt-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${r.colors[0]}, ${r.colors[1]})` }} />{r.label}</span>
            <span className="num font-semibold text-xs sm:text-sm">{r.fmt}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

const RecentChart = ({ stats }) => {
  const today = todayISO();
  const days = (stats?.days || []).filter((d) => d.date <= today).slice(-14);
  const rates = [...new Set(days.flatMap((d) => Object.keys(d.calc?.breakdown || {})))].sort((a, b) => a - b);
  const data = days.map((d) => ({ name: `${WD_SHORT[parseISO(d.date).getDay()]} ${Number(d.date.slice(8))}`, ...Object.fromEntries(rates.map((r) => [r, +(d.calc?.breakdown?.[r] || 0).toFixed(2)])) }));
  return (
    <GlassCard className="p-6 h-full" data-testid="recent-chart-card">
      <div className="flex items-center justify-between">
        <Label>Последние 14 дней</Label>
        <div className="flex gap-2 flex-wrap justify-end">{rates.map((r) => <span key={r} className="num text-[11px] font-semibold" style={{ color: rateColor(r) }}>● {r}%</span>)}</div>
      </div>
      <div className="h-[220px] mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%">
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--txt-2)" }} axisLine={false} tickLine={false} interval={1} />
            <Tooltip cursor={{ fill: "var(--soft)" }} contentStyle={{ background: "var(--glass-strong)", border: "1px solid var(--glass-border)", borderRadius: 14, backdropFilter: "blur(20px)", fontSize: 12 }} formatter={(v, n) => [hrs(v), `${n}%`]} />
            {rates.map((r, i) => <Bar key={r} dataKey={r} stackId="a" fill={rateColor(r)} radius={i === rates.length - 1 ? [8, 8, 3, 3] : [3, 3, 3, 3]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};

const UpcomingHolidays = () => {
  const today = todayISO();
  const y = new Date().getFullYear();
  const { data: a } = useHolidays(y);
  const { data: b } = useHolidays(y + 1);
  const list = [...(a || []), ...(b || [])].filter((h) => h.date >= today && h.kind !== "optional").slice(0, 5);
  return (
    <GlassCard className="p-6 h-full" data-testid="upcoming-holidays-card">
      <Label>Ближайшие праздники · Израиль</Label>
      <div className="mt-2">
        {list.map((h) => (
          <div key={h.date} className="flex items-center gap-3 py-3 border-b hair last:border-0">
            <div className="w-9 h-9 rounded-[10px] grid place-items-center shrink-0" style={{ background: h.day_off ? "#FF950020" : "#FFCC0020", color: h.day_off ? "#FF9500" : "#D4A200" }}><PartyPopper size={16} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{h.name}</div>
              <div className="text-xs txt-2">{HOLIDAY_KIND[h.kind]}{h.day_off ? " · выходной" : h.norm_hours ? ` · ${h.norm_hours}ч` : " · короткий"}</div>
            </div>
            <div className="num text-xs font-semibold txt-2">{dateShort(h.date)}</div>
          </div>
        ))}
        {!list.length && <div className="text-sm txt-2">Нет ближайших праздников</div>}
      </div>
    </GlassCard>
  );
};

const AiTeaser = () => {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const go = () => nav(`/chat${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  return (
    <GlassCard className="p-5 sm:p-6" data-testid="ai-teaser-card">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[11px] grid place-items-center bg-[#0A84FF] text-white shrink-0"><Sparkles size={19} /></div>
          <div>
            <div className="text-[17px] font-semibold">Ассистент</div>
            <div className="text-[13px] txt-2">Опишите словами: праздники, короткие дни, ставки, отпуска</div>
          </div>
        </div>
        <div className="flex-1 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} className="field !h-11 !rounded-[12px]" placeholder="В канун праздников работаем до 13:00…" data-testid="ai-teaser-input" />
          <button onClick={go} className="h-11 w-11 shrink-0 rounded-full bg-[#0A84FF] text-white grid place-items-center active:opacity-70" data-testid="ai-teaser-send"><ArrowUpRight size={19} /></button>
        </div>
      </div>
    </GlassCard>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats } = useMonthStats(monthKey());
  const { data: settings } = useSettings();
  const t = stats?.totals || {};
  const tax = stats?.tax || {};
  const cur = settings?.currency || "₪";
  return (
    <div className="space-y-5" data-testid="dashboard-page">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm txt-2 font-medium">{greeting()},</div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-tight" data-testid="dashboard-greeting">{user?.name}</h1>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-12 lg:col-span-8"><TimerCard /></div>
        <div className="md:col-span-6 lg:col-span-4"><RingsCard stats={stats} /></div>
        <div className="md:col-span-6 lg:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Отработано" value={hrs(t.worked_hours)} sub={`${t.worked_days || 0} рабочих дней`} icon={Clock} color="#FF2D55" testId="kpi-worked" delay={60} />
          <Kpi label="Сверхурочные" value={hrs(t.overtime_hours)} sub="125% · 150% · 200%" icon={Flame} color="#FF9F0A" testId="kpi-overtime" delay={120} />
          <Kpi label="Брутто" value={money(t.gross, cur)} sub={`бонусы ${money(t.bonus_pay, cur)}`} icon={Coins} color="#0A84FF" testId="kpi-gross" delay={180} />
          <Kpi label="Нетто (оценка)" value={money(tax.net, cur)} sub={`налоги ~${tax.effective_rate || 0}%`} icon={Wallet} color="#30D158" testId="kpi-net" delay={240} />
        </div>
        <div className="md:col-span-12 lg:col-span-7"><RecentChart stats={stats} /></div>
        <div className="md:col-span-12 lg:col-span-5"><UpcomingHolidays /></div>
        <div className="md:col-span-12"><AiTeaser /></div>
      </div>
    </div>
  );
}
