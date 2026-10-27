export function formatPH(iso, opts = {}) {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    ...opts,
  });
}

export const BUSINESS_TZ = "Asia/Manila";

function manilaParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/**
 * The store business date (YYYY-MM-DD) in Asia/Manila.
 *
 * Use this instead of `new Date().toISOString().slice(0, 10)` for anything
 * that selects an `attendance_records.date` or `shifts.shift_date`. UTC is
 * 8 hours behind Manila, so the UTC date is still "yesterday" from 00:00 to
 * 08:00 Manila time.
 */
export function toManilaDate(date = new Date()) {
  const { year, month, day } = manilaParts(date);
  return `${year}-${month}-${day}`;
}

/** Calendar date from the Date's own components — never shifts by timezone. */
export function toLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add days to a YYYY-MM-DD string without timezone drift. */
export function addDaysToDate(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Business date N days before today (Asia/Manila). */
export function daysAgoManila(days) {
  return toManilaDate(new Date(Date.now() - days * 86_400_000));
}

/** Minutes since midnight in Asia/Manila. */
export function manilaMinutes(date = new Date()) {
  const { hour, minute } = manilaParts(date);
  return hour * 60 + minute;
}

/** HH:mm in Asia/Manila, for `<input type="time">`. */
export function toManilaTimeInput(iso) {
  if (!iso) return "";
  const { hour, minute } = manilaParts(new Date(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Turn a date + Manila wall-clock time into an ISO instant. */
export function manilaDateTimeToIso(dateStr, timeStr) {
  if (!timeStr) return null;
  // The Philippines has no DST and is permanently UTC+08:00.
  return new Date(`${dateStr}T${timeStr}:00+08:00`).toISOString();
}

export function formatTime(iso) {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}
