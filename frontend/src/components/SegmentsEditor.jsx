import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RATE_OPTIONS, rateColor } from "@/lib/format";

export const SegmentsEditor = ({ segments, onChange }) => {
  const update = (i, patch) => onChange(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remove = (i) => onChange(segments.filter((_, j) => j !== i));
  const add = () => {
    const last = segments[segments.length - 1];
    const start = last?.end || "09:00";
    const [h, m] = start.split(":").map(Number);
    onChange([...segments, { start, end: `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`, rate: null }]);
  };

  return (
    <div className="space-y-2" data-testid="segments-editor">
      {segments.map((s, i) => (
        <div key={i} className="flex items-center gap-2 rounded-2xl bg-soft border hair p-2" data-testid={`segment-row-${i}`}>
          <input type="time" value={s.start} onChange={(e) => update(i, { start: e.target.value })} className="field !h-10 num !w-[108px] !px-2" data-testid={`segment-start-${i}`} />
          <span className="txt-2">–</span>
          {s.end === null || s.end === undefined ? (
            <span className="text-xs font-semibold text-[#30D158] px-2 w-[108px]">идёт сейчас…</span>
          ) : (
            <input type="time" value={s.end} onChange={(e) => update(i, { end: e.target.value })} className="field !h-10 num !w-[108px] !px-2" data-testid={`segment-end-${i}`} />
          )}
          <Select value={s.rate ? String(s.rate) : "auto"} onValueChange={(v) => update(i, { rate: v === "auto" ? null : Number(v) })}>
            <SelectTrigger className="h-10 rounded-xl flex-1 min-w-[88px] bg-transparent" data-testid={`segment-rate-${i}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Авто</SelectItem>
              {RATE_OPTIONS.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  <span className="num font-semibold" style={{ color: rateColor(r) }}>{r}%</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={() => remove(i)} className="w-9 h-9 shrink-0 rounded-full grid place-items-center txt-2 hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors" data-testid={`segment-remove-${i}`}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button onClick={add} data-testid="segment-add-button" className="w-full h-11 rounded-2xl border border-dashed hair text-sm font-semibold txt-2 hover:text-[#0A84FF] hover:border-[#0A84FF] flex items-center justify-center gap-2 transition-colors">
        <Plus size={16} /> Добавить отрезок
      </button>
    </div>
  );
};
