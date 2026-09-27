import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Pencil, CheckCircle2, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { usePayslips, usePayslipSummary, useRefreshAll } from "@/hooks/useData";
import { hrs, money2, monthTitle, MONTHS } from "@/lib/format";
import { GlassCard, Label } from "@/components/Glass";

const FIELDS = [
  ["gross", "Брутто, ₪"], ["net", "Нетто (на руки), ₪"], ["hours", "Часы"],
  ["income_tax", "Подоходный налог, ₪"], ["social", "Битуах Леуми + здоровье, ₪"], ["pension", "Пенсия, ₪"],
];

export const comparePayslip = (stats, p) => {
  const t = stats.totals;
  const tax = stats.tax;
  const calc = { hours: t.worked_hours, gross: t.gross, income_tax: tax.income_tax, social: tax.social, pension: tax.pension, net: tax.net };
  return FIELDS.filter(([k]) => p[k] !== null && p[k] !== undefined).map(([k, l]) => ({ key: k, label: l.replace(/, (₪|ч)$/, ""), calc: calc[k], actual: p[k], diff: p[k] - calc[k] }));
};

const fmt = (k, v) => (k === "hours" ? hrs(v) : money2(v));
const DEDUCTIONS = ["income_tax", "social", "pension"];
const Diff = ({ r }) => {
  const small = r.key === "hours" ? Math.abs(r.diff) < 0.1 : Math.abs(r.diff) < 1;
  if (small) return <span className="text-[#34C759]">совпадает</span>;
  const good = DEDUCTIONS.includes(r.key) ? r.diff < 0 : r.diff > 0;
  return <span className={good ? "text-[#34C759]" : "text-[#FF3B30]"}>{r.diff > 0 ? "+" : "−"}{fmt(r.key, Math.abs(r.diff))}</span>;
};

const ScanButton = ({ onResult, className = "", children, testId = "payslip-scan-button" }) => {
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const { data } = await api.post("/payslips/scan", fd);
      onResult(data);
      toast.success("Цифры распознаны — проверьте и сохраните");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className={`cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""} ${className}`} data-testid={testId}>
      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} data-testid={`${testId}-input`} />
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
      {busy ? "Распознаю…" : children}
    </label>
  );
};

