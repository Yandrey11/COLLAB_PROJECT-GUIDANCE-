import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  COLOR_DEFAULTS,
  COLOR_PRESETS,
  applyColorTheme,
  isValidHex,
  persistColorTheme,
  resetColorThemeToDefault,
} from "../utils/themeUtils";
import useSingleFlight from "../hooks/useSingleFlight";

/**
 * Theme / Appearance — color customization UI.
 *
 * Reusable across Counselor and Admin Settings pages.
 *
 * Props:
 *  - role:           "admin" | "counselor"  (determines defaults + reset target)
 *  - initialColors:  { bg, primary, accent, preset } (from API/state; optional)
 *  - saving:         boolean (parent's save-in-flight flag)
 *  - onSave(colors): called when user clicks Save Changes (returns Promise)
 *  - onReset():      called when user clicks Reset to Default (returns Promise)
 */
export default function ColorThemeSection({
  role = "counselor",
  initialColors,
  saving = false,
  onSave,
  onReset,
}) {
  const defaults = useMemo(
    () => COLOR_DEFAULTS[role] || COLOR_DEFAULTS.counselor,
    [role]
  );

  const [colors, setColors] = useState(() => ({
    bg: initialColors?.bg || defaults.bg,
    primary: initialColors?.primary || defaults.primary,
    accent: initialColors?.accent || defaults.accent,
    preset: initialColors?.preset || defaults.preset,
  }));
  const { run: runAction, isRunning: actionRunning } = useSingleFlight();

  // Sync down when parent loads from API
  const isFirstSyncRef = useRef(true);
  useEffect(() => {
    if (!initialColors) return;
    const next = {
      bg: initialColors.bg || defaults.bg,
      primary: initialColors.primary || defaults.primary,
      accent: initialColors.accent || defaults.accent,
      preset: initialColors.preset || defaults.preset,
    };
    setColors(next);
    if (isFirstSyncRef.current) {
      // On first load, also apply once so we visually match persisted state
      applyColorTheme(next);
      isFirstSyncRef.current = false;
    }
  }, [initialColors, defaults]);

  // Live preview — apply on every change without persisting
  useEffect(() => {
    applyColorTheme(colors);
  }, [colors]);

  const updateColor = (key, value) => {
    setColors((prev) => ({ ...prev, [key]: value, preset: "custom" }));
  };

  const applyPreset = (presetKey) => {
    const p = COLOR_PRESETS[presetKey];
    if (!p) return;
    setColors({
      bg: p.bg,
      primary: p.primary,
      accent: p.accent,
      preset: presetKey,
    });
  };

  const handleSave = async () => {
    await runAction(async () => {
      if (!onSave) return;
      const safe = {
        bg: isValidHex(colors.bg) ? colors.bg : defaults.bg,
        primary: isValidHex(colors.primary) ? colors.primary : defaults.primary,
        accent: isValidHex(colors.accent) ? colors.accent : defaults.accent,
        preset: colors.preset || "custom",
      };
      persistColorTheme(safe);
      applyColorTheme(safe);
      await onSave(safe);
    });
  };

  const handleReset = async () => {
    await runAction(async () => {
      const def = resetColorThemeToDefault(role);
      setColors({ ...def, preset: defaults.preset });
      if (onReset) await onReset();
    });
  };

  const allValid = ["bg", "primary", "accent"].every((k) => isValidHex(colors[k]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white/90 p-5 dark:border-gray-700/90 dark:bg-gray-900/25"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Theme / Appearance
          </h3>
          <p className="mt-1 m-0 text-sm text-gray-600 dark:text-gray-400">
            Personalize background, primary, and accent colors. Changes preview instantly.
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="mb-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Preset themes
        </label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(COLOR_PRESETS).map(([key, p]) => {
            const active = colors.preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "border-gray-900 bg-gray-50 text-gray-900 dark:border-gray-100 dark:bg-gray-800 dark:text-gray-100"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500"
                }`}
              >
                <span className="flex h-5 w-5 overflow-hidden rounded-full ring-1 ring-black/5">
                  <span style={{ backgroundColor: p.bg }} className="h-full w-1/3" />
                  <span style={{ backgroundColor: p.primary }} className="h-full w-1/3" />
                  <span style={{ backgroundColor: p.accent }} className="h-full w-1/3" />
                </span>
                {p.label}
              </button>
            );
          })}
          <span
            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium ${
              colors.preset === "custom"
                ? "border-gray-900 bg-gray-50 text-gray-900 dark:border-gray-100 dark:bg-gray-800 dark:text-gray-100"
                : "border-dashed border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400"
            }`}
          >
            Custom
          </span>
        </div>
      </div>

      {/* Color pickers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { key: "bg", label: "Background", help: "Main app background" },
          { key: "primary", label: "Primary", help: "Buttons, active states, highlights" },
          { key: "accent", label: "Accent", help: "Hover, links, chart accents" },
        ].map((field) => (
          <ColorField
            key={field.key}
            label={field.label}
            help={field.help}
            value={colors[field.key]}
            onChange={(v) => updateColor(field.key, v)}
          />
        ))}
      </div>

      {/* Live preview */}
      <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Live preview
        </div>
        <div
          className="rounded-b-xl p-5"
          style={{ backgroundColor: colors.bg }}
        >
          <div className="rounded-lg bg-white/95 p-4 shadow-sm ring-1 ring-black/5 dark:bg-gray-900/80 dark:ring-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="m-0 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Card title
                </p>
                <p
                  className="mt-0.5 m-0 text-base font-semibold"
                  style={{ color: colors.primary }}
                >
                  Sample card heading
                </p>
                <p className="mt-1 m-0 text-xs text-gray-600 dark:text-gray-300">
                  This is how surfaces will look with your selected colors.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-2 w-12 rounded-full"
                  style={{ backgroundColor: colors.accent }}
                />
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                  style={{
                    backgroundColor: colors.primary,
                    color: "#ffffff",
                  }}
                >
                  Primary action
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
                  style={{
                    borderColor: colors.accent,
                    color: colors.primary,
                    backgroundColor: "transparent",
                  }}
                >
                  Secondary
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!allValid && (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
          One or more values are not valid 6-digit hex colors (e.g., #2563eb).
        </p>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          disabled={saving || actionRunning}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
        >
          Reset to default
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || actionRunning || !allValid}
          className="btn-theme-primary rounded-xl px-5 py-2.5 text-sm font-medium"
        >
          {saving || actionRunning ? "Saving…" : "Save changes"}
        </button>
      </div>
    </motion.div>
  );
}

function ColorField({ label, help, value, onChange }) {
  const valid = isValidHex(value);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <p className="m-0 text-xs text-gray-500 dark:text-gray-400">{help}</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color picker`}
          className="h-8 w-10 cursor-pointer rounded border border-gray-200 bg-transparent dark:border-gray-700"
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = `#${v}`;
            onChange(v);
          }}
          spellCheck={false}
          maxLength={7}
          placeholder="#7c3aed"
          className={`w-full bg-transparent font-mono text-sm focus:outline-none ${
            valid
              ? "text-gray-900 dark:text-gray-100"
              : "text-rose-600 dark:text-rose-400"
          }`}
        />
      </div>
    </div>
  );
}
