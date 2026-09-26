import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, apiError } from "@/lib/api";
import { useSettings, useRefreshAll } from "@/hooks/useData";
import { HOLIDAY_KIND } from "@/lib/format";
import { Label } from "@/components/Glass";

export const HolidayDialog = ({ open, onOpenChange, holiday, date: initialDate }) => {
  const { data: settings } = useSettings();
  const refresh = useRefreshAll();
  const [f, setF] = useState(null);

  useEffect(() => {
    if (open) setF({ date: holiday?.date || initialDate || "", name: holiday?.name || "", kind: holiday?.kind || "custom", day_off: holiday?.day_off ?? false, day_type: holiday?.day_type || "none", norm_hours: holiday?.norm_hours ?? "" });
  }, [open, holiday, initialDate]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    try {
      await api.put(`/holidays/${f.date}`, { name: f.name, kind: f.kind, day_off: f.day_off, day_type: f.day_type === "none" ? null : f.day_type, norm_hours: f.norm_hours === "" ? null : Number(f.norm_hours) });
      await refresh();
      toast.success("Праздник сохранён");
      onOpenChange(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const remove = async () => {
    await api.delete(`/holidays/${f.date}`);
    await refresh();
    toast.success("Праздник убран");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong !rounded-[28px] max-w-md w-[calc(100vw-1.5rem)] p-6 border-0" data-testid="holiday-dialog">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl">{holiday ? "Праздник" : "Новый особый день"}</DialogTitle>
          <DialogDescription className="txt-2">Выходной, короткий день или особая ставка</DialogDescription>
        </DialogHeader>
        {f && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-2">Дата</Label><input type="date" className="field num" value={f.date} disabled={!!holiday} onChange={(e) => set("date", e.target.value)} data-testid="holiday-date-input" /></div>
              <div>
                <Label className="mb-2">Тип</Label>
                <Select value={f.kind} onValueChange={(v) => set("kind", v)}>
                  <SelectTrigger className="h-11 rounded-xl bg-soft" data-testid="holiday-kind-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(HOLIDAY_KIND).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="mb-2">Название</Label><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Например: Корпоратив" data-testid="holiday-name-input" /></div>
            <div className="flex items-center justify-between rounded-2xl bg-soft border hair px-4 py-3">
              <div><div className="text-sm font-semibold">Нерабочий день</div><div className="text-xs txt-2">Не входит в норму месяца</div></div>
              <Switch checked={f.day_off} onCheckedChange={(v) => set("day_off", v)} data-testid="holiday-dayoff-switch" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2">Если работаю</Label>
                <Select value={f.day_type} onValueChange={(v) => set("day_type", v)}>
                  <SelectTrigger className="h-11 rounded-xl bg-soft" data-testid="holiday-daytype-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Обычный день</SelectItem>
                    {(settings?.day_types || []).filter((t) => t.kind === "work").map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="mb-2">Норма, ч</Label><input type="number" step="0.5" className="field num" value={f.norm_hours} onChange={(e) => set("norm_hours", e.target.value)} placeholder="напр. 4" data-testid="holiday-norm-input" /></div>
            </div>
            <div className="flex gap-2 pt-2">
              {holiday && <button onClick={remove} className="h-11 px-4 rounded-full text-sm font-semibold text-[#FF453A] hover:bg-[#FF453A]/10" data-testid="holiday-delete-button">Убрать</button>}
              <div className="flex-1" />
              <button onClick={save} disabled={!f.date || !f.name} className="h-11 px-6 rounded-full text-sm font-semibold bg-[#0A84FF] text-white disabled:opacity-50" data-testid="holiday-save-button">Сохранить</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
