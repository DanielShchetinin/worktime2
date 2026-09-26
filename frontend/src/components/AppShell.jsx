import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutGrid, CalendarDays, BarChart3, Sparkles, Settings2, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Backdrop } from "@/components/Backdrop";
import { ActivityRings, RING_COLORS } from "@/components/ActivityRings";

const NAV = [
  { to: "/", label: "Дашборд", icon: LayoutGrid, id: "dashboard" },
  { to: "/calendar", label: "Календарь", icon: CalendarDays, id: "calendar" },
  { to: "/stats", label: "Статистика", icon: BarChart3, id: "stats" },
  { to: "/chat", label: "Ассистент", icon: Sparkles, id: "chat" },
  { to: "/settings", label: "Настройки", icon: Settings2, id: "settings" },
];

const Logo = () => (
  <div className="flex items-center gap-3">
    <ActivityRings
      size={34}
      stroke={4}
      gap={1.5}
      rings={[
        { value: 0.8, max: 1, colors: RING_COLORS.red },
        { value: 0.6, max: 1, colors: RING_COLORS.green },
        { value: 0.9, max: 1, colors: RING_COLORS.blue },
      ]}
    />
    <div className="font-display text-xl font-semibold tracking-tight">Смена</div>
  </div>
);

export const ThemeToggle = ({ className = "" }) => {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      data-testid="theme-toggle-button"
      aria-label="Переключить тему"
      className={`w-10 h-10 rounded-full grid place-items-center bg-soft border hair hover:scale-105 active:scale-95 transition-transform ${className}`}
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
    <aside className="glass hidden md:flex fixed left-4 top-4 bottom-4 w-[248px] rounded-[30px] flex-col p-5 z-40">
      <Logo />
      <nav className="mt-10 flex flex-col gap-1">
        {NAV.map((n) => {
          const active = isActive(pathname, n.to);
          return (
            <NavLink key={n.to} to={n.to} data-testid={`nav-${n.id}`} className="relative flex items-center gap-3 px-4 h-11 rounded-2xl text-sm font-semibold">
              {active && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-2xl bg-[#0A84FF]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <n.icon size={18} className={`relative ${active ? "text-white" : "txt-2"}`} />
              <span className={`relative ${active ? "text-white" : ""}`}>{n.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between rounded-2xl bg-soft p-3">
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
  return (
    <nav className="glass-strong md:hidden fixed bottom-3 inset-x-3 h-[66px] rounded-[26px] z-50 flex items-center justify-around px-1.5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {NAV.map((n) => {
        const active = isActive(pathname, n.to);
        return (
          <NavLink key={n.to} to={n.to} data-testid={`tab-${n.id}`} className="relative flex-1 h-[54px] flex flex-col items-center justify-center gap-0.5">
            {active && <motion.span layoutId="tab-pill" className="absolute inset-x-1 inset-y-0 rounded-[20px] bg-[#0A84FF]/15" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <n.icon size={20} className={`relative ${active ? "text-[#0A84FF]" : "txt-2"}`} strokeWidth={active ? 2.4 : 2} />
            <span className={`relative text-[10px] font-semibold ${active ? "text-[#0A84FF]" : "txt-2"}`}>{n.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen relative">
      <Backdrop />
      <Sidebar />
      <header className="md:hidden sticky top-0 z-40 px-4 pt-3 pb-2 flex items-center justify-between glass-strong !border-x-0 !border-t-0 !rounded-none !shadow-none">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="relative z-10 md:pl-[280px] px-4 sm:px-6 lg:pr-8 pt-5 md:pt-8 pb-28 md:pb-10">
        <div key={pathname} className="max-w-[1320px] mx-auto fade-up">
          <Outlet />
        </div>
      </main>
      <BottomBar />
    </div>
  );
}
