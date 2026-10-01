import { useState, type FormEvent } from "react";
import { useLang } from "../i18n/lang";
import { AuthError, useAuth } from "../lib/auth";
import { Icon } from "../components/Icon";

export default function AuthScreen() {
  const { t } = useLang();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
    } catch (err) {
      const code = err instanceof AuthError ? err.code : "generic";
      const map: Record<string, string> = {
        invalid_credentials: t("auth_error_invalid"),
        registration_closed: t("auth_error_closed"),
        network: t("auth_error_network"),
        bad_email: t("auth_error_generic"),
        weak_password: t("auth_error_generic"),
        generic: t("auth_error_generic"),
      };
      setError(map[code] ?? t("auth_error_generic"));
      if (code === "registration_closed" && mode === "register") setMode("login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-teal-800 to-slate-900 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-2xl font-bold text-white">
            <Icon name="wallet" className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{mode === "login" ? t("auth_login_title") : t("auth_register_title")}</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">{t("auth_email")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-start outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              placeholder="owner@store.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">{t("auth_password")}</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-start outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-teal-700 py-3 font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
          >
            {busy ? t("auth_signing_in") : mode === "login" ? t("auth_login") : t("auth_register")}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center text-sm">
          {mode === "register" && <p className="text-slate-500">{t("auth_first_hint")}</p>}
          <button
            type="button"
            className="font-medium text-teal-700 hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? t("auth_to_register") : t("auth_to_login")}
          </button>
        </div>
      </div>

      <p className="mt-6 max-w-sm text-center text-xs text-teal-100/80">{t("auth_offline_note")}</p>
    </div>
  );
}
