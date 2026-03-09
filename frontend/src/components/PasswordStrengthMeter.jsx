import React from "react";
import { validatePassword } from "../utils/passwordValidation";

/**
 * Google-Style Password Strength Meter Component
 * Displays real-time password validation feedback with helpful hints
 */
export default function PasswordStrengthMeter({ password, email = "", name = "" }) {
  const validation = validatePassword(password || "", { email, name });

  // Strength configuration with Google-style colors
  const strengthConfig = {
    Weak: {
      barClass: "bg-red-500",
      labelClass: "text-red-600 dark:text-red-400",
      widthClass: "w-1/3",
      label: "Weak",
      icon: "⚠️",
    },
    Medium: {
      barClass: "bg-yellow-500",
      labelClass: "text-yellow-600 dark:text-yellow-400",
      widthClass: "w-2/3",
      label: "Medium",
      icon: "⚡",
    },
    Strong: {
      barClass: "bg-green-500",
      labelClass: "text-green-600 dark:text-green-400",
      widthClass: "w-full",
      label: "Strong",
      icon: "✅",
    },
  };

  const config = strengthConfig[validation.strength] || strengthConfig.Weak;

  // Don't show if password is empty
  if (!password || password.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar */}
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full ${config.barClass} ${config.widthClass} transition-all duration-300 ease-out`}
        />
      </div>

      {/* Strength Label */}
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${config.labelClass}`}>
          {config.icon} {config.label}
        </span>
        {validation.hasPersonalInfo && (
          <span className="text-xs text-orange-600 dark:text-orange-400">
            Avoid personal info
          </span>
        )}
      </div>

      {/* Validation Rules with Hints */}
      <div className="mt-2 space-y-1.5">
        {validation.rules.map((rule) => {
          // Skip the "noSpaces" rule from visual display (we'll show it as an error if violated)
          if (rule.id === "noSpaces" && rule.passed) {
            return null;
          }

          return (
            <div
              key={rule.id}
              className="flex items-start gap-2 text-xs"
            >
              {/* Check/X Icon */}
              <span
                className={`flex-shrink-0 mt-0.5 ${
                  rule.passed
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {rule.passed ? "✓" : "○"}
              </span>

              {/* Rule Text */}
              <span
                className={
                  rule.passed
                    ? "text-green-700 dark:text-green-300 line-through"
                    : "text-gray-600 dark:text-gray-400"
                }
              >
                {rule.passed ? rule.label : rule.hint || rule.label}
              </span>
            </div>
          );
        })}

        {/* Show space error if present */}
        {validation.hasLeadingTrailingSpaces && (
          <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
            <span>✗</span>
            <span>Password cannot contain spaces at the beginning or end.</span>
          </div>
        )}

        {/* Show personal info warning */}
        {validation.hasPersonalInfo && (
          <div className="flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400">
            <span>⚠</span>
            <span>Avoid using your name or email in your password.</span>
          </div>
        )}

        {/* Show common password warning */}
        {!validation.rules.find((r) => r.id === "notCommon")?.passed && password && (
          <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
            <span>✗</span>
            <span>Avoid using common or easily guessed passwords.</span>
          </div>
        )}
      </div>

    </div>
  );
}
