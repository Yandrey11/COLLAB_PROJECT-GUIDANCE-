/**
 * Theme Utility Functions
 * Manages light/dark mode across the application
 */
import { API_BASE_URL } from "../config/apiBaseUrl";

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

  const BASE_URL = API_BASE_URL;
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

/* ============================================================
   COLOR CUSTOMIZATION  (background / primary / accent)
   ============================================================ */

const HEX_REGEX = /^#([0-9a-fA-F]{6})$/;

/** Validate a 6-digit hex color (e.g. #2563eb). */
export const isValidHex = (val) => typeof val === "string" && HEX_REGEX.test(val);

/** Sanitize a single color, returning fallback if invalid. */
export const sanitizeHex = (val, fallback) => (isValidHex(val) ? val : fallback);

/** Role-based defaults: admin=blue, counselor=purple. */
export const COLOR_DEFAULTS = {
  admin: { bg: "#eff6ff", primary: "#2563eb", accent: "#60a5fa", preset: "blue" },
  counselor: { bg: "#f5f3ff", primary: "#7c3aed", accent: "#a78bfa", preset: "purple" },
};

/** Predefined preset palettes used in the picker UI. */
export const COLOR_PRESETS = {
  default: { label: "Slate", bg: "#f1f5f9", primary: "#0f172a", accent: "#334155" },
  purple: { label: "Purple", bg: "#f5f3ff", primary: "#7c3aed", accent: "#a78bfa" },
  blue: { label: "Blue", bg: "#eff6ff", primary: "#2563eb", accent: "#60a5fa" },
  green: { label: "Green", bg: "#ecfdf5", primary: "#059669", accent: "#34d399" },
  rose: { label: "Rose", bg: "#fff1f2", primary: "#e11d48", accent: "#fb7185" },
};

const STORAGE_KEY = "themeColors";

const clamp = (n, min = 0, max = 255) => Math.max(min, Math.min(max, n));

const hexToRgb = (hex) => {
  const m = HEX_REGEX.exec(hex);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};

const rgbToHex = ({ r, g, b }) =>
  "#" +
  [r, g, b]
    .map((n) => clamp(Math.round(n)).toString(16).padStart(2, "0"))
    .join("");

const mix = (hex, target, amount) => {
  const c = hexToRgb(hex);
  const t = hexToRgb(target);
  if (!c || !t) return hex;
  return rgbToHex({
    r: c.r + (t.r - c.r) * amount,
    g: c.g + (t.g - c.g) * amount,
    b: c.b + (t.b - c.b) * amount,
  });
};

/** Apply color theme by writing CSS variables on :root. */
export const applyColorTheme = (colors) => {
  if (typeof document === "undefined") return;
  const role = (localStorage.getItem("activeRole") || "counselor").toLowerCase();
  const defaults = COLOR_DEFAULTS[role] || COLOR_DEFAULTS.counselor;
  const safe = {
    bg: sanitizeHex(colors?.bg, defaults.bg),
    primary: sanitizeHex(colors?.primary, defaults.primary),
    accent: sanitizeHex(colors?.accent, defaults.accent),
  };
  const root = document.documentElement;
  root.style.setProperty("--theme-bg", safe.bg);
  root.style.setProperty("--theme-bg-soft", mix(safe.bg, "#ffffff", 0.4));
  root.style.setProperty("--theme-primary", safe.primary);
  root.style.setProperty("--theme-primary-hover", mix(safe.primary, "#000000", 0.15));
  root.style.setProperty("--theme-primary-soft", mix(safe.primary, "#ffffff", 0.85));
  root.style.setProperty("--theme-primary-contrast", "#ffffff");
  root.style.setProperty("--theme-accent", safe.accent);
  root.style.setProperty("--theme-accent-soft", mix(safe.accent, "#ffffff", 0.78));
};

/** Persist colors to localStorage. */
export const persistColorTheme = (colors) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch (e) {
    console.warn("Failed to persist theme colors:", e);
  }
};

/** Read colors from localStorage. */
export const readPersistedColorTheme = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

/** Apply + persist in one call. */
export const setColorTheme = (colors) => {
  applyColorTheme(colors);
  persistColorTheme(colors);
};

/**
 * Initialize color theme on app load.
 * Order: localStorage → API (per active role) → role default.
 */
export const initializeColorTheme = async () => {
  const persisted = readPersistedColorTheme();
  if (persisted) {
    applyColorTheme(persisted);
    return persisted;
  }

  const BASE_URL = API_BASE_URL;
  const adminToken = localStorage.getItem("adminToken");
  const counselorToken = localStorage.getItem("token") || localStorage.getItem("authToken");

  try {
    if (adminToken) {
      const response = await fetch(`${BASE_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const c = data.settings?.colors;
        if (c) {
          localStorage.setItem("activeRole", "admin");
          applyColorTheme(c);
          persistColorTheme(c);
          return c;
        }
      }
    } else if (counselorToken) {
      const response = await fetch(`${BASE_URL}/api/counselor/settings`, {
        headers: { Authorization: `Bearer ${counselorToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const c = data.settings?.colors;
        if (c) {
          localStorage.setItem("activeRole", "counselor");
          applyColorTheme(c);
          persistColorTheme(c);
          return c;
        }
      }
    }
  } catch (e) {
    console.error("Error fetching color theme from settings:", e);
  }

  // Fallback: role default
  const role = (localStorage.getItem("activeRole") || (adminToken ? "admin" : "counselor")).toLowerCase();
  const fallback = COLOR_DEFAULTS[role] || COLOR_DEFAULTS.counselor;
  applyColorTheme(fallback);
  return fallback;
};

/** Reset color theme to role-based default and clear persistence. */
export const resetColorThemeToDefault = (role) => {
  const r = (role || localStorage.getItem("activeRole") || "counselor").toLowerCase();
  const def = COLOR_DEFAULTS[r] || COLOR_DEFAULTS.counselor;
  applyColorTheme(def);
  persistColorTheme(def);
  return def;
};
