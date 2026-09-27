import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, X, Settings2, CalendarDays, PartyPopper, Tag, Receipt, Trash2, Loader2, CircleCheck, CircleSlash } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiError } from "@/lib/api";
import { useSettings, typeMap } from "@/hooks/useData";
import { WD_SHORT, dateShort, monthTitle, KIND_LABELS, HOLIDAY_KIND } from "@/lib/format";

const LABELS = {
  hourly_rate: "Ставка в час, ₪", daily_norm_hours: "Норма в день, ч", work_days: "Рабочие дни", ot1_hours: "Первые сверхурочные, ч",
  ot1_rate: "Ставка 1-х сверхурочных, %", ot2_rate: "Ставка далее, %", special_ot_rate: "Сверхурочные в праздник, %",
  break_minutes_default: "Перерыв, мин", travel_per_day: "Проезд в день, ₪", monthly_goal_hours: "Цель часов", monthly_goal_income: "Цель дохода, ₪",
  tax_enabled: "Считать налоги", credit_points: "Налоговые баллы", credit_point_value: "Стоимость балла, ₪", pension_pct: "Пенсия, %",
  study_fund_pct: "Керен иштальмут, %", auto_holidays: "Праздники Израиля", show_optional_holidays: "Памятные дни", auto_paid_holidays: "Оплата праздников",
  sick_law_il: "Больничный по закону", reminders_enabled: "Напоминания", reminder_start_time: "Начало смены", reminder_end_time: "Конец смены", timezone: "Часовой пояс",
  name: "Название", color: "Цвет", kind: "Тип", rate: "Ставка, %", norm_hours: "Норма, ч", pay_percent: "Оплата, %", bonus_pct: "Бонус, %",
  day_off: "Нерабочий день", day_type: "Категория", segments: "Время", break_minutes: "Перерыв, мин", paid_hours: "Оплачиваемых часов",
  comment: "Комментарий", extra_pay: "Доплата, ₪", only_workdays: "Только рабочие дни", gross: "Брутто, ₪", net: "Нетто, ₪", hours: "Часы",
  income_tax: "Подоходный налог, ₪", social: "Битуах Леуми, ₪", pension: "Пенсия, ₪",
};
const IN_TITLE = new Set(["key", "date", "month", "start", "end"]);
const ds = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? dateShort(d) : d || "");
const ms = (m) => (m && /^\d{4}-\d{2}$/.test(m) ? monthTitle(m).toLowerCase() : m || "");

const META = {
  update_settings: { icon: Settings2, color: "#0A84FF", title: () => "Изменить настройки" },
  upsert_day_type: { icon: Tag, color: "#BF5AF2", title: (a) => `Категория «${a.name || a.key}»` },
  delete_day_type: { icon: Trash2, color: "#FF3B30", title: (a) => `Удалить категорию «${a.key}»` },
  set_holiday: { icon: PartyPopper, color: "#FF9500", title: (a) => `Особый день · ${ds(a.date)}` },
  remove_holiday: { icon: Trash2, color: "#FF3B30", title: (a) => `Убрать праздник · ${ds(a.date)}` },
  upsert_entry: { icon: CalendarDays, color: "#34C759", title: (a) => `Запись за ${ds(a.date)}` },
  bulk_set_days: { icon: CalendarDays, color: "#0A84FF", title: (a) => `Период ${ds(a.start)} — ${ds(a.end)}` },
  delete_entry: { icon: Trash2, color: "#FF3B30", title: (a) => `Удалить запись за ${ds(a.date)}` },
  set_payslip: { icon: Receipt, color: "#5E5CE6", title: (a) => `Тлуш за ${ms(a.month)}` },
};

