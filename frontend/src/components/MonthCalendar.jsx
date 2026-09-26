import { WD_SHORT, hrsShort } from "@/lib/format";

export const MonthCalendar = ({ days, types, onSelect, today }) => {
  const offset = days[0]?.weekday || 0;
  return (
    <div data-testid="month-calendar">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
        {WD_SHORT.map((w, i) => (
          <div key={w} className={`text-center text-[11px] font-bold uppercase tracking-wider ${i >= 5 ? "text-[#FF6B6B]" : "txt-2"}`}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: offset }).map((_, i) => <div key={`b${i}`} />)}
        {days.map((d, i) => {
          const t = d.calc ? types[d.calc.day_type] : null;
          const color = t?.color;
          const isToday = d.date === today;
          const off = d.expected_hours === 0 && !d.calc;
          const h = d.calc?.worked_hours || d.calc?.leave_hours || 0;
          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              data-testid={`calendar-day-${d.date}`}
              className="group relative aspect-square sm:aspect-[1/0.92] rounded-2xl p-1.5 sm:p-2.5 flex flex-col text-left border transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 fade-up overflow-hidden"
              style={{
                animationDelay: `${i * 12}ms`,
                background: color ? `${color}22` : off ? "transparent" : "var(--soft)",
                borderColor: isToday ? "#0A84FF" : color ? `${color}45` : "var(--hair)",
                boxShadow: isToday ? "0 0 0 2px #0A84FF" : undefined,
              }}
            >
              <div className="flex items-start justify-between">
                <span className={`num text-sm sm:text-base font-semibold ${off ? "txt-2" : ""} ${isToday ? "text-[#0A84FF]" : ""}`}>{Number(d.date.slice(8))}</span>
                {d.holiday && (
                  <span className="w-2 h-2 rounded-full mt-1" style={{ background: d.holiday.day_off ? "#FF9500" : d.holiday.kind === "eve" ? "#FFCC00" : "#8E8E93" }} />
                )}
              </div>
              {d.holiday && <div className="hidden sm:block text-[10px] leading-tight txt-2 mt-0.5 line-clamp-2">{d.holiday.name}</div>}
              <div className="mt-auto flex items-center gap-1">
                {color && <span className="hidden sm:block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
                {h > 0 && <span className="num text-[10px] sm:text-xs font-semibold truncate">{hrsShort(h)}</span>}
                {d.calc && h === 0 && <span className="text-[10px] truncate hidden sm:inline" style={{ color }}>{t?.name}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
