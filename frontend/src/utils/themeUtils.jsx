/**
 * Theme Utility Functions
 * Manages light/dark mode across the application
 */

/** Normalize any stored/API value to a supported theme. */
export const normalizeTheme = (value) => {
  if (value === "dark" || value === "light") return value;
  return "light";
};

/**
 * Apply theme to document
 * @param {string} theme - 'light' or 'dark' (invalid values become light)
 */
export const applyTheme = (theme) => {
  const t = normalizeTheme(theme);
  if (t === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("theme", t);
};

/**
 * Get current theme from localStorage or default to 'light'
 * @returns {string} - 'light' or 'dark'
 */
export const getCurrentTheme = () => normalizeTheme(localStorage.getItem("theme"));

/**
 * Initialize theme on app load
 * Uses localStorage first, then counselor or admin settings API when no key is set.
 */
export const initializeTheme = async () => {
  const raw = localStorage.getItem("theme");
  if (raw !== null && raw !== "") {
    const t = normalizeTheme(raw);
    if (t !== raw) {
      localStorage.setItem("theme", t);
    }
    applyTheme(t);
    return t;
  }

  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const counselorToken = localStorage.getItem("token") || localStorage.getItem("authToken");
  const adminToken = localStorage.getItem("adminToken");

  try {
    if (counselorToken) {
      const response = await fetch(`${BASE_URL}/api/counselor/settings`, {
        headers: { Authorization: `Bearer ${counselorToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const apiTheme = data.settings?.display?.theme;
        const t = normalizeTheme(apiTheme);
        if (apiTheme && t === apiTheme) {
          applyTheme(t);
          return t;
        }
      }
    } else if (adminToken) {
      const response = await fetch(`${BASE_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const apiTheme = data.settings?.display?.theme;
        const t = normalizeTheme(apiTheme);
        if (apiTheme && t === apiTheme) {
          applyTheme(t);
          return t;
        }
      }
    }
  } catch (error) {
    console.error("Error fetching theme from settings:", error);
  }

  applyTheme("light");
  return "light";
};

/**
 * Toggle theme between light and dark
 * @returns {string} - The new theme ('light' or 'dark')
 */
export const toggleTheme = () => {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === "light" ? "dark" : "light";
  applyTheme(newTheme);
  return newTheme;
};