const Field = ({ k, v, onChange, types }) => {
  const label = LABELS[k] || k;
  let input;
  if (k === "day_type") {
    input = (
      <Select value={v || ""} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-[10px] bg-soft border-0"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.values(types).map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}</SelectContent>
      </Select>
    );
  } else if (k === "kind") {
    const opts = { ...KIND_LABELS, ...HOLIDAY_KIND };
    input = (
      <Select value={v || ""} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-[10px] bg-soft border-0"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(opts).map(([a, b]) => <SelectItem key={a} value={a}>{b}</SelectItem>)}</SelectContent>
      </Select>
    );
  } else if (typeof v === "boolean") {
    input = <Switch checked={v} onCheckedChange={onChange} />;
  } else if (typeof v === "number") {
    input = <input type="number" step="any" className="field !h-10 num" value={v} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
  } else if (k === "work_days" && Array.isArray(v)) {
    input = (
      <div className="flex gap-1">
        {WD_SHORT.map((w, i) => (
          <button key={w} type="button" onClick={() => onChange(v.includes(i) ? v.filter((x) => x !== i) : [...v, i].sort())}
            className={`w-8 h-8 rounded-[8px] text-[11px] font-semibold ${v.includes(i) ? "bg-[#34C759] text-white" : "bg-soft txt-2"}`}>{w}</button>
        ))}
      </div>
    );
  } else if (k === "segments" && Array.isArray(v)) {
    input = <div className="flex flex-wrap gap-1">{v.map((s, i) => <span key={i} className="num text-[12px] px-2 py-1 rounded-md bg-soft">{s.start}–{s.end}{s.rate ? ` · ${s.rate}%` : ""}</span>)}</div>;
  } else if (k === "color") {
    input = <input type="color" value={v || "#64D2FF"} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded-[10px] bg-transparent" />;
  } else {
    const isTime = typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
    input = <input type={isTime ? "time" : "text"} className="field !h-10" value={v ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  const inline = typeof v === "boolean";
  return (
    <div className={inline ? "flex items-center justify-between gap-3 col-span-2" : k === "segments" || k === "work_days" || k === "comment" || k === "name" ? "col-span-2" : ""}>
      <div className={`text-[12px] txt-2 font-medium ${inline ? "" : "mb-1"}`}>{label}</div>
      {input}
    </div>
  );
};

const Done = ({ status, count }) => (
  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}
    className={`mt-2 inline-flex items-center gap-2 text-[13px] font-semibold px-3 py-1.5 rounded-full ${status === "applied" ? "bg-[#34C759]/15 text-[#34C759]" : "bg-soft txt-2"}`} data-testid={`proposal-${status}`}>
    {status === "applied" ? <CircleCheck size={15} /> : <CircleSlash size={15} />}
    {status === "applied" ? `Применено изменений: ${count}` : "Изменения отменены"}
  </motion.div>
);

export const ProposalCard = ({ proposal, onResolve }) => {
  const [actions, setActions] = useState(proposal.actions);
  const [busy, setBusy] = useState(false);
  const { data: settings } = useSettings();
  const types = typeMap(settings);
  if (proposal.status) return <Done status={proposal.status} count={proposal.actions.length} />;

  const setArg = (i, k, v) => setActions((p) => p.map((a, j) => {
    if (j !== i) return a;
    return a.tool === "update_settings" ? { ...a, args: { ...a.args, patch: { ...a.args.patch, [k]: v } } } : { ...a, args: { ...a.args, [k]: v } };
  }));

  const apply = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/chat/apply", { actions });
      const bad = data.results.filter((r) => !r.ok);
      if (bad.length) toast.error(bad.map((b) => b.error).join("; "));
      else toast.success("Готово — изменения применены");
      onResolve("applied", actions);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="mt-2 glass rounded-[20px] p-4 border hair" data-testid="proposal-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[15px] font-semibold">Проверьте изменения</div>
        <span className="text-[12px] txt-2">{actions.length} шт.</span>
      </div>
      <div className="space-y-2.5">
        {actions.map((a, i) => {
          const meta = META[a.tool] || { icon: Settings2, color: "#8E8E93", title: () => a.tool };
          const fields = Object.entries(a.tool === "update_settings" ? a.args.patch || {} : a.args).filter(([k]) => !IN_TITLE.has(k));
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i + 0.1 }}
              className="rounded-[14px] bg-soft/50 border hair p-3" data-testid={`proposal-action-${i}`}>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-[9px] grid place-items-center text-white shrink-0" style={{ background: meta.color }}><meta.icon size={16} /></span>
                <span className="text-[14px] font-semibold">{meta.title(a.args)}</span>
              </div>
              {fields.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 mt-3">
                  {fields.map(([k, v]) => <Field key={k} k={k} v={v} types={types} onChange={(nv) => setArg(i, k, nv)} />)}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => onResolve("cancelled", actions)} disabled={busy} className="flex-1 h-11 rounded-[12px] bg-soft text-[15px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform" data-testid="proposal-cancel-button"><X size={16} /> Отменить</button>
        <button onClick={apply} disabled={busy} className="flex-[1.4] h-11 rounded-[12px] bg-[#0A84FF] text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60" data-testid="proposal-apply-button">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />} Применить
        </button>
      </div>
    </motion.div>
  );
};
