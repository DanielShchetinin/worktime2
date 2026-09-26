import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PartyPopper, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, apiError } from "@/lib/api";
import { useDay, useSettings, useRefreshAll } from "@/hooks/useData";
import { dateLong, hrs, money2, KIND_LABELS } from "@/lib/format";
import { Label, RateBadge } from "@/components/Glass";
import { SegmentsEditor } from "@/components/SegmentsEditor";

const BONUS_CHIPS = [0, 10, 20, 30, 50];
const PRESETS = [["08:00", "17:00"], ["09:00", "18:00"], ["08:00", "13:00"]];

const blank = (type, s) => ({ day_type: type || "work", segments: [], break_minutes: s?.break_minutes_default || 0, bonus_pct: null, paid_hours: null, norm_hours: null, comment: "", extra_pay: 0 });
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const CalcSummary = ({ calc }) => (
  <div className="rounded-2xl bg-soft border hair p-4 flex flex-wrap items-center gap-x-6 gap-y-2" data-testid="entry-calc-summary">
    <div><Label>Часы</Label><div className="num font-semibold mt-1">{hrs(calc.worked_hours || calc.leave_hours)}</div></div>
    <div><Label>Засчитано</Label><div className="num font-semibold mt-1">{hrs(calc.credited_hours)}</div></div>
    <div><Label>Брутто</Label><div className="num font-semibold mt-1 text-[#0A84FF]">{money2(calc.gross)}</div></div>
    <div className="flex gap-1 flex-wrap">{Object.keys(calc.breakdown || {}).map((r) => <RateBadge key={r} rate={r} />)}</div>
  </div>
);

