import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  /** Custom accent color override (CSS color string). null = use palette default. */
  accentColor: string | null;
  setAccentColor: (color: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

const THEME_KEY = "theme";
const ACCENT_KEY = "rivalnxt:accent-color";

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = "dark",
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(THEME_KEY) as Theme;
      return saved || defaultTheme;
    }
    return defaultTheme;
  });

  const [accentColor, setAccentColorState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(ACCENT_KEY) || null;
    }
    return null;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Apply custom accent color as CSS variable override
  useEffect(() => {
    const root = window.document.documentElement;
    if (accentColor) {
      root.style.setProperty("--primary", accentColor);
      root.style.setProperty("--info", accentColor);
      localStorage.setItem(ACCENT_KEY, accentColor);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--info");
      localStorage.removeItem(ACCENT_KEY);
    }
  }, [accentColor]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setAccentColor = useCallback((color: string | null) => {
    setAccentColorState(color);
  }, []);

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
    accentColor,
    setAccentColor,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
