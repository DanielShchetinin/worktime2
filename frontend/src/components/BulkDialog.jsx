import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { api, apiError } from "@/lib/api";
import { useSettings, useRefreshAll } from "@/hooks/useData";
import { todayISO } from "@/lib/format";
import { Label } from "@/components/Glass";

export const BulkDialog = ({ open, onOpenChange }) => {
  const { data: settings } = useSettings();
  const refresh = useRefreshAll();
  const [f, setF] = useState({ start: todayISO(), end: todayISO(), day_type: "vacation", only_workdays: true, comment: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    try {
      const { data } = await api.post("/entries/bulk", f);
      await refresh();
      toast.success(`Отмечено дней: ${data.count}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong !rounded-[28px] max-w-md w-[calc(100vw-1.5rem)] p-6 border-0" data-testid="bulk-dialog">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl">Отметить период</DialogTitle>
          <DialogDescription className="txt-2">Отпуск, больничный, неоплачиваемые дни — сразу на диапазон</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-2">С</Label><input type="date" className="field num" value={f.start} onChange={(e) => set("start", e.target.value)} data-testid="bulk-start-input" /></div>
            <div><Label className="mb-2">По</Label><input type="date" className="field num" value={f.end} onChange={(e) => set("end", e.target.value)} data-testid="bulk-end-input" /></div>
          </div>
          <div>
            <Label className="mb-2">Категория</Label>
            <div className="flex flex-wrap gap-1.5">
              {(settings?.day_types || []).map((t) => (
                <button key={t.key} onClick={() => set("day_type", t.key)} data-testid={`bulk-type-${t.key}`} className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
                  style={{ color: f.day_type === t.key ? "#fff" : t.color, background: f.day_type === t.key ? t.color : `${t.color}18`, borderColor: `${t.color}50` }}>{t.name}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-soft border hair px-4 py-3">
            <div className="text-sm font-semibold">Только рабочие дни</div>
            <Switch checked={f.only_workdays} onCheckedChange={(v) => set("only_workdays", v)} data-testid="bulk-workdays-switch" />
          </div>
          <input className="field" placeholder="Комментарий" value={f.comment} onChange={(e) => set("comment", e.target.value)} data-testid="bulk-comment-input" />
          <button onClick={save} className="w-full h-12 rounded-full bg-[#0A84FF] text-white font-semibold active:scale-[0.98] transition-transform" data-testid="bulk-save-button">Применить</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
