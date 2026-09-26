import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Share, SquarePlus, CheckCircle2, Bell, BellOff, Send, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiError } from "@/lib/api";
import { isIOS, isStandalone, pushSupported, getSubscription, subscribePush, unsubscribePush, getInstallPrompt, onInstallPromptChange } from "@/lib/pwa";
import { GlassCard, Label } from "@/components/Glass";

const TZ = ["Asia/Jerusalem", "Europe/Moscow", "Europe/Kyiv", "Europe/Berlin", "Europe/London", "America/New_York"];

const Step = ({ n, children }) => (
  <li className="flex items-center gap-3 text-[15px]">
    <span className="w-6 h-6 rounded-full bg-[#0A84FF] text-white text-xs font-bold grid place-items-center shrink-0">{n}</span>
    <span className="flex items-center gap-1.5 flex-wrap">{children}</span>
  </li>
);

const InstallCard = () => {
  const [prompt, setPrompt] = useState(getInstallPrompt());
  useEffect(() => onInstallPromptChange(setPrompt), []);
  const install = async () => {
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };
  return (
    <GlassCard className="p-6 space-y-4" data-testid="install-card">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-[12px]" />
        <div>
          <div className="text-[17px] font-semibold">Установить на телефон</div>
          <div className="text-[13px] txt-2">Своя иконка, без адресной строки — как обычное приложение</div>
        </div>
      </div>
      {isStandalone() ? (
        <div className="flex items-center gap-2 text-[15px] font-medium text-[#34C759]" data-testid="install-done"><CheckCircle2 size={18} /> Приложение установлено</div>
      ) : isIOS() ? (
        <ol className="space-y-3" data-testid="install-ios-steps">
          <Step n={1}>Откройте сайт в Safari</Step>
          <Step n={2}>Нажмите «Поделиться» <Share size={16} className="text-[#0A84FF]" /></Step>
          <Step n={3}>Выберите «На экран Домой» <SquarePlus size={16} className="text-[#0A84FF]" /></Step>
          <Step n={4}>Нажмите «Добавить»</Step>
        </ol>
      ) : prompt ? (
        <button onClick={install} className="h-11 px-5 rounded-[12px] bg-[#0A84FF] text-white font-semibold flex items-center gap-2 active:opacity-70" data-testid="install-button"><Download size={17} /> Установить приложение</button>
      ) : (
        <ol className="space-y-3" data-testid="install-generic-steps">
          <Step n={1}>На iPhone — откройте сайт в Safari → «Поделиться» → «На экран Домой»</Step>
          <Step n={2}>На Android и компьютере — меню браузера → «Установить приложение»</Step>
        </ol>
      )}
    </GlassCard>
  );
};

const RemindersCard = ({ f, set }) => {
  const [sub, setSub] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getSubscription().then(setSub).catch(() => {}); }, []);

  const enable = async () => {
    setBusy(true);
    try {
      setSub(await subscribePush());
      set("reminders_enabled", true);
      await api.put("/settings", { reminders_enabled: true, timezone: f.timezone, reminder_start_time: f.reminder_start_time, reminder_end_time: f.reminder_end_time });
      toast.success("Уведомления включены на этом устройстве");
    } catch (e) {
      toast.error(e?.response ? apiError(e) : e.message);
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    await unsubscribePush();
    setSub(null);
    toast.success("Уведомления на этом устройстве выключены");
  };
  const test = async () => {
    try {
      const { data } = await api.post("/push/test");
      toast.success(data.sent ? "Тестовое уведомление отправлено" : "Нет устройств с уведомлениями");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <GlassCard className="p-6 space-y-4" data-testid="reminders-card">
      <div>
        <div className="text-[17px] font-semibold">Напоминания о смене</div>
        <div className="text-[13px] txt-2">Напомню начать рабочий день и завершить забытую смену</div>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-[12px] bg-soft px-4 py-3">
        <div className="text-[15px] font-medium">Напоминания включены</div>
        <Switch checked={!!f.reminders_enabled} onCheckedChange={(v) => set("reminders_enabled", v)} data-testid="settings-reminders-enabled" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="mb-2">Начало смены</Label><input type="time" className="field" value={f.reminder_start_time} onChange={(e) => set("reminder_start_time", e.target.value)} data-testid="settings-reminder-start" /></div>
        <div><Label className="mb-2">Конец смены</Label><input type="time" className="field" value={f.reminder_end_time} onChange={(e) => set("reminder_end_time", e.target.value)} data-testid="settings-reminder-end" /></div>
      </div>
      <div>
        <Label className="mb-2">Часовой пояс</Label>
        <Select value={f.timezone} onValueChange={(v) => set("timezone", v)}>
          <SelectTrigger className="h-11 rounded-xl bg-soft border-0" data-testid="settings-timezone"><SelectValue /></SelectTrigger>
          <SelectContent>{TZ.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="rounded-[12px] border hair p-4 space-y-3">
        <div className="flex items-center gap-2 text-[15px] font-medium">
          {sub ? <Bell size={17} className="text-[#34C759]" /> : <BellOff size={17} className="txt-2" />}
          {sub ? "Уведомления на этом устройстве включены" : "Уведомления на этом устройстве выключены"}
        </div>
        <div className="flex flex-wrap gap-2">
          {sub ? (
            <>
              <button onClick={test} className="h-10 px-4 rounded-[10px] bg-[#0A84FF] text-white text-sm font-semibold flex items-center gap-1.5 active:opacity-70" data-testid="push-test-button"><Send size={15} /> Проверить</button>
              <button onClick={disable} className="h-10 px-4 rounded-[10px] bg-soft text-sm font-semibold active:opacity-70" data-testid="push-disable-button">Выключить</button>
            </>
          ) : (
            <button onClick={enable} disabled={busy} className="h-10 px-4 rounded-[10px] bg-[#0A84FF] text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 active:opacity-70" data-testid="push-enable-button"><Bell size={15} /> Включить уведомления</button>
          )}
        </div>
        {isIOS() && !isStandalone() && <div className="text-[13px] text-[#FF9500]">На iPhone уведомления работают только в установленном приложении (iOS 16.4+). Сначала добавьте «Смену» на экран «Домой».</div>}
        {!pushSupported() && !isIOS() && <div className="text-[13px] text-[#FF9500]">Этот браузер не поддерживает уведомления.</div>}
      </div>
      <div className="text-[12px] txt-2">Напоминание приходит в течение 15 минут после указанного времени. Время и пояс сохраняются кнопкой «Сохранить».</div>
    </GlassCard>
  );
};

export const PhoneSettings = ({ f, set }) => (
  <div className="grid lg:grid-cols-2 gap-5">
    <InstallCard />
    <RemindersCard f={f} set={set} />
  </div>
);
