/**
 * Dates and times, always in the company's timezone.
 *
 * Pages are rendered twice: once on the server (Vercel runs in UTC) and again
 * in the browser (Bangkok). Anything formatted "in local time" therefore came
 * out seven hours apart, React saw two different texts, threw away the
 * server's HTML and rendered the page again. Pinning every format to one
 * timezone makes both renders agree — and a timestamp means the same thing to
 * everyone in the company wherever their laptop thinks it is.
 */

export const APP_TIME_ZONE = "Asia/Bangkok";

const parts = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hourCycle: "h23", ...opts })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

/** `2026-04-30T08:12:00Z` → `30-04-2026 15:12` */
export function formatDateTimeTz(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = parts(d, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

/** `2026-04-30T20:00:00Z` → `2026-05-01` (the calendar day in Bangkok) */
export function isoDateTz(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = parts(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** `toLocaleDateString` with the timezone pinned. */
export function formatDateLocale(
  value: string | number | Date,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(locale, { timeZone: APP_TIME_ZONE, ...opts });
}

/** `toLocaleString` (date and time) with the timezone pinned. */
export function formatDateTimeLocale(value: string | Date, locale: string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(locale, { timeZone: APP_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
}
