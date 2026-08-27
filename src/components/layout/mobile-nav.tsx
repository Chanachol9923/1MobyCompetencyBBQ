"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * The mobile drawer is opened from the top bar but rendered by the sidebar, so
 * the open state has to live above both of them.
 */
const MobileNavContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
} | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used inside MobileNavProvider");
  return ctx;
}
