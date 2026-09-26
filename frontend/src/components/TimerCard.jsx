import { useEffect, useState } from "react";
import { Play, Pause, Square, PencilLine, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useTimer, useSettings, useRefreshAll, typeMap } from "@/hooks/useData";
import { todayISO, nowHM, hms, hrs, money2, dateLong } from "@/lib/format";
import { GlassCard, Label, RateBadge, TypePill } from "@/components/Glass";
import { ActivityRings, RING_COLORS } from "@/components/ActivityRings";
import { EntryDialog } from "@/components/EntryDialog";

const Btn = ({ children, className = "", ...p }) => (
  <button
    className={`h-12 px-5 rounded-[14px] font-semibold text-[16px] flex items-center justify-center gap-2 active:opacity-70 transition-opacity disabled:opacity-50 ${className}`}
    {...p}
  >
    {children}
  </button>
);

export const TimerCard = () => {
  const today = todayISO();
  const { data, dataUpdatedAt } = useTimer(today);
  const { data: settings } = useSettings();
  const refresh = useRefreshAll();
  const [tick, setTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const info = data?.today;
  const calc = info?.calc;
  const active = data?.active;
  const running = !!active && active.date === today;
  const since = running ? Math.max(0, (tick - dataUpdatedAt) / 1000) : 0;
  const workedSec = (calc?.worked_hours || 0) * 3600 + since;
  const rate = calc?.current_rate || 100;
  const livePay = (calc?.gross || 0) + (since / 3600) * (calc?.hourly_rate || 0) * (rate / 100) * (1 + (calc?.bonus_pct || 0) / 100);
  const norm = info?.expected_hours || calc?.norm_hours || settings?.daily_norm_hours || 8;
  const expectedPay = norm * (settings?.hourly_rate || 0);
  const types = typeMap(settings);
  const dayType = types[info?.entry?.day_type || info?.suggested_type];
  const segs = info?.entry?.segments || [];
  const status = running ? "running" : segs.length ? "paused" : "idle";

  const act = async (url, body, msg) => {
    setBusy(true);
    try {
      await api.post(url, body);
      await refresh();
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () => act("/timer/start", { date: today, time: nowHM() }, status === "idle" ? "Рабочий день начат" : "Смена продолжена");
  const pause = () => act("/timer/stop", { time: nowHM() }, "Пауза");
  const finish = () => act("/timer/stop", { time: nowHM() }, `День завершён · ${hrs(workedSec / 3600)} · ${money2(livePay)}`);

  return (
    <GlassCard className="p-5 sm:p-8 h-full overflow-hidden" data-testid="timer-card">
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        <div>
          <ActivityRings
            size={220}
            stroke={16}
            gap={5}
            testId="timer-ring"
            rings={[
              { value: workedSec / 3600, max: norm || 1, colors: RING_COLORS.green },
              { value: livePay, max: expectedPay || 1, colors: RING_COLORS.blue },
            ]}
          >
            <div>
              <div className="num text-[34px] font-bold leading-none" data-testid="timer-display">{hms(workedSec)}</div>
              <div className="text-xs txt-2 mt-2">норма {hrs(norm)}</div>
            </div>
          </ActivityRings>
        </div>

        <div className="flex-1 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="timer-status"
              className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                running ? "bg-[#30D158]/15 text-[#30D158]" : status === "paused" ? "bg-[#FF9F0A]/15 text-[#FF9F0A]" : "bg-soft txt-2"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${running ? "bg-[#30D158] blink" : status === "paused" ? "bg-[#FF9F0A]" : "bg-current"}`} />
              {running ? "Идёт смена" : status === "paused" ? "На паузе" : "Не начат"}
            </span>
            <TypePill type={dayType} />
            {info?.holiday && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FF9500]/15 text-[#FF9500]" data-testid="timer-holiday-badge">
                <PartyPopper size={12} /> {info.holiday.name}
              </span>
            )}
          </div>
          <div className="text-[22px] sm:text-[28px] font-bold mt-4 tracking-tight capitalize">{dateLong(today)}</div>

          <div className="mt-5 flex items-end gap-4 flex-wrap">
            <div>
              <Label>Заработано сегодня</Label>
              <div className="num text-4xl sm:text-5xl font-bold mt-1.5" data-testid="timer-live-pay">
                {money2(livePay)}
              </div>
            </div>
            <div className="pb-2 flex items-center gap-2">
              <span className="text-xs txt-2">ставка сейчас</span>
              <RateBadge rate={rate} />
            </div>
          </div>

          {segs.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5" data-testid="timer-segments">
              {segs.map((s, i) => (
                <span key={i} className="num text-xs px-2.5 py-1 rounded-md bg-soft">
                  {s.start} – {s.end || "…"}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {!running ? (
              <Btn
                onClick={start}
                disabled={busy || (active && !running)}
                data-testid="start-work-button"
                className="flex-1 sm:flex-none bg-[#34C759] text-white hover:brightness-110"
              >
                <Play size={18} fill="currentColor" /> {status === "idle" ? <><span className="sm:hidden">Начать день</span><span className="hidden sm:inline">Начать рабочий день</span></> : "Продолжить"}
              </Btn>
            ) : (
              <>
                <Btn onClick={pause} disabled={busy} data-testid="pause-work-button" className="flex-1 sm:flex-none bg-soft">
                  <Pause size={18} fill="currentColor" /> Пауза
                </Btn>
                <Btn onClick={finish} disabled={busy} data-testid="finish-work-button" className="flex-1 sm:flex-none bg-[#FF375F] text-white hover:brightness-110">
                  <Square size={16} fill="currentColor" /> Завершить день
                </Btn>
              </>
            )}
            <Btn onClick={() => setEdit(true)} data-testid="manual-entry-button" className="bg-soft text-[#0A84FF] !px-5">
              <PencilLine size={17} /> Вручную
            </Btn>
          </div>
          {active && !running && (
            <div className="text-xs text-[#FF9F0A] mt-3">Незавершённая смена от {active.date}. Откройте её в календаре.</div>
          )}
        </div>
      </div>
      <EntryDialog date={today} open={edit} onOpenChange={setEdit} />
    </GlassCard>
  );
};
