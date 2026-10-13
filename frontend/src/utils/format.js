/**
 * Date display helpers.
 *
 * API dates come in two shapes: `release_date` is a date-only string
 * (`"2022-02-25"`) and timestamps are full ISO strings
 * (`"2026-10-09T10:00:00Z"`). Parsing a date-only string with `new Date(s)`
 * treats it as UTC midnight, which renders as the *previous* day in
 * negative-offset timezones — so date-only values are split into local
 * parts instead. Locale is pinned to `en-US` for deterministic output.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** `"2022-02-25"` → `"Feb 25, 2022"`; invalid/empty → null. */
export function formatDate(value) {
  const match = value && DATE_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Full ISO timestamp → local date string; invalid/empty → null. */
export function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
