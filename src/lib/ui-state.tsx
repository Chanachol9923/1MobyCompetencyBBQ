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

/**
 * The only client state left in the app.
 *
 * Everything that is a fact about the organisation — assessments, development
 * plans, learning progress, points — lives in Postgres and is read on the
 * server. What remains here is genuinely per-browser: which language this person
 * prefers, and the toast currently on screen.
 */

export type Lang = "en" | "th";

const LANG_KEY = "1moby-lang";

type UiState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toast: string | null;
  notify: (message: string) => void;
};

const UiContext = createContext<UiState | null>(null);

export function UiProvider({
  children,
  initialLang = "en",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [toast, setToast] = useState<string | null>(null);

  // read the stored preference after mount, so the server and the first client
  // render agree and React does not report a hydration mismatch
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "en" || saved === "th") setLangState(saved);
    } catch {
      /* private mode or blocked storage — English is a fine default */
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* the choice still applies for this session */
    }
    document.documentElement.lang = next;
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 2600);
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, toast, notify }),
    [lang, setLang, toast, notify],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside <UiProvider>");
  return ctx;
}
