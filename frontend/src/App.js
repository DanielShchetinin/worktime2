import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import AppShell from "@/components/AppShell";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import CalendarPage from "@/pages/CalendarPage";
import StatsPage from "@/pages/StatsPage";
import ChatPage from "@/pages/ChatPage";
import SettingsPage from "@/pages/SettingsPage";

const Splash = () => (
  <div className="min-h-screen grid place-items-center">
    <div className="w-10 h-10 rounded-full border-2 border-[#0A84FF] border-t-transparent animate-spin" />
  </div>
);

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  return user ? <Navigate to="/" replace /> : children;
};

const ThemedToaster = () => {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-center" richColors toastOptions={{ style: { borderRadius: 18, backdropFilter: "blur(20px)" } }} />;
};

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><AuthPage /></PublicOnly>} />
            <Route element={<Protected><AppShell /></Protected>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ThemedToaster />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
