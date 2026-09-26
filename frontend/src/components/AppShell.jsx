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
  return (
    <nav className="glass-strong md:hidden fixed bottom-0 inset-x-0 z-50 flex items-start justify-around border-t hair pt-1" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}>
      {NAV.map((n) => {
        const active = isActive(pathname, n.to);
        return (
          <NavLink key={n.to} to={n.to} data-testid={`tab-${n.id}`} className="flex-1 h-[48px] flex flex-col items-center justify-center gap-0.5 active:opacity-60">
            <n.icon size={22} className={active ? "text-[#0A84FF]" : "txt-2"} strokeWidth={active ? 2.3 : 1.9} />
            <span className={`text-[10px] font-medium ${active ? "text-[#0A84FF]" : "txt-2"}`}>{n.label}</span>
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
      <Sidebar />
      <header className="md:hidden sticky top-0 z-40 px-4 h-12 flex items-center justify-between glass-strong border-b hair">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="relative z-10 md:pl-[264px] px-4 sm:px-6 lg:pr-8 pt-5 md:pt-8 pb-24 md:pb-10">
        <div key={pathname} className="max-w-[1320px] mx-auto fade-up">
          <Outlet />
        </div>
      </main>
      <BottomBar />
    </div>
  );
}
