import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Sun, Moon, LogOut, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiError } from "@/lib/api";
import { useSettings, useRefreshAll, useHolidays } from "@/hooks/useData";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { WD_SHORT, KIND_LABELS, HOLIDAY_KIND, dateShort } from "@/lib/format";
import { GlassCard, Label, Spinner } from "@/components/Glass";
import { HolidayDialog } from "@/components/HolidayDialog";
import { PhoneSettings } from "@/components/PhoneSettings";

const Field = ({ label, hint, children }) => (
  <div>
    <Label className="mb-2">{label}</Label>
    {children}
    {hint && <div className="text-xs txt-2 mt-1.5">{hint}</div>}
  </div>
);

const Num = ({ value, onChange, step = "1", testId }) => (
  <input type="number" step={step} className="field num" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid={testId} />
);

const Toggle = ({ title, desc, checked, onChange, testId }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-soft border hair px-4 py-3.5">
    <div><div className="text-sm font-semibold">{title}</div>{desc && <div className="text-xs txt-2 mt-0.5">{desc}</div>}</div>
    <Switch checked={!!checked} onCheckedChange={onChange} data-testid={testId} />
  </div>
);

const TypeRow = ({ t, onChange, onDelete }) => (
  <div className="rounded-2xl bg-soft border hair p-3 space-y-3" data-testid={`type-row-${t.key}`}>
    <div className="flex items-center gap-2">
      <input type="color" value={t.color} onChange={(e) => onChange({ color: e.target.value })} className="w-10 h-10 rounded-xl border-0 bg-transparent cursor-pointer shrink-0" />
      <input className="field flex-1" value={t.name} onChange={(e) => onChange({ name: e.target.value })} data-testid={`type-name-${t.key}`} />
      <Select value={t.kind} onValueChange={(v) => onChange({ kind: v })}>
        <SelectTrigger className="h-11 rounded-xl w-[150px] bg-transparent hidden sm:flex"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
      </Select>
      {!t.builtin && <button onClick={onDelete} className="w-10 h-10 rounded-full grid place-items-center txt-2 hover:text-[#FF453A]" data-testid={`type-delete-${t.key}`}><Trash2 size={16} /></button>}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {t.kind === "work" && <Field label="Ставка %"><Num value={t.rate} onChange={(v) => onChange({ rate: v })} /></Field>}
      {t.kind === "work" && <Field label="Норма ч"><Num step="0.1" value={t.norm_hours} onChange={(v) => onChange({ norm_hours: v })} /></Field>}
      {t.kind === "work" && <Field label="Бонус %"><Num value={t.bonus_pct} onChange={(v) => onChange({ bonus_pct: v })} /></Field>}
      {t.kind === "paid" && <Field label="Оплата %"><Num value={t.pay_percent} onChange={(v) => onChange({ pay_percent: v })} /></Field>}
      <div className="sm:hidden col-span-2">
        <Select value={t.kind} onValueChange={(v) => onChange({ kind: v })}>
          <SelectTrigger className="h-11 rounded-xl bg-transparent"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  </div>
);

const HolidaysList = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data } = useHolidays(year);
  const [dlg, setDlg] = useState({ open: false, holiday: null });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">{[year - 1, year, year + 1].map((y) => <button key={y} onClick={() => setYear(y)} className={`num h-8 px-3 rounded-full text-xs font-semibold ${y === year ? "bg-[#0A84FF] text-white" : "bg-soft"}`}>{y}</button>)}</div>
        <button onClick={() => setDlg({ open: true, holiday: null })} className="text-sm font-semibold text-[#0A84FF] flex items-center gap-1" data-testid="settings-holiday-add"><Plus size={15} /> Добавить</button>
      </div>
      <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
        {(data || []).map((h) => (
          <button key={h.date} onClick={() => setDlg({ open: true, holiday: h })} className="w-full text-left flex items-center gap-3 rounded-xl bg-soft px-3 py-2 hover:bg-[#FF9500]/10" data-testid={`settings-holiday-${h.date}`}>
            <span className="num text-xs w-14 txt-2">{dateShort(h.date)}</span>
            <span className="w-2 h-2 rounded-full" style={{ background: h.day_off ? "#FF9500" : h.kind === "eve" ? "#FFCC00" : "#8E8E93" }} />
            <span className="text-sm font-medium flex-1 truncate">{h.name}</span>
            <span className="text-[11px] txt-2 hidden sm:inline">{HOLIDAY_KIND[h.kind]}{h.norm_hours ? ` · ${h.norm_hours}ч` : ""}</span>
          </button>
        ))}
      </div>
      <HolidayDialog open={dlg.open} holiday={dlg.holiday} onOpenChange={(o) => setDlg((p) => ({ ...p, open: o }))} />
    </div>
  );
};

