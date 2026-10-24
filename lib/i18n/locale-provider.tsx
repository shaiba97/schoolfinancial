"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DirectionProvider } from "@/components/ui/direction";
import { ar, en, type MessageKey } from "./messages";

export type { MessageKey };

export type Locale = "en" | "ar";
export type TextDirection = "ltr" | "rtl";

const STORAGE_KEY = "fin_locale";

export const LOCALE_STORAGE_KEY = STORAGE_KEY;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ar };

type I18nContextValue = {
  locale: Locale;
  dir: TextDirection;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    // storage unavailable
  }
  if (typeof navigator !== "undefined" && navigator.language?.startsWith("ar")) {
    return "ar";
  }
  return "en";
}

function applyToDocument(locale: Locale) {
  const el = document.documentElement;
  el.lang = locale;
  el.dir = locale === "ar" ? "rtl" : "ltr";
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value == null ? "" : String(value);
  });
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    Promise.resolve().then(() => {
      const detected = readStoredLocale();
      setLocaleState(detected);
      applyToDocument(detected);
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    applyToDocument(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[locale];
    return {
      locale,
      dir,
      setLocale,
      t: (key, params) => interpolate(dict[key], params),
    };
  }, [locale, dir, setLocale]);

  return (
    <I18nContext.Provider value={value}>
      <DirectionProvider direction={dir}>{children}</DirectionProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}
