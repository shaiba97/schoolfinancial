export { cn } from "cn"

/** Locale-aware date formatting helpers (English words, Arabic labels, Latin digits). */

export function formatDate(value: string | Date, locale?: string): string {
  return new Date(value).toLocaleDateString(
    locale === "ar" ? "ar-u-nu-latn" : "en-GB",
    { day: "2-digit", month: "short", year: "numeric" },
  );
}

export function formatDateTime(value: string | Date, locale?: string): string {
  return new Date(value).toLocaleString(
    locale === "ar" ? "ar-u-nu-latn" : "en-GB",
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
  );
}

export function formatTimeLocale(value: string, locale?: string): string {
  const date = parseTimeOnly(value);
  if (!date) return value;
  return date.toLocaleTimeString(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseTimeOnly(value: string): Date | null {
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (timeMatch) {
    const date = new Date();
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3] ?? 0), 0);
    return date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
