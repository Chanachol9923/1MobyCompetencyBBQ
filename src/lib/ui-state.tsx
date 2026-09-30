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

export type ToastTone = "success" | "error";
export type ToastMessage = { id: number; message: string; tone: ToastTone };

type UiState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toast: ToastMessage | null;
  /** success toasts leave on their own; errors stay longer and can be closed */
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
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
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToast({ id, message, tone });
    window.setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      tone === "error" ? 7000 : 3500,
    );
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({ lang, setLang, toast, notify, dismissToast }),
    [lang, setLang, toast, notify, dismissToast],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside <UiProvider>");
  return ctx;
}
