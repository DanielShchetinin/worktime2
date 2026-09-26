import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Sparkles, Trash2, Wrench, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, streamChat } from "@/lib/api";
import { useChatHistory, useRefreshAll } from "@/hooks/useData";
import { todayISO } from "@/lib/format";
import { GlassCard, Label } from "@/components/Glass";

const TOOL_LABELS = {
  get_settings: "Смотрю настройки", update_settings: "Обновил настройки", upsert_day_type: "Настроил категорию",
  delete_day_type: "Удалил категорию", list_holidays: "Смотрю праздники", set_holiday: "Настроил праздник",
  remove_holiday: "Убрал праздник", get_entries: "Смотрю записи", upsert_entry: "Записал день",
  bulk_set_days: "Отметил период", delete_entry: "Удалил запись", get_month_stats: "Считаю статистику",
};

const SUGGESTIONS = [
  "В канун праздников работаем до 13:00, а в сами праздники не работаем",
  "Моя ставка 62 ₪ в час, норма 8.5 часов, первые 2 часа сверхурочных 125%, дальше 150%",
  "Отметь отпуск с 14 по 20 июля",
  "Сегодня работал с 8 до 17, потом ещё 2 часа по 150%",
  "Сколько я заработал в этом месяце на руки?",
  "Добавь категорию «Ранний уход» — засчитывается +30%",
];

const ToolChips = ({ tools }) =>
  tools?.length ? (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {[...new Set(tools)].map((t) => (
        <span key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158]"><Check size={11} /> {TOOL_LABELS[t] || t}</span>
      ))}
    </div>
  ) : null;

const Bubble = ({ m, i }) =>
  m.role === "user" ? (
    <div className="flex justify-end fade-up" data-testid={`chat-message-user-${i}`}>
      <div className="max-w-[85%] rounded-[20px] rounded-br-md px-4 py-2.5 bg-[#0A84FF] text-white text-[15px] whitespace-pre-wrap">{m.content}</div>
    </div>
  ) : (
    <div className="flex gap-3 fade-up" data-testid={`chat-message-assistant-${i}`}>
      <div className="w-8 h-8 rounded-full shrink-0 grid place-items-center bg-[#0A84FF] text-white"><Sparkles size={15} /></div>
      <div className="max-w-[85%] min-w-0">
        <ToolChips tools={m.tools} />
        {m.live && !m.content && <div className="flex gap-1 py-3">{[0, 1, 2].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
        {m.content && <div className="rounded-[20px] rounded-tl-md px-4 py-2.5 text-[15px] md bg-[#E9E9EB] dark:bg-[#26262A]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>}
      </div>
    </div>
  );

export default function ChatPage() {
  const { data: hist } = useChatHistory();
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const endRef = useRef(null);
  const sentQ = useRef(false);

  useEffect(() => { if (hist) setMsgs(hist); }, [hist]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (raw) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    setText("");
    setBusy(true);
    setMsgs((p) => [...p, { role: "user", content }, { role: "assistant", content: "", tools: [], live: true }]);
    const patch = (fn) => setMsgs((p) => { const c = [...p]; c[c.length - 1] = fn(c[c.length - 1]); return c; });
    try {
      await streamChat(content, todayISO(), (ev) => {
        if (ev.type === "delta") patch((m) => ({ ...m, content: m.content + ev.content }));
        else if (ev.type === "tool") patch((m) => ({ ...m, tools: [...m.tools, ev.name] }));
        else if (ev.type === "error") toast.error(ev.content);
        else if (ev.type === "done" && ev.changed) { refresh(); toast.success("Настройки применены"); }
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      patch((m) => ({ ...m, live: false }));
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["chat"] });
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q && !sentQ.current && hist) {
      sentQ.current = true;
      setParams({}, { replace: true });
      send(q);
    }
  }, [params, hist]); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = async () => {
    await api.delete("/chat/history");
    setMsgs([]);
    qc.invalidateQueries({ queryKey: ["chat"] });
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-190px)] md:h-[calc(100vh-64px)]" data-testid="chat-page">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <Label>ИИ-ассистент · Claude</Label>
          <h1 className="font-display text-[30px] sm:text-[40px] font-bold tracking-tight mt-1">Объясните словами</h1>
        </div>
        {msgs.length > 0 && <button onClick={clear} className="h-10 px-4 rounded-full bg-soft border hair text-sm font-semibold txt-2 hover:text-[#FF453A] flex items-center gap-2" data-testid="chat-clear-button"><Trash2 size={15} /> <span className="hidden sm:inline">Очистить</span></button>}
      </div>

      <GlassCard className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" data-testid="chat-messages">
          {msgs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-2">
              <div className="w-14 h-14 rounded-[16px] grid place-items-center bg-[#0A84FF] text-white mb-5"><Wrench size={28} /></div>
              <div className="font-display text-2xl font-semibold">Настрою всё за вас</div>
              <p className="txt-2 text-sm mt-2 max-w-md">Расскажите, как у вас на работе: праздники, короткие дни, ставки 125/150/200%, отпуска, бонусы. Я сам внесу настройки и записи.</p>
              <div className="grid sm:grid-cols-2 gap-2 mt-6 w-full max-w-2xl">
                {SUGGESTIONS.map((s, i) => (
                  <button key={s} onClick={() => send(s)} className="text-left text-sm rounded-2xl bg-soft border hair px-4 py-3 hover:border-[#0A84FF] hover:-translate-y-0.5 transition-all" data-testid={`chat-suggestion-${i}`}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => <Bubble key={i} m={m} i={i} />)}
          <div ref={endRef} />
        </div>
        <div className="p-3 sm:p-4 border-t hair">
          <div className="flex items-end gap-2 rounded-[24px] bg-soft border hair p-1.5 pl-4 focus-within:border-[#0A84FF] transition-colors">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Например: 25 декабря работаем полдня…"
              className="flex-1 bg-transparent outline-none resize-none py-2.5 text-[15px] max-h-32"
              data-testid="chat-input"
            />
            <button onClick={() => send()} disabled={busy || !text.trim()} className="w-10 h-10 shrink-0 rounded-full bg-[#0A84FF] text-white grid place-items-center disabled:opacity-40 active:scale-90 transition-transform" data-testid="chat-send-button"><ArrowUp size={18} strokeWidth={2.6} /></button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
