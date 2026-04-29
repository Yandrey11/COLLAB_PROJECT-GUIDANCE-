import { useState, useEffect } from "react";
import { applyTheme, getCurrentTheme, initializeTheme, normalizeTheme } from "../utils/themeUtils";

/**
 * Custom hook to manage theme state across the application
 * @returns {object} - { theme, setTheme, toggleTheme }
 */
export const useTheme = () => {
  const [theme, setThemeState] = useState(() => getCurrentTheme());

  useEffect(() => {
    // Initialize theme on mount
    initializeTheme().then((initialTheme) => {
      setThemeState(initialTheme);
    });

    // Listen for storage changes (when theme is changed in another tab/window)
    const handleStorageChange = (e) => {
      if (e.key === "theme") {
        const newTheme = e.newValue == null ? "light" : normalizeTheme(e.newValue);
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    return newTheme;
  };

  return { theme, setTheme, toggleTheme };
};

