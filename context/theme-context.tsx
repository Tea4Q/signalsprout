import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "signalsprout_theme_v1";

interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedScheme: "light" | "dark";
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  themePreference: "system",
  resolvedScheme: "dark",
  setThemePreference: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? "dark";
  const [preference, setPreference] = useState<ThemePreference>("system");

  // Load persisted preference on mount
  useEffect(() => {
    const load = async () => {
      try {
        let stored: string | null = null;
        if (typeof localStorage !== "undefined") {
          // Web
          stored = localStorage.getItem(STORAGE_KEY);
        } else {
          stored = await SecureStore.getItemAsync(STORAGE_KEY);
        }
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreference(stored);
        }
      } catch {
        // Ignore read errors — fall back to system
      }
    };
    load();
  }, []);

  const setThemePreference = useCallback(async (pref: ThemePreference) => {
    setPreference(pref);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, pref);
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, pref);
      }
    } catch {
      // Ignore write errors
    }
  }, []);

  const resolvedScheme: "light" | "dark" =
    preference === "system" ? systemScheme : preference;

  return (
    <ThemeContext.Provider
      value={{ themePreference: preference, resolvedScheme, setThemePreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemeContext);
}
