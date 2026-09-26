import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Clock, Sparkles, PartyPopper, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { ActivityRings, RING_COLORS } from "@/components/ActivityRings";
import { ThemeToggle } from "@/components/AppShell";

const FEATURES = [
  { icon: Clock, text: "Старт дня одной кнопкой", c: "#30D158" },
  { icon: Wallet, text: "125 / 150 / 200% и налоги Израиля", c: "#0A84FF" },
  { icon: PartyPopper, text: "Праздники, отпуска, короткие дни", c: "#FF9500" },
  { icon: Sparkles, text: "ИИ настроит всё по вашим словам", c: "#BF5AF2" },
];

const Hero = () => (
  <div className="hidden lg:flex flex-col justify-center pr-10">
    <ActivityRings
      size={300}
      stroke={26}
      gap={7}
      rings={[
        { value: 0.82, max: 1, colors: RING_COLORS.red },
        { value: 0.64, max: 1, colors: RING_COLORS.green },
        { value: 0.91, max: 1, colors: RING_COLORS.blue },
      ]}
    >
      <div><div className="num text-4xl font-semibold">08:24</div><div className="text-xs txt-2 mt-1">сегодня</div></div>
    </ActivityRings>
    <h1 className="font-display text-5xl xl:text-6xl font-semibold tracking-tight mt-10 leading-[1.02]">
      Каждая минута<br />
      <span className="txt-2">на своём месте.</span>
    </h1>
    <div className="grid grid-cols-2 gap-3 mt-8 max-w-lg">
      {FEATURES.map((f, i) => (
        <motion.div key={f.text} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="flex items-center gap-3 py-1">
          <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: `${f.c}22`, color: f.c }}><f.icon size={16} /></span>
          <span className="text-sm font-medium">{f.text}</span>
        </motion.div>
      ))}
    </div>
  </div>
);

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(f.email, f.password);
      else await register(f.name, f.email, f.password);
    } catch (ex) {
      setErr(apiError(ex));
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    try { await login("demo@smena.app", "demo12345"); } catch (ex) { setErr(apiError(ex)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="auth-page">
      <div className="absolute top-5 right-5 z-20"><ThemeToggle /></div>
      <div className="relative z-10 min-h-screen max-w-6xl mx-auto px-5 grid lg:grid-cols-2 items-center gap-6 py-10">
        <Hero />
        <div className="w-full max-w-md mx-auto lg:ml-auto">
          <div className="lg:hidden flex justify-center mb-8">
            <ActivityRings size={120} stroke={12} gap={4} rings={[{ value: 0.8, max: 1, colors: RING_COLORS.red }, { value: 0.6, max: 1, colors: RING_COLORS.green }, { value: 0.9, max: 1, colors: RING_COLORS.blue }]} />
          </div>
          <div className="glass-strong rounded-[22px] p-7 sm:p-9">
            <div className="font-display text-3xl font-semibold tracking-tight">Смена</div>
            <div className="text-sm txt-2 mt-1">Учёт рабочего времени и заработка</div>
            <div className="flex p-1 rounded-full bg-soft border hair mt-7 relative">
              {[["login", "Вход"], ["register", "Регистрация"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setMode(k); setErr(""); }} className="relative flex-1 h-10 rounded-full text-sm font-semibold" data-testid={`auth-tab-${k}`}>
                  {mode === k && <motion.span layoutId="auth-pill" className="absolute inset-0 rounded-full bg-[#0A84FF]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className={`relative ${mode === k ? "text-white" : "txt-2"}`}>{l}</span>
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <AnimatePresence initial={false}>
                {mode === "register" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <input className="field !h-12" placeholder="Имя" value={f.name} onChange={set("name")} data-testid="auth-name-input" />
                  </motion.div>
                )}
              </AnimatePresence>
              <input className="field !h-12" type="email" placeholder="Email" required value={f.email} onChange={set("email")} data-testid="auth-email-input" />
              <input className="field !h-12" type="password" placeholder="Пароль (мин. 6 символов)" required minLength={6} value={f.password} onChange={set("password")} data-testid="auth-password-input" />
              {err && <div className="text-sm text-[#FF453A] font-medium" data-testid="auth-error">{err}</div>}
              <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-[#0A84FF] text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60" data-testid="auth-submit-button">
                {mode === "login" ? "Войти" : "Создать аккаунт"} <ArrowRight size={17} />
              </button>
            </form>
            <button onClick={demo} disabled={busy} className="w-full mt-3 h-11 rounded-full bg-soft border hair text-sm font-semibold hover:border-[#30D158] transition-colors" data-testid="auth-demo-button">Посмотреть демо с данными</button>
          </div>
        </div>
      </div>
    </div>
  );
}
