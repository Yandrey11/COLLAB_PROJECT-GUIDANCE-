import {
  PROBLEMS_PRESENTED_OPTIONS,
  parseProblemsPresentedParts,
  mergeProblemsPresented,
} from "../constants/problemsPresented";

/**
 * @param {{ value: string; onChange: (next: string) => void; disabled?: boolean }} props
 */
export default function ProblemsPresentedCheckboxes({ value, onChange, disabled }) {
  const { codes, rest } = parseProblemsPresentedParts(value);
  const selected = new Set(codes);

  const toggle = (code) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(mergeProblemsPresented([...next], rest));
  };

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="sr-only">Problems presented</legend>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        Select all that apply. Standard codes are saved (e.g. HF, STR). You can add optional notes below.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PROBLEMS_PRESENTED_OPTIONS.map(({ code, label }) => (
          <label
            key={code}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800/80 ${
              disabled ? "cursor-not-allowed opacity-60" : "hover:border-indigo-300 dark:hover:border-indigo-600"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-500 dark:bg-gray-700 dark:focus:ring-indigo-400"
              checked={selected.has(code)}
              onChange={() => toggle(code)}
              disabled={disabled}
            />
            <span className="text-gray-800 dark:text-gray-200">
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">{code}</span>
              <span className="text-gray-500 dark:text-gray-400"> — </span>
              {label}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3">
        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
          Other details (optional)
        </label>
        <textarea
          value={rest}
          onChange={(e) => onChange(mergeProblemsPresented(codes, e.target.value))}
          disabled={disabled}
          rows={2}
          placeholder="Extra context, or text from before categories were used…"
          className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
        />
      </div>
    </fieldset>
  );
}