const PayslipDialog = ({ open, onOpenChange, month, slip, prefill }) => {
  const refresh = useRefreshAll();
  const [f, setF] = useState({});
  const [scannedMonth, setScannedMonth] = useState(null);
  const apply = (data) => {
    setF((p) => ({ ...p, ...Object.fromEntries(FIELDS.filter(([k]) => data[k] !== null && data[k] !== undefined).map(([k]) => [k, data[k]])) }));
    setScannedMonth(data.month && data.month !== month ? data.month : null);
  };
  useEffect(() => {
    if (!open) return;
    setF(Object.fromEntries([...FIELDS.map(([k]) => [k, slip?.[k] ?? ""]), ["comment", slip?.comment || ""]]));
    setScannedMonth(null);
    if (prefill) apply(prefill);
  }, [open, slip, prefill]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === "comment" ? v : v === "" ? null : Number(v)]));
      await api.put(`/payslips/${month}`, body);
      await refresh();
      toast.success("Данные тлуша сохранены");
      onOpenChange(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const remove = async () => {
    await api.delete(`/payslips/${month}`);
    await refresh();
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass !rounded-[20px] max-w-md w-[calc(100vw-1.5rem)] p-6 border-0" data-testid="payslip-dialog">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-bold">Тлуш за {monthTitle(month).toLowerCase()}</DialogTitle>
          <DialogDescription className="txt-2">Сфотографируйте листок или перепишите суммы — обязательно только брутто</DialogDescription>
        </DialogHeader>
        <ScanButton onResult={apply} testId="payslip-dialog-scan" className="h-11 rounded-[12px] bg-soft text-[#0A84FF] text-sm font-semibold flex items-center justify-center gap-2">Сфотографировать или загрузить PDF</ScanButton>
        {scannedMonth && <div className="text-[13px] text-[#FF9500]" data-testid="payslip-month-warning">На листке указан месяц {monthTitle(scannedMonth).toLowerCase()} — проверьте, что выбран нужный месяц.</div>}
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(([k, l]) => (
            <div key={k} className={k === "gross" || k === "net" ? "" : ""}>
              <Label className="mb-2">{l}</Label>
              <input type="number" step="0.01" className="field num" value={f[k] ?? ""} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} data-testid={`payslip-${k}-input`} />
            </div>
          ))}
          <div className="col-span-2"><Label className="mb-2">Комментарий</Label><input className="field" value={f.comment || ""} onChange={(e) => setF((p) => ({ ...p, comment: e.target.value }))} data-testid="payslip-comment-input" /></div>
        </div>
        <div className="flex gap-2 pt-2">
          {slip && <button onClick={remove} className="h-11 px-4 rounded-full text-sm font-semibold text-[#FF3B30]" data-testid="payslip-delete-button">Удалить</button>}
          <div className="flex-1" />
          <button onClick={save} disabled={f.gross === "" || f.gross === undefined} className="h-11 px-6 rounded-full bg-[#0A84FF] text-white text-sm font-semibold disabled:opacity-50" data-testid="payslip-save-button">Сохранить</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const PayslipCard = ({ month, stats, className = "" }) => {
  const { data } = usePayslips(Number(month.slice(0, 4)));
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const openWith = (data) => {
    setPrefill(data);
    setOpen(true);
  };
  const slip = (data || []).find((p) => p.month === month);
  const rows = slip ? comparePayslip(stats, slip) : [];
  const main = rows.find((r) => r.key === "net") || rows.find((r) => r.key === "gross");
  const ok = main && Math.abs(main.diff) < Math.max(1, Math.abs(main.calc) * 0.01);

  return (
    <GlassCard className={`p-6 ${className}`} data-testid="payslip-card">
      <div className="flex items-center justify-between">
        <Label>Сверка с зарплатой</Label>
        {slip && <button onClick={() => openWith(null)} className="text-sm font-semibold text-[#0A84FF] flex items-center gap-1" data-testid="payslip-edit-button"><Pencil size={14} /> Изменить</button>}
      </div>
      {!slip ? (
        <div className="py-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-[14px] bg-soft grid place-items-center text-[#0A84FF] mb-3"><Receipt size={22} /></div>
          <div className="text-[17px] font-semibold">Внесите данные из тлуша</div>
          <p className="text-[13px] txt-2 mt-1 max-w-sm">Сфотографируйте тлуш — цифры заполнятся сами. Сравню фактическую зарплату с расчётом.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ScanButton onResult={openWith} className="h-11 px-5 rounded-[12px] bg-[#0A84FF] text-white text-sm font-semibold flex items-center gap-2 active:opacity-70">Сфотографировать</ScanButton>
            <button onClick={() => openWith(null)} className="h-11 px-5 rounded-[12px] bg-soft text-[#0A84FF] text-sm font-semibold active:opacity-70" data-testid="payslip-add-button">Ввести вручную</button>
          </div>
        </div>
      ) : (
        <>
          <div className={`mt-4 flex items-start gap-3 rounded-[14px] p-4 ${ok ? "bg-[#34C759]/10" : "bg-[#FF9500]/10"}`} data-testid="payslip-verdict">
            {ok ? <CheckCircle2 size={20} className="text-[#34C759] shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="text-[#FF9500] shrink-0 mt-0.5" />}
            <div className="text-[15px]">
              {ok ? `${main.label} совпадает с расчётом` : main.diff < 0 ? <>Выплачено на <b className="num">{money2(Math.abs(main.diff))}</b> меньше расчёта ({main.label.toLowerCase()}). Стоит проверить часы и ставки.</> : <>Выплачено на <b className="num">{money2(main.diff)}</b> больше расчёта ({main.label.toLowerCase()}).</>}
            </div>
          </div>
          <div className="mt-3">
            <div className="grid grid-cols-4 gap-2 py-2 text-[12px] uppercase tracking-[0.03em] txt-2 font-medium">
              <span>Показатель</span><span className="text-right">Расчёт</span><span className="text-right">Тлуш</span><span className="text-right">Разница</span>
            </div>
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-4 gap-2 py-2.5 border-t hair text-[14px]" data-testid={`payslip-row-${r.key}`}>
                <span className="font-medium">{r.label}</span>
                <span className="num text-right txt-2">{fmt(r.key, r.calc)}</span>
                <span className="num text-right">{fmt(r.key, r.actual)}</span>
                <span className="num text-right font-semibold"><Diff r={r} /></span>
              </div>
            ))}
          </div>
          {slip.comment && <div className="text-[13px] txt-2 mt-2">{slip.comment}</div>}
        </>
      )}
      <PayslipDialog open={open} onOpenChange={setOpen} month={month} slip={slip} prefill={prefill} />
    </GlassCard>
  );
};

