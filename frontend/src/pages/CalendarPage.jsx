import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, PartyPopper, Pencil } from "lucide-react";
import { useMonthStats, useSettings, typeMap } from "@/hooks/useData";
import { monthKey, shiftMonth, monthTitle, todayISO, hrs, money, dateShort, HOLIDAY_KIND } from "@/lib/format";
import { GlassCard, Label, Spinner } from "@/components/Glass";
import { MonthCalendar } from "@/components/MonthCalendar";
import { EntryDialog } from "@/components/EntryDialog";
import { HolidayDialog } from "@/components/HolidayDialog";
import { BulkDialog } from "@/components/BulkDialog";

const NavBtn = ({ children, ...p }) => (
  <button className="w-10 h-10 rounded-full grid place-items-center bg-soft border hair hover:scale-105 active:scale-95 transition-transform" {...p}>{children}</button>
);

export default function CalendarPage() {
  const [month, setMonth] = useState(monthKey());
  const [sel, setSel] = useState(null);
  const [hol, setHol] = useState({ open: false, holiday: null });
  const [bulk, setBulk] = useState(false);
  const { data: stats, isLoading } = useMonthStats(month);
  const { data: settings } = useSettings();
  const types = typeMap(settings);
  const t = stats?.totals || {};
  const holidays = (stats?.days || []).filter((d) => d.holiday).map((d) => d.holiday);

  return (
    <div className="space-y-5" data-testid="calendar-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Label>Календарь</Label>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-tight mt-1" data-testid="calendar-month-title">{monthTitle(month)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NavBtn onClick={() => setMonth(shiftMonth(month, -1))} data-testid="calendar-prev-month"><ChevronLeft size={18} /></NavBtn>
          <button onClick={() => setMonth(monthKey())} className="h-10 px-4 rounded-full bg-soft border hair text-sm font-semibold" data-testid="calendar-today-button">Сегодня</button>
          <NavBtn onClick={() => setMonth(shiftMonth(month, 1))} data-testid="calendar-next-month"><ChevronRight size={18} /></NavBtn>
          <button onClick={() => setBulk(true)} className="h-10 px-4 rounded-full bg-[#0A84FF] text-white text-sm font-semibold flex items-center gap-1.5" data-testid="bulk-open-button"><Plus size={16} /> Период</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <GlassCard className="lg:col-span-8 p-3 sm:p-6">
          {isLoading ? <Spinner /> : <MonthCalendar days={stats.days} types={types} today={todayISO()} onSelect={setSel} />}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-5 px-1" data-testid="calendar-legend">
            {(settings?.day_types || []).map((x) => (
              <span key={x.key} className="flex items-center gap-1.5 text-xs txt-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: x.color }} />{x.name}</span>
            ))}
          </div>
        </GlassCard>

        <div className="lg:col-span-4 space-y-5">
          <GlassCard className="p-6" data-testid="calendar-month-summary">
            <Label>Итог месяца</Label>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div><div className="text-xs txt-2">Отработано</div><div className="num text-xl font-semibold mt-1">{hrs(t.worked_hours)}</div></div>
              <div><div className="text-xs txt-2">Норма</div><div className="num text-xl font-semibold mt-1">{hrs(t.expected_hours)}</div></div>
              <div><div className="text-xs txt-2">Брутто</div><div className="num text-xl font-semibold mt-1 text-[#0A84FF]">{money(t.gross)}</div></div>
              <div><div className="text-xs txt-2">Нетто</div><div className="num text-xl font-semibold mt-1 text-[#30D158]">{money(stats?.tax?.net)}</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-5">
              {Object.entries(t.counts || {}).map(([k, n]) => (
                <span key={k} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: types[k]?.color, background: `${types[k]?.color}1c` }}>{types[k]?.name}: {n}</span>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6" data-testid="calendar-holidays-card">
            <div className="flex items-center justify-between">
              <Label>Праздники месяца</Label>
              <button onClick={() => setHol({ open: true, holiday: null })} className="text-xs font-semibold text-[#0A84FF] flex items-center gap-1" data-testid="holiday-add-button"><Plus size={14} /> Свой день</button>
            </div>
            <div className="mt-2">
              {holidays.map((h) => (
                <button key={h.date} onClick={() => setHol({ open: true, holiday: h })} className="w-full text-left flex items-center gap-3 py-3 border-b hair last:border-0 hover:opacity-70 transition-opacity group" data-testid={`holiday-item-${h.date}`}>
                  <PartyPopper size={16} className="text-[#FF9500] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{h.name}</div>
                    <div className="text-xs txt-2">{dateShort(h.date)} · {HOLIDAY_KIND[h.kind] || h.kind}{h.day_off ? " · выходной" : ""}{h.source === "user" ? " · изменён" : ""}</div>
                  </div>
                  <Pencil size={14} className="txt-2 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
              {!holidays.length && <div className="text-sm txt-2">В этом месяце праздников нет</div>}
            </div>
          </GlassCard>
        </div>
      </div>

      <EntryDialog date={sel} open={!!sel} onOpenChange={(o) => !o && setSel(null)} />
      <HolidayDialog open={hol.open} holiday={hol.holiday} onOpenChange={(o) => setHol((p) => ({ ...p, open: o }))} />
      <BulkDialog open={bulk} onOpenChange={setBulk} />
    </div>
  );
}
