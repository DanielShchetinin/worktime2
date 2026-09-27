import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutGrid, CalendarDays, BarChart3, Sparkles, Settings2, Sun, Moon, LogOut, Clock } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/", label: "Дашборд", icon: LayoutGrid, id: "dashboard" },
  { to: "/calendar", label: "Календарь", icon: CalendarDays, id: "calendar" },
  { to: "/stats", label: "Статистика", icon: BarChart3, id: "stats" },
  { to: "/chat", label: "Ассистент", icon: Sparkles, id: "chat" },
  { to: "/settings", label: "Настройки", icon: Settings2, id: "settings" },
];

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="w-8 h-8 rounded-[9px] bg-[#0A84FF] grid place-items-center text-white">
      <Clock size={17} strokeWidth={2.4} />
    </div>
    <div className="text-[17px] font-semibold tracking-tight">Смена</div>
  </div>
);

export const ThemeToggle = ({ className = "" }) => {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      data-testid="theme-toggle-button"
      aria-label="Переключить тему"
      className={`w-9 h-9 rounded-full grid place-items-center bg-soft active:opacity-60 transition-opacity ${className}`}
    >
      <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </motion.span>
    </button>
  );
};

const isActive = (pathname, to) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

const Sidebar = () => {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  return (
    <aside className="glass-strong hidden md:flex fixed left-0 top-0 bottom-0 w-[232px] border-r hair flex-col px-3 py-5 z-40">
      <div className="px-2"><Logo /></div>
      <nav className="mt-8 flex flex-col gap-0.5">
        {NAV.map((n) => {
          const active = isActive(pathname, n.to);
          return (
            <NavLink key={n.to} to={n.to} data-testid={`nav-${n.id}`} className={`flex items-center gap-3 px-3 h-9 rounded-[8px] text-[14px] font-medium transition-colors ${active ? "bg-soft" : "hover:bg-soft"}`}>
              <n.icon size={18} className={active ? "text-[#0A84FF]" : "txt-2"} />
              <span>{n.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between rounded-[12px] bg-soft p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" data-testid="sidebar-user-name">{user?.name}</div>
            <div className="text-xs txt-2 truncate">{user?.email}</div>
          </div>
          <ThemeToggle />
        </div>
        <button onClick={logout} data-testid="logout-button" className="w-full flex items-center gap-2 px-4 h-10 rounded-2xl text-sm txt-2 hover:text-[#FF453A] transition-colors">
          <LogOut size={16} /> Выйти
        </button>
      </div>
    </aside>
  );
};

const BottomBar = () => {
  const { pathname } = useLocation();
  const tabs = NAV.filter((n) => n.id !== "chat");
  const chat = NAV.find((n) => n.id === "chat");
  const chatActive = isActive(pathname, chat.to);
  const tap = () => navigator.vibrate?.(8);
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-50 px-3 flex items-end gap-2.5 pointer-events-none" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
      <nav className="liquid pointer-events-auto flex-1 h-[64px] rounded-full flex items-center p-1.5" data-testid="mobile-tabbar">
        {tabs.map((n) => {
          const active = isActive(pathname, n.to);
          return (
            <NavLink key={n.to} to={n.to} onClick={tap} data-testid={`tab-${n.id}`} className="relative flex-1 h-full flex flex-col items-center justify-center gap-[3px] active:scale-90 transition-transform duration-150">
              {active && <motion.span layoutId="tab-lens" className="liquid-lens absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <motion.span animate={active ? { y: [0, -3, 0], scale: [1, 1.12, 1] } : { y: 0, scale: 1 }} transition={{ duration: 0.35 }} className="relative">
                <n.icon size={21} className={active ? "text-[#0A84FF]" : "text-foreground/70"} strokeWidth={active ? 2.4 : 2} />
              </motion.span>
              <span className={`relative text-[10px] font-semibold leading-none ${active ? "text-[#0A84FF]" : "text-foreground/70"}`}>{n.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <NavLink to={chat.to} onClick={tap} data-testid="tab-chat" aria-label={chat.label}
        className={`pointer-events-auto w-[64px] h-[64px] shrink-0 rounded-full grid place-items-center active:scale-90 transition-transform duration-150 ${chatActive ? "bg-[#0A84FF] text-white shadow-[0_8px_24px_-6px_rgba(10,132,255,0.55)]" : "liquid text-[#0A84FF]"}`}>
        <Sparkles size={24} strokeWidth={2.2} />
      </NavLink>
    </div>
  );
};

export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen relative">
      <Sidebar />
      <header className="md:hidden sticky top-0 z-40 px-4 flex items-center justify-between glass-strong border-b hair" style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(48px + env(safe-area-inset-top))" }}>
        <Logo />
        <ThemeToggle />
      </header>
      <main className="relative z-10 md:pl-[264px] px-4 sm:px-6 lg:pr-8 pt-5 md:pt-8 pb-32 md:pb-10">
        <div key={pathname} className="max-w-[1320px] mx-auto fade-up">
          <Outlet />
        </div>
      </main>
      <BottomBar />
    </div>
  );
}