const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money2(Math.abs(v))}`;
const diffColor = (v) => (Math.abs(v) < 1 ? "text-[#34C759]" : v > 0 ? "text-[#34C759]" : "text-[#FF3B30]");

const SumTile = ({ label, t, testId }) => (
  <div className="rounded-[14px] bg-soft p-4" data-testid={testId}>
    <div className="text-[13px] font-semibold txt-2">{label} · {t.months} мес.</div>
    <div className={`num text-[26px] font-bold mt-1 ${diffColor(t.diff)}`}>{Math.abs(t.diff) < 1 ? "совпадает" : signed(t.diff)}</div>
    <div className="num text-[13px] txt-2 mt-1">расчёт {money2(t.calc)} · тлуш {money2(t.actual)}</div>
  </div>
);

export const PayslipYearSummary = ({ year }) => {
  const { data } = usePayslipSummary(year);
  if (!data) return null;
  const { totals, months } = data;
  const main = totals.net || totals.gross;
  return (
    <GlassCard className="p-6" data-testid="payslip-year-summary">
      <Label>Итоги сверки за {year}</Label>
      {!months.length ? (
        <p className="text-[15px] txt-2 mt-3">Пока нет внесённых тлушей. Внесите их в режиме «Месяц» — здесь появится итог недоплат и переплат за год.</p>
      ) : (
        <>
          <div className={`mt-4 flex items-start gap-3 rounded-[14px] p-4 ${Math.abs(main.diff) < 1 ? "bg-[#34C759]/10" : main.diff < 0 ? "bg-[#FF3B30]/10" : "bg-[#34C759]/10"}`} data-testid="payslip-year-verdict">
            {Math.abs(main.diff) < 1 || main.diff > 0 ? <CheckCircle2 size={20} className="text-[#34C759] shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="text-[#FF3B30] shrink-0 mt-0.5" />}
            <div className="text-[15px]">
              {Math.abs(main.diff) < 1 ? <>За год выплаты совпадают с расчётом ({totals.net ? "нетто" : "брутто"}).</> : main.diff < 0
                ? <>За год вам <b>недоплатили</b> примерно <b className="num">{money2(Math.abs(main.diff))}</b> ({totals.net ? "нетто" : "брутто"}). Стоит поговорить с бухгалтерией.</>
                : <>За год выплачено на <b className="num">{money2(main.diff)}</b> больше расчёта ({totals.net ? "нетто" : "брутто"}).</>}
              <div className="text-[13px] txt-2 mt-1">Недоплата — {data.under} мес., переплата — {data.over} мес., совпало — {data.match} мес.</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {totals.gross && <SumTile label="Брутто" t={totals.gross} testId="payslip-year-gross" />}
            {totals.net && <SumTile label="Нетто" t={totals.net} testId="payslip-year-net" />}
          </div>
          <div className="mt-3">
            {months.map((m) => (
              <div key={m.month} className="flex items-center gap-3 py-2.5 border-t hair text-[14px]" data-testid={`payslip-year-row-${m.month}`}>
                <span className="flex-1 font-medium">{MONTHS[Number(m.month.slice(5)) - 1]}</span>
                {m.gross && <span className="num text-right w-32"><span className="txt-2 text-[12px]">брутто </span><span className={diffColor(m.gross.diff)}>{Math.abs(m.gross.diff) < 1 ? "✓" : signed(m.gross.diff)}</span></span>}
                <span className="num text-right w-32">{m.net ? <><span className="txt-2 text-[12px]">нетто </span><span className={diffColor(m.net.diff)}>{Math.abs(m.net.diff) < 1 ? "✓" : signed(m.net.diff)}</span></> : <span className="txt-2">—</span>}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
};
