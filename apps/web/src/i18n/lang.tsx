import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEgp, type Piastres } from "@mizan/core";
import { ar, en, type TranslationKey } from "./strings";

export type Lang = "ar" | "en";
export type Dir = "rtl" | "ltr";

const STORAGE_KEY = "mizan_lang";

interface LangContextValue {
  lang: Lang;
  dir: Dir;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  money: (piastres: Piastres) => string;
  locale: string;
}

const LangContext = createContext<LangContextValue | null>(null);

function readInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const dir: Dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = (lang === "ar" ? ar[key] : en[key]) ?? en[key] ?? key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [lang],
  );

  const money = useCallback((piastres: Piastres) => formatEgp(piastres, lang), [lang]);

  const locale = lang === "ar" ? "ar-EG" : "en-EG";

  const value = useMemo<LangContextValue>(
    () => ({ lang, dir, setLang, t, money, locale }),
    [lang, dir, setLang, t, money, locale],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang outside LangProvider");
  return ctx;
}
