import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Timer, Flame, CalendarCheck, Coins, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMonthStats, useYearStats, useSettings, typeMap } from "@/hooks/useData";
import { monthKey, shiftMonth, monthTitle, hrs, hrsShort, money, money2, rateColor, dateShort, MONTHS_SHORT } from "@/lib/format";
import { GlassCard, Label, Kpi, RateBadge, TypePill, Spinner } from "@/components/Glass";

const tip = { background: "var(--glass-strong)", border: "1px solid var(--glass-border)", borderRadius: 14, backdropFilter: "blur(20px)", fontSize: 12 };
const axis = { fontSize: 10, fill: "var(--txt-2)" };

const DailyChart = ({ days }) => {
  const rates = [...new Set(days.flatMap((d) => Object.keys(d.calc?.breakdown || {})))].sort((a, b) => a - b);
  const data = days.map((d) => ({ name: Number(d.date.slice(8)), ...Object.fromEntries(rates.map((r) => [r, +(d.calc?.breakdown?.[r] || 0).toFixed(2)])) }));
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="var(--hair)" />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} width={28} />
          <Tooltip cursor={{ fill: "var(--soft)" }} contentStyle={tip} formatter={(v, n) => [hrs(v), `${n}%`]} labelFormatter={(l) => `${l} число`} />
          {rates.map((r, i) => <Bar key={r} dataKey={r} stackId="a" fill={rateColor(r)} radius={i === rates.length - 1 ? [6, 6, 2, 2] : [2, 2, 2, 2]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const RatePie = ({ payByRate, hours }) => {
  const data = Object.entries(payByRate || {}).map(([r, v]) => ({ name: r, value: v })).sort((a, b) => a.name - b.name);
  return (
    <div>
      <div className="h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="none" cornerRadius={8}>
              {data.map((d) => <Cell key={d.name} fill={rateColor(d.name)} />)}
            </Pie>
            <Tooltip contentStyle={tip} formatter={(v, n) => [money2(v), `${n}%`]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><RateBadge rate={d.name} /><span className="txt-2 num text-xs">{hrs(hours?.[d.name])}</span></span>
            <span className="num font-semibold">{money(d.value)}</span>
          </div>
        ))}
        {!data.length && <div className="text-sm txt-2">Нет рабочих часов</div>}
      </div>
    </div>
  );
};

const SalaryBreakdown = ({ tax, totals }) => {
  const rows = [
    { l: "Работа (по ставкам)", v: totals.work_pay, c: "#0A84FF" },
    { l: "Бонусы", v: totals.bonus_pay, c: "#64D2FF" },
    { l: "Отпуск / больничный / праздники", v: totals.leave_pay, c: "#5E5CE6" },
    { l: "Доплаты и проезд", v: totals.extra_pay, c: "#30D158" },
    { l: "Подоходный налог", v: -tax.income_tax, c: "#FF453A" },
    { l: "Битуах Леуми + здоровье", v: -tax.social, c: "#FF9F0A" },
    { l: "Пенсия", v: -tax.pension, c: "#BF5AF2" },
    { l: "Керен иштальмут", v: -tax.study_fund, c: "#FF6B6B" },
  ].filter((r) => Math.abs(r.v || 0) > 0.005);
  const max = Math.max(tax.gross || 0, 1);
  return (
    <div className="space-y-3" data-testid="salary-breakdown">
      {rows.map((r) => (
        <div key={r.l}>
          <div className="flex justify-between text-sm"><span className="txt-2">{r.l}</span><span className="num font-semibold" style={{ color: r.v < 0 ? r.c : undefined }}>{r.v < 0 ? "−" : ""}{money2(Math.abs(r.v))}</span></div>
          <div className="h-1.5 rounded-full bg-soft mt-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(Math.abs(r.v) / max) * 100}%`, background: r.c }} /></div>
        </div>
      ))}
      <div className="pt-3 mt-1 border-t hair flex items-end justify-between">
        <div><div className="text-xs txt-2">На руки (оценка)</div><div className="num text-3xl font-semibold text-[#30D158]" data-testid="stats-net">{money2(tax.net)}</div></div>
        <div className="text-right"><div className="text-xs txt-2">Эффективно</div><div className="num font-semibold">{tax.effective_rate}%</div></div>
      </div>
      <div className="text-[11px] txt-2">Оценка по шкале налогов Израиля с учётом нкудот зикуй. Реальная сумма может отличаться.</div>
    </div>
  );
};

const MonthView = ({ month }) => {
  const { data, isLoading } = useMonthStats(month);
  const { data: settings } = useSettings();
  const types = typeMap(settings);
  if (isLoading || !data) return <Spinner />;
  const t = data.totals;
  const logged = data.days.filter((d) => d.calc);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Отработано" value={hrs(t.worked_hours)} icon={Clock} color="#FF2D55" testId="stats-kpi-worked" />
        <Kpi label="Засчитано" value={hrs(t.credited_hours)} sub="с бонусами и отпуском" icon={Timer} color="#FF9500" testId="stats-kpi-credited" delay={50} />
        <Kpi label="Сверхурочные" value={hrs(t.overtime_hours)} icon={Flame} color="#FF9F0A" testId="stats-kpi-overtime" delay={100} />
        <Kpi label="Рабочих дней" value={t.worked_days} sub={`ср. ${hrs(t.avg_hours)} в день`} icon={CalendarCheck} color="#30D158" testId="stats-kpi-days" delay={150} />
        <Kpi label="Брутто" value={money(t.gross)} icon={Coins} color="#0A84FF" testId="stats-kpi-gross" delay={200} />
        <Kpi label="Нетто" value={money(data.tax.net)} icon={Wallet} color="#30D158" testId="stats-kpi-net" delay={250} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <GlassCard className="lg:col-span-8 p-6"><Label className="mb-4">Часы по дням и ставкам</Label><DailyChart days={data.days} /></GlassCard>
        <GlassCard className="lg:col-span-4 p-6"><Label className="mb-2">Доход по ставкам</Label><RatePie payByRate={t.pay_by_rate} hours={t.breakdown} /></GlassCard>
        <GlassCard className="lg:col-span-5 p-6"><Label className="mb-4">Брутто → нетто</Label><SalaryBreakdown tax={data.tax} totals={t} /></GlassCard>
        <GlassCard className="lg:col-span-7 p-6 overflow-hidden" data-testid="stats-days-table">
          <Label className="mb-4">Журнал дней</Label>
          <div className="max-h-[420px] overflow-y-auto -mx-2 px-2">
            {logged.map((d) => (
              <div key={d.date} className="flex items-center gap-3 py-3 border-b hair last:border-0 text-sm">
                <div className="num w-14 shrink-0 font-semibold">{dateShort(d.date)}</div>
                <TypePill type={types[d.calc.day_type]} className="hidden sm:inline-flex" />
                <span className="w-2 h-2 rounded-full sm:hidden" style={{ background: types[d.calc.day_type]?.color }} />
                <div className="flex gap-1 flex-wrap">{Object.keys(d.calc.breakdown).map((r) => <RateBadge key={r} rate={r} />)}</div>
                <div className="flex-1 truncate txt-2 text-xs">{d.entry?.comment}</div>
                <div className="num text-xs txt-2 shrink-0">{hrs(d.calc.credited_hours)}</div>
                <div className="num font-semibold shrink-0 w-20 text-right">{money(d.calc.gross)}</div>
              </div>
            ))}
            {!logged.length && <div className="text-sm txt-2">Записей пока нет</div>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

const MonthsList = ({ rows, year }) => {
  const list = [...rows].reverse().filter((r) => r.worked_hours || r.gross);
  const tot = rows.reduce((a, r) => ({ h: a.h + r.worked_hours, e: a.e + r.expected_hours, g: a.g + r.gross }), { h: 0, e: 0, g: 0 });
  const Delta = ({ d }) => <span className={d >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"}>{d >= 0 ? "+" : "−"}{hrsShort(Math.abs(d))}</span>;
  return (
    <GlassCard className="overflow-hidden" data-testid="year-months-list">
      <div className="px-5 pt-4 pb-2 text-[13px] font-semibold txt-2">{year}</div>
      {list.map((r) => (
        <div key={r.month} className="flex items-center gap-4 px-5 py-3 border-t hair" data-testid={`year-month-row-${r.month}`}>
          <span className="w-12 text-[13px] font-semibold uppercase text-[#FF3B30]">{r.name}</span>
          <span className="flex-1 text-[15px] txt-2">{r.worked_days} дн.</span>
          <div className="text-right">
            <div className="num text-[15px] font-medium">{hrs(r.worked_hours)} <Delta d={r.worked_hours - r.expected_hours} /></div>
            <div className="num text-[13px] txt-2">{money2(r.gross)}</div>
          </div>
        </div>
      ))}
      {!list.length && <div className="px-5 py-4 border-t hair text-sm txt-2">Нет данных за год</div>}
      <div className="flex items-center gap-4 px-5 py-3.5 border-t hair bg-soft">
        <span className="flex-1 text-[15px] font-semibold">Итого</span>
        <div className="text-right">
          <div className="num text-[15px] font-semibold">{hrs(tot.h)} <Delta d={tot.h - tot.e} /></div>
          <div className="num text-[13px] font-medium">{money2(tot.g)}</div>
        </div>
      </div>
    </GlassCard>
  );
};

const YearView = ({ year }) => {
  const { data, isLoading } = useYearStats(year);
  if (isLoading || !data) return <Spinner />;
  const rows = data.months.map((m) => ({ ...m, name: MONTHS_SHORT[Number(m.month.slice(5)) - 1] }));
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Часов за год" value={hrs(sum("worked_hours"))} icon={Clock} color="#FF2D55" testId="year-kpi-hours" />
        <Kpi label="Сверхурочные" value={hrs(sum("overtime_hours"))} icon={Flame} color="#FF9F0A" testId="year-kpi-overtime" />
        <Kpi label="Брутто за год" value={money(sum("gross"))} icon={Coins} color="#0A84FF" testId="year-kpi-gross" />
        <Kpi label="Нетто за год" value={money(sum("net"))} icon={Wallet} color="#30D158" testId="year-kpi-net" />
      </div>
      <MonthsList rows={rows} year={year} />
      <GlassCard className="p-6">
        <Label className="mb-4">Доход по месяцам</Label>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <defs>
                <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0A84FF" stopOpacity={0.5} /><stop offset="100%" stopColor="#0A84FF" stopOpacity={0} /></linearGradient>
                <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30D158" stopOpacity={0.5} /><stop offset="100%" stopColor="#30D158" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--hair)" />
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={tip} formatter={(v, n) => [money(v), n === "gross" ? "Брутто" : "Нетто"]} />
              <Area type="monotone" dataKey="gross" stroke="#0A84FF" strokeWidth={2.5} fill="url(#gGross)" />
              <Area type="monotone" dataKey="net" stroke="#30D158" strokeWidth={2.5} fill="url(#gNet)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
      <GlassCard className="p-6">
        <Label className="mb-4">Часы: факт и норма</Label>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={3}>
              <CartesianGrid vertical={false} stroke="var(--hair)" />
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} width={32} />
              <Tooltip cursor={{ fill: "var(--soft)" }} contentStyle={tip} formatter={(v, n) => [hrs(v), n === "worked_hours" ? "Факт" : "Норма"]} />
              <Bar dataKey="expected_hours" fill="var(--hair)" radius={[6, 6, 2, 2]} />
              <Bar dataKey="worked_hours" fill="#FF2D55" radius={[6, 6, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
};

export default function StatsPage() {
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(monthKey());
  const year = Number(month.slice(0, 4));
  const { data: settings } = useSettings();
  const move = (d) => setMonth(mode === "month" ? shiftMonth(month, d) : `${year + d}-${month.slice(5)}`);
  return (
    <div className="space-y-5" data-testid="stats-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Label>Статистика</Label>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-tight mt-1" data-testid="stats-title">{mode === "month" ? monthTitle(month) : `${year} год`}</h1>
          <div className="num text-[15px] txt-2 mt-0.5" data-testid="stats-hourly-rate">{money2(settings?.hourly_rate)} в час</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-[9px] bg-soft">
            {[["month", "Месяц"], ["year", "Год"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className={`h-8 px-5 rounded-[7px] text-[13px] font-semibold transition-colors ${mode === k ? "bg-white dark:bg-[#636366] shadow-sm" : ""}`} data-testid={`stats-mode-${k}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => move(-1)} className="w-10 h-10 rounded-full grid place-items-center bg-soft border hair" data-testid="stats-prev"><ChevronLeft size={18} /></button>
          <button onClick={() => move(1)} className="w-10 h-10 rounded-full grid place-items-center bg-soft border hair" data-testid="stats-next"><ChevronRight size={18} /></button>
        </div>
      </div>
      {mode === "month" ? <MonthView month={month} /> : <YearView year={year} />}
    </div>
  );
}