export const EntryDialog = ({ date, open, onOpenChange }) => {
  const { data: settings } = useSettings();
  const { data } = useDay(date, open);
  const refresh = useRefreshAll();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && data && data.date === date) setF(data.entry ? { ...blank(), ...data.entry } : blank(data.suggested_type, settings));
    if (!open) setF(null);
  }, [open, data, date, settings]);

  const types = settings?.day_types || [];
  const t = types.find((x) => x.key === f?.day_type) || types[0];
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, break_minutes: Number(f.break_minutes) || 0, extra_pay: Number(f.extra_pay) || 0, bonus_pct: numOrNull(f.bonus_pct), paid_hours: numOrNull(f.paid_hours), norm_hours: numOrNull(f.norm_hours) };
      if (t.kind !== "work") body.segments = body.segments.filter((s) => !s.end);
      const { data: r } = await api.put(`/entries/${date}`, body);
      await refresh();
      toast.success(`Сохранено · ${money2(r.calc?.gross)}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await api.delete(`/entries/${date}`);
    await refresh();
    toast.success("Запись удалена");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass !rounded-[20px] max-w-2xl w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto p-5 sm:p-7 border-0" data-testid="entry-dialog">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold capitalize">{date && dateLong(date)}</DialogTitle>
          <DialogDescription className="txt-2">Отметьте день, время и особые условия</DialogDescription>
        </DialogHeader>
        {!f ? (
          <div className="py-10 text-center txt-2">Загрузка…</div>
        ) : (
          <div className="space-y-6">
            {data?.holiday && (
              <div className="flex items-center gap-2 text-sm font-semibold text-[#FF9500] bg-[#FF9500]/10 rounded-2xl px-4 py-3">
                <PartyPopper size={16} /> {data.holiday.name}
                {data.holiday.day_off && <span className="text-xs txt-2 font-medium">· нерабочий</span>}
              </div>
            )}
            {data?.calc && <CalcSummary calc={data.calc} />}

            <div>
              <Label className="mb-3">Категория дня</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {types.map((x) => {
                  const on = x.key === f.day_type;
                  return (
                    <button key={x.key} onClick={() => set("day_type", x.key)} data-testid={`day-type-${x.key}`}
                      className="text-left rounded-2xl px-3 py-2.5 border transition-all active:scale-[0.97]"
                      style={{ background: on ? `${x.color}24` : "var(--soft)", borderColor: on ? x.color : "var(--hair)" }}>
                      <div className="flex items-center gap-2 text-sm font-semibold"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: x.color }} /><span className="truncate">{x.name}</span></div>
                      <div className="text-[11px] txt-2 mt-0.5">{KIND_LABELS[x.kind]}{x.kind === "work" && x.rate !== 100 ? ` · ${x.rate}%` : ""}{x.bonus_pct ? ` · +${x.bonus_pct}%` : ""}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {t?.kind === "work" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label>Время работы</Label>
                  <div className="flex gap-1.5">
                    {PRESETS.map(([a, b]) => (
                      <button key={a + b} onClick={() => set("segments", [{ start: a, end: b, rate: null }])} className="num text-[11px] px-2.5 py-1 rounded-full bg-soft border hair hover:border-[#0A84FF]" data-testid={`preset-${a}-${b}`}>{a}–{b}</button>
                    ))}
                  </div>
                </div>
                <SegmentsEditor segments={f.segments} onChange={(v) => set("segments", v)} />
                <p className="text-xs txt-2">«Авто» — до нормы по базовой ставке, дальше {settings?.ot1_rate}% и {settings?.ot2_rate}%. Укажите процент, чтобы отрезок считался строго по нему.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="mb-2">Перерыв, мин</Label><input type="number" min="0" className="field num" value={f.break_minutes} onChange={(e) => set("break_minutes", e.target.value)} data-testid="entry-break-input" /></div>
                  <div><Label className="mb-2">Норма, ч</Label><input type="number" step="0.1" min="0" className="field num" placeholder={String(data?.calc?.norm_hours || data?.expected_hours || settings?.daily_norm_hours)} value={f.norm_hours ?? ""} onChange={(e) => set("norm_hours", e.target.value)} data-testid="entry-norm-input" /></div>
                </div>
                <div>
                  <Label className="mb-2">Бонус к засчитанному времени</Label>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <button onClick={() => set("bonus_pct", null)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${f.bonus_pct === null ? "bg-[#0A84FF] text-white border-transparent" : "bg-soft hair"}`} data-testid="bonus-default">По категории{t.bonus_pct ? ` (+${t.bonus_pct}%)` : ""}</button>
                    {BONUS_CHIPS.map((b) => (
                      <button key={b} onClick={() => set("bonus_pct", b)} className={`num text-xs font-semibold px-3 py-1.5 rounded-full border ${Number(f.bonus_pct) === b && f.bonus_pct !== null ? "bg-[#0A84FF] text-white border-transparent" : "bg-soft hair"}`} data-testid={`bonus-${b}`}>+{b}%</button>
                    ))}
                    <input type="number" className="field num !h-8 !w-20 !text-xs" placeholder="свой %" value={f.bonus_pct ?? ""} onChange={(e) => set("bonus_pct", e.target.value)} data-testid="entry-bonus-input" />
                  </div>
                </div>
              </div>
            )}

            {t?.kind === "paid" && (
              <div><Label className="mb-2">Оплачиваемых часов</Label><input type="number" step="0.1" className="field num" placeholder={String(data?.expected_hours || settings?.daily_norm_hours)} value={f.paid_hours ?? ""} onChange={(e) => set("paid_hours", e.target.value)} data-testid="entry-paid-hours-input" /><p className="text-xs txt-2 mt-2">Оплата {t.pay_percent}% от ставки</p></div>
            )}

            <div className="grid sm:grid-cols-3 gap-3">
              <div><Label className="mb-2">Доплата, ₪</Label><input type="number" className="field num" value={f.extra_pay} onChange={(e) => set("extra_pay", e.target.value)} data-testid="entry-extra-input" /></div>
              <div className="sm:col-span-2"><Label className="mb-2">Комментарий</Label><Textarea rows={2} className="rounded-xl bg-soft border hair min-h-[44px]" value={f.comment} onChange={(e) => set("comment", e.target.value)} placeholder="Например: ушёл раньше, засчитали полный день" data-testid="entry-comment-input" /></div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {data?.entry && (
                <button onClick={remove} className="h-12 px-4 rounded-full text-sm font-semibold text-[#FF453A] hover:bg-[#FF453A]/10 flex items-center gap-2" data-testid="entry-delete-button"><Trash2 size={16} /> Удалить</button>
              )}
              <div className="flex-1" />
              <button onClick={() => onOpenChange(false)} className="h-12 px-5 rounded-full text-sm font-semibold bg-soft border hair" data-testid="entry-cancel-button">Отмена</button>
              <button onClick={save} disabled={busy} className="h-12 px-7 rounded-full text-sm font-semibold bg-[#0A84FF] text-white active:scale-95 transition-transform disabled:opacity-50" data-testid="entry-save-button">Сохранить</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
