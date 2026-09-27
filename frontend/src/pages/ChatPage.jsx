import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Sparkles, SquarePen, Wrench, Check, Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { streamChat, transcribe, apiError } from "@/lib/api";
import { useRefreshAll } from "@/hooks/useData";
import { todayISO } from "@/lib/format";
import { GlassCard, Label } from "@/components/Glass";
import { ProposalCard } from "@/components/ProposalCard";

const SESSION_KEY = "smena_chat_session";

const VoiceButton = ({ onText, disabled }) => {
  const [state, setState] = useState("idle");
  const [sec, setSec] = useState(0);
  const rec = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);

  useEffect(() => () => {
    clearInterval(timer.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timer.current);
        const mime = mr.mimeType || type || "audio/webm";
        const blob = new Blob(chunks.current, { type: mime });
        if (blob.size < 1000) return setState("idle");
        setState("busy");
        try {
          const text = await transcribe(blob, `voice.${mime.includes("mp4") ? "mp4" : "webm"}`);
          if (text) onText(text);
          else toast.error("Не удалось разобрать речь");
        } catch (e) {
          toast.error(apiError(e));
        }
        setState("idle");
      };
      mr.start();
      rec.current = mr;
      setSec(0);
      setState("rec");
      timer.current = setInterval(() => setSec((s) => s + 1), 1000);
    } catch {
      toast.error("Нет доступа к микрофону");
    }
  };

  const stop = () => rec.current?.state === "recording" && rec.current.stop();

  if (state === "rec")
    return (
      <button onClick={stop} className="h-10 pl-3 pr-4 shrink-0 rounded-full bg-[#FF3B30] text-white flex items-center gap-2 text-sm font-semibold active:opacity-70" data-testid="chat-voice-stop">
        <span className="w-2 h-2 rounded-full bg-white blink" />
        <span className="num">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</span>
        <Square size={13} fill="currentColor" />
      </button>
    );
  return (
    <button onClick={start} disabled={disabled || state === "busy"} className="w-10 h-10 shrink-0 rounded-full bg-soft text-[#0A84FF] grid place-items-center disabled:opacity-40 active:opacity-70" data-testid="chat-voice-button" aria-label="Голосовой ввод">
      {state === "busy" ? <Loader2 size={18} className="animate-spin" /> : <Mic size={19} />}
    </button>
  );
};

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

const MD = {
  ul: ({ children }) => <ul className="!list-none !pl-0 space-y-1.5 my-2">{children}</ul>,
  ol: ({ children }) => <ul className="!list-none !pl-0 space-y-1.5 my-2">{children}</ul>,
  li: ({ children }) => <li className="flex gap-2.5"><span className="mt-[8px] w-1.5 h-1.5 rounded-full bg-[#0A84FF] shrink-0" /><span className="min-w-0">{children}</span></li>,
  code: ({ children }) => <span className="font-semibold">{children}</span>,
  pre: ({ children }) => <>{children}</>,
  h1: ({ children }) => <p className="font-semibold">{children}</p>,
  h2: ({ children }) => <p className="font-semibold">{children}</p>,
  h3: ({ children }) => <p className="font-semibold">{children}</p>,
};

