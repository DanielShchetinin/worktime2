import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, tokens } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(false));
    const onLogout = () => setUser(false);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  const handle = (data) => {
    tokens.set(data.access_token, data.refresh_token);
    qc.clear();
    setUser(data.user);
  };

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    handle(data);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    handle(data);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    tokens.clear();
    qc.clear();
    setUser(false);
  }, [qc]);

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
