"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

function readStoredTheme(): Theme {
  const saved = window.localStorage.getItem("sb-theme");
  return saved === "light" || saved === "dark" ? saved : "dark";
}

function subscribeTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("sb-theme-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("sb-theme-change", onStoreChange);
  };
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    readStoredTheme,
    () => "dark" as Theme,
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("sb-theme", next);
    window.dispatchEvent(new Event("sb-theme-change"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