const Typing = () => (
  <div className="inline-flex gap-1.5 rounded-[20px] rounded-tl-md px-4 py-3.5 bg-[#E9E9EB] dark:bg-[#26262A]" data-testid="chat-typing">
    {[0, 1, 2].map((d) => (
      <motion.span key={d} className="w-2 h-2 rounded-full bg-current opacity-60" animate={{ y: [0, -5, 0], opacity: [0.35, 0.9, 0.35] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
    ))}
  </div>
);

const pop = { initial: { opacity: 0, y: 12, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: "spring", stiffness: 380, damping: 28 } };

const Bubble = ({ m, i, onResolve }) =>
  m.role === "user" ? (
    <motion.div {...pop} className="flex justify-end" style={{ transformOrigin: "bottom right" }} data-testid={`chat-message-user-${i}`}>
      <div className="max-w-[85%] rounded-[20px] rounded-br-md px-4 py-2.5 bg-[#0A84FF] text-white text-[15px] whitespace-pre-wrap">{m.content}</div>
    </motion.div>
  ) : (
    <motion.div {...pop} className="flex gap-3" style={{ transformOrigin: "bottom left" }} data-testid={`chat-message-assistant-${i}`}>
      <motion.div className="w-8 h-8 rounded-full shrink-0 grid place-items-center bg-[#0A84FF] text-white" animate={m.live ? { rotate: [0, 12, -12, 0] } : { rotate: 0 }} transition={{ duration: 1.6, repeat: m.live ? Infinity : 0 }}><Sparkles size={15} /></motion.div>
      <div className="max-w-[88%] min-w-0 flex-1">
        <ToolChips tools={m.tools} />
        {m.live && !m.content && <Typing />}
        {m.content && <div className="inline-block rounded-[20px] rounded-tl-md px-4 py-2.5 text-[15px] leading-relaxed md bg-[#E9E9EB] dark:bg-[#26262A]"><ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{m.content}</ReactMarkdown></div>}
        {m.proposal && <ProposalCard proposal={m.proposal} onResolve={(status, actions) => onResolve(i, status, actions)} />}
      </div>
    </motion.div>
  );

export default function ChatPage() {
  const refresh = useRefreshAll();
  const [msgs, setMsgs] = useState(() => JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]"));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const endRef = useRef(null);
  const sentQ = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs.filter((m) => !m.live)));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const send = async (raw) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    const note = { applied: "\n\n[Пользователь проверил и применил предложенные изменения]", cancelled: "\n\n[Пользователь отменил предложенные изменения]" };
    const history = msgs.filter((m) => m.content || m.proposal).map((m) => ({ role: m.role, content: (m.content || "Предложил изменения.") + (m.proposal?.status ? note[m.proposal.status] : "") }));
    setText("");
    setBusy(true);
    setMsgs((p) => [...p, { role: "user", content }, { role: "assistant", content: "", tools: [], live: true }]);
    const patch = (fn) => setMsgs((p) => { const c = [...p]; c[c.length - 1] = fn(c[c.length - 1]); return c; });
    try {
      await streamChat(content, todayISO(), history, (ev) => {
        if (ev.type === "delta") patch((m) => ({ ...m, content: m.content + ev.content }));
        else if (ev.type === "tool") patch((m) => ({ ...m, tools: [...m.tools, ev.name] }));
        else if (ev.type === "error") toast.error(ev.content);
        else if (ev.type === "proposal") patch((m) => ({ ...m, proposal: { actions: ev.actions, status: null } }));
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      patch((m) => ({ ...m, live: false }));
      setBusy(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q && !sentQ.current) {
      sentQ.current = true;
      setParams({}, { replace: true });
      send(q);
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveProposal = (idx, status, actions) => {
    setMsgs((p) => p.map((m, j) => (j === idx ? { ...m, proposal: { actions, status } } : m)));
    if (status === "applied") refresh();
  };

  const newChat = () => {
    setMsgs([]);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-190px)] md:h-[calc(100vh-64px)]" data-testid="chat-page">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <Label>ИИ-ассистент · Claude</Label>
          <h1 className="font-display text-[30px] sm:text-[40px] font-bold tracking-tight mt-1">Объясните словами</h1>
        </div>
        {msgs.length > 0 && <button onClick={newChat} disabled={busy} className="h-10 px-4 rounded-full bg-soft text-sm font-semibold text-[#0A84FF] flex items-center gap-2 disabled:opacity-40" data-testid="chat-new-button"><SquarePen size={15} /> <span className="hidden sm:inline">Новый чат</span></button>}
      </div>

      <GlassCard className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" data-testid="chat-messages">
          {msgs.length === 0 && (
            <div className="min-h-full flex flex-col items-center justify-center text-center px-2 py-2">
              <div className="w-14 h-14 rounded-[16px] grid place-items-center bg-[#0A84FF] text-white mb-5"><Wrench size={28} /></div>
              <div className="font-display text-2xl font-semibold">Настрою всё за вас</div>
              <p className="txt-2 text-sm mt-2 max-w-md">Расскажите текстом или голосом, как у вас на работе: праздники, короткие дни, ставки 125/150/200%, отпуска, бонусы. Я сам внесу настройки и записи. Переписка не сохраняется.</p>
              <div className="grid sm:grid-cols-2 gap-2 mt-6 w-full max-w-2xl">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i + 0.1 }} whileTap={{ scale: 0.97 }} onClick={() => send(s)} className="text-left text-sm rounded-2xl bg-soft border hair px-4 py-3 hover:border-[#0A84FF] transition-colors" data-testid={`chat-suggestion-${i}`}>{s}</motion.button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => <Bubble key={i} m={m} i={i} onResolve={resolveProposal} />)}
          <div ref={endRef} />
        </div>
        <div className="p-3 sm:p-4 border-t hair">
          <div className="flex items-end gap-2 rounded-[24px] bg-soft border hair p-1.5 pl-4 focus-within:border-[#0A84FF] transition-colors">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Напишите или скажите голосом…"
              className="flex-1 bg-transparent outline-none resize-none py-2.5 text-[15px] max-h-32"
              data-testid="chat-input"
            />
            <VoiceButton onText={(t) => send(t)} disabled={busy} />
            <button onClick={() => send()} disabled={busy || !text.trim()} className="w-10 h-10 shrink-0 rounded-full bg-[#0A84FF] text-white grid place-items-center disabled:opacity-40 active:scale-90 transition-transform" data-testid="chat-send-button"><ArrowUp size={18} strokeWidth={2.6} /></button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
