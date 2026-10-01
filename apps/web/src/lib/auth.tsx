import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_URL, authHeaders, clearSession, getEmail, getToken, setSession } from "./token";
import { runSync } from "./sync";

interface AuthContextValue {
  ready: boolean;
  token: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export class AuthError extends Error {
  constructor(public code: "bad_email" | "weak_password" | "registration_closed" | "invalid_credentials" | "network" | "generic") {
    super(code);
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function post(path: string, body: unknown): Promise<{ token: string; email: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError("network");
  }
  if (!res.ok) {
    let code = "generic";
    try {
      code = ((await res.json()) as { error?: string }).error ?? "generic";
    } catch {
      /* ignore */
    }
    if (code === "registration_closed" || code === "invalid_credentials" || code === "bad_email" || code === "weak_password") {
      throw new AuthError(code);
    }
    throw new AuthError("generic");
  }
  return (await res.json()) as { token: string; email: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setToken(getToken());
    setEmail(getEmail());
    setReady(true);
  }, []);

  // Session dropped by sync (revoked/expired token)
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setEmail(null);
    };
    window.addEventListener("mizan:unauthorized", onUnauthorized);
    return () => window.removeEventListener("mizan:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (mail: string, password: string) => {
    const result = await post("/api/auth/login", { email: mail, password });
    setSession(result.token, result.email);
    setToken(result.token);
    setEmail(result.email);
    void runSync(); // pull anything recorded on other devices
  }, []);

  const register = useCallback(async (mail: string, password: string) => {
    const result = await post("/api/auth/register", { email: mail, password });
    setSession(result.token, result.email);
    setToken(result.token);
    setEmail(result.email);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setEmail(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, token, email, login, register, logout }),
    [ready, token, email, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export { authHeaders };
