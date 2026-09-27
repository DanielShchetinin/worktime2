import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Pencil, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { usePayslips, useRefreshAll } from "@/hooks/useData";
import { hrs, money2, monthTitle } from "@/lib/format";
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

const PayslipDialog = ({ open, onOpenChange, month, slip }) => {
  const refresh = useRefreshAll();
  const [f, setF] = useState({});
  useEffect(() => {
    if (open) setF(Object.fromEntries([...FIELDS.map(([k]) => [k, slip?.[k] ?? ""]), ["comment", slip?.comment || ""]]));
  }, [open, slip]);
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
          <DialogDescription className="txt-2">Перепишите суммы из зарплатного листка — обязательно только брутто</DialogDescription>
        </DialogHeader>
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
  const slip = (data || []).find((p) => p.month === month);
  const rows = slip ? comparePayslip(stats, slip) : [];
  const main = rows.find((r) => r.key === "net") || rows.find((r) => r.key === "gross");
  const ok = main && Math.abs(main.diff) < Math.max(1, Math.abs(main.calc) * 0.01);

  return (
    <GlassCard className={`p-6 ${className}`} data-testid="payslip-card">
      <div className="flex items-center justify-between">
        <Label>Сверка с зарплатой</Label>
        {slip && <button onClick={() => setOpen(true)} className="text-sm font-semibold text-[#0A84FF] flex items-center gap-1" data-testid="payslip-edit-button"><Pencil size={14} /> Изменить</button>}
      </div>
      {!slip ? (
        <div className="py-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-[14px] bg-soft grid place-items-center text-[#0A84FF] mb-3"><Receipt size={22} /></div>
          <div className="text-[17px] font-semibold">Внесите данные из тлуша</div>
          <p className="text-[13px] txt-2 mt-1 max-w-sm">Сравню фактическую зарплату с расчётом приложения и покажу, где разница.</p>
          <button onClick={() => setOpen(true)} className="mt-4 h-11 px-5 rounded-[12px] bg-[#0A84FF] text-white text-sm font-semibold active:opacity-70" data-testid="payslip-add-button">Внести тлуш</button>
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
      <PayslipDialog open={open} onOpenChange={setOpen} month={month} slip={slip} />
    </GlassCard>
  );
};