export default function SettingsPage() {
  const { data } = useSettings();
  const refresh = useRefreshAll();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setF(data); }, [data]);
  if (!f) return <Spinner />;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setType = (key, patch) => set("day_types", f.day_types.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const addType = () => set("day_types", [...f.day_types, { key: `custom_${Date.now()}`, name: "Новая категория", color: "#64D2FF", kind: "work", rate: 100, norm_hours: null, pay_percent: 100, bonus_pct: 0, builtin: false }]);
  const toggleDay = (d) => set("work_days", f.work_days.includes(d) ? f.work_days.filter((x) => x !== d) : [...f.work_days, d].sort());

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", f);
      await refresh();
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="settings-page">
      <div className="flex items-end justify-between gap-3">
        <div><Label>Настройки</Label><h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-tight mt-1">Под вас</h1></div>
        <button onClick={save} disabled={saving} className="h-11 px-6 rounded-full bg-[#0A84FF] text-white font-semibold flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50" data-testid="settings-save-button"><Save size={16} /> Сохранить</button>
      </div>

      <Tabs defaultValue="main">
        <TabsList className="glass !rounded-full h-auto p-1 flex w-full overflow-x-auto no-scrollbar justify-start">
          {[["main", "Основное"], ["rates", "Ставки"], ["types", "Категории"], ["holidays", "Праздники"], ["tax", "Налоги"], ["phone", "Телефон"], ["look", "Вид"]].map(([k, l]) => (
            <TabsTrigger key={k} value={k} className="rounded-full px-4 h-9 data-[state=active]:bg-[#0A84FF] data-[state=active]:text-white shrink-0" data-testid={`settings-tab-${k}`}>{l}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="main" className="mt-5">
          <GlassCard className="p-6 grid sm:grid-cols-2 gap-5">
            <Field label="Ставка в час, ₪"><Num step="0.5" value={f.hourly_rate} onChange={(v) => set("hourly_rate", v)} testId="settings-hourly-rate" /></Field>
            <Field label="Норма в день, ч" hint="По закону Израиля: 42ч/нед (8.4ч при 5 днях)"><Num step="0.1" value={f.daily_norm_hours} onChange={(v) => set("daily_norm_hours", v)} testId="settings-daily-norm" /></Field>
            <Field label="Цель часов в месяц"><Num value={f.monthly_goal_hours} onChange={(v) => set("monthly_goal_hours", v)} testId="settings-goal-hours" /></Field>
            <Field label="Цель дохода в месяц, ₪"><Num value={f.monthly_goal_income} onChange={(v) => set("monthly_goal_income", v)} testId="settings-goal-income" /></Field>
            <div className="sm:col-span-2">
              <Label className="mb-2">Рабочие дни недели</Label>
              <div className="flex gap-2 flex-wrap">
                {WD_SHORT.map((w, i) => (
                  <button key={w} onClick={() => toggleDay(i)} className={`w-12 h-12 rounded-2xl font-semibold text-sm border transition-all active:scale-95 ${f.work_days.includes(i) ? "bg-[#34C759] text-white border-transparent" : "bg-soft hair txt-2"}`} data-testid={`settings-workday-${i}`}>{w}</button>
                ))}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="rates" className="mt-5">
          <GlassCard className="p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Field label="Первые сверхурочные, ч" hint="Сколько часов после нормы по первой ставке"><Num step="0.5" value={f.ot1_hours} onChange={(v) => set("ot1_hours", v)} testId="settings-ot1-hours" /></Field>
            <Field label="Ставка 1-х сверхурочных, %"><Num value={f.ot1_rate} onChange={(v) => set("ot1_rate", v)} testId="settings-ot1-rate" /></Field>
            <Field label="Ставка далее, %"><Num value={f.ot2_rate} onChange={(v) => set("ot2_rate", v)} testId="settings-ot2-rate" /></Field>
            <Field label="Сверхурочные в праздник/выходной, %"><Num value={f.special_ot_rate} onChange={(v) => set("special_ot_rate", v)} testId="settings-special-ot-rate" /></Field>
            <Field label="Перерыв по умолчанию, мин"><Num value={f.break_minutes_default} onChange={(v) => set("break_minutes_default", v)} testId="settings-break-default" /></Field>
            <Field label="Проезд за рабочий день, ₪"><Num step="0.5" value={f.travel_per_day} onChange={(v) => set("travel_per_day", v)} testId="settings-travel" /></Field>
            <div className="sm:col-span-2 lg:col-span-3"><Toggle title="Больничный по закону Израиля" desc="1-й день не оплачивается, 2–3-й — 50%, с 4-го — 100%" checked={f.sick_law_il} onChange={(v) => set("sick_law_il", v)} testId="settings-sick-law" /></div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="types" className="mt-5">
          <GlassCard className="p-4 sm:p-6 space-y-3">
            {f.day_types.map((t) => <TypeRow key={t.key} t={t} onChange={(p) => setType(t.key, p)} onDelete={() => set("day_types", f.day_types.filter((x) => x.key !== t.key))} />)}
            <button onClick={addType} className="w-full h-12 rounded-2xl border border-dashed hair text-sm font-semibold txt-2 hover:text-[#0A84FF] hover:border-[#0A84FF] flex items-center justify-center gap-2" data-testid="settings-type-add"><Plus size={16} /> Новая категория</button>
          </GlassCard>
        </TabsContent>

        <TabsContent value="holidays" className="mt-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <GlassCard className="p-6 space-y-3">
              <Toggle title="Праздники Израиля автоматически" desc="Рош ха-Шана, Йом Кипур, Суккот, Песах, Шавуот и др." checked={f.auto_holidays} onChange={(v) => set("auto_holidays", v)} testId="settings-auto-holidays" />
              <Toggle title="Показывать памятные дни" desc="Пурим, Ханука, холь ха-моэд — рабочие" checked={f.show_optional_holidays} onChange={(v) => set("show_optional_holidays", v)} testId="settings-optional-holidays" />
              <Toggle title="Оплачивать праздники автоматически" desc="Нерабочий праздник в будни = оплаченный день" checked={f.auto_paid_holidays} onChange={(v) => set("auto_paid_holidays", v)} testId="settings-auto-paid-holidays" />
            </GlassCard>
            <GlassCard className="p-6"><HolidaysList /></GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="tax" className="mt-5">
          <GlassCard className="p-6 space-y-5">
            <Toggle title="Считать налоги (Израиль)" desc="Подоходный, Битуах Леуми, мас бриют, пенсия" checked={f.tax_enabled} onChange={(v) => set("tax_enabled", v)} testId="settings-tax-enabled" />
            <div>
              <div className="flex justify-between"><Label>Нкудот зикуй (налоговые баллы)</Label><span className="num font-semibold" data-testid="settings-credit-points-value">{f.credit_points}</span></div>
              <Slider className="mt-4" min={0} max={8} step={0.25} value={[f.credit_points]} onValueChange={([v]) => set("credit_points", v)} data-testid="settings-credit-points" />
              <div className="text-xs txt-2 mt-2">Мужчина — 2.25, женщина — 2.75, репатриант и дети добавляют баллы</div>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              <Field label="Стоимость балла, ₪/мес"><Num value={f.credit_point_value} onChange={(v) => set("credit_point_value", v)} testId="settings-credit-value" /></Field>
              <Field label="Пенсия (работник), %"><Num step="0.5" value={f.pension_pct} onChange={(v) => set("pension_pct", v)} testId="settings-pension" /></Field>
              <Field label="Керен иштальмут, %"><Num step="0.5" value={f.study_fund_pct} onChange={(v) => set("study_fund_pct", v)} testId="settings-study-fund" /></Field>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="phone" className="mt-5">
          <PhoneSettings f={f} set={set} />
        </TabsContent>

        <TabsContent value="look" className="mt-5">
          <div className="grid sm:grid-cols-2 gap-5">
            {[["light", "Светлая", Sun], ["dark", "Тёмная", Moon]].map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTheme(k)} data-testid={`settings-theme-${k}`} className={`glass rounded-[20px] p-6 text-left transition-all ${theme === k ? "ring-2 ring-[#0A84FF]" : ""}`}>
                <div className={`h-28 rounded-2xl mb-4 grid place-items-center ${k === "dark" ? "bg-[#0B0C12] text-white" : "bg-[#F5F5F7] text-black"}`}><Icon size={30} /></div>
                <div className="font-semibold">{l}</div>
              </button>
            ))}
            <GlassCard className="p-6 sm:col-span-2 flex items-center justify-between">
              <div><div className="font-semibold">{user?.name}</div><div className="text-sm txt-2">{user?.email}</div></div>
              <button onClick={logout} className="h-10 px-4 rounded-full bg-[#FF453A]/10 text-[#FF453A] font-semibold text-sm flex items-center gap-2" data-testid="settings-logout-button"><LogOut size={15} /> Выйти</button>
            </GlassCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
