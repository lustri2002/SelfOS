"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/Button";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button
      onClick={toggle}
      variant="subtle"
      className="w-full justify-start"
    >
      {theme === "dark" ? (
        <Moon className="h-4 w-4 text-indigo-400" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500" />
      )}
      <span>
        {theme === "dark" ? "Tema scuro" : "Tema chiaro"}
      </span>
      <span className="ml-auto text-xs text-[var(--sb-muted)]">Attivo</span>
    </Button>
  );
}
