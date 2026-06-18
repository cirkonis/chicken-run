/**
 * Shared helpers for hunt scheduling + bar venue types (the "bar rules" feature).
 *
 * Day numbering matches Google Places opening-hours data: 0 = Sunday … 6 =
 * Saturday. We surface the days Monday-first for a friendlier picker, but the
 * stored value is the Google number.
 *
 * Times are stored as MINUTES since local midnight (e.g. 20:00 → 1200) — see the
 * migration for why we use local wall-clock minutes rather than a timestamptz.
 */
export interface DayOption {
  value: number;
  label: string;
}

const DAY_OPTIONS: DayOption[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

/** The bar venue categories the host can toggle on/off. "bar" is the default. */
const VENUE_TYPE_OPTIONS = [
  { value: "bar", label: "Bars & pubs" },
  { value: "nightclub", label: "Nightclubs" },
  { value: "cafe", label: "Cafés" },
  { value: "restaurant", label: "Restaurants" },
  { value: "hotel", label: "Hotel bars" },
] as const;

/** "20:00" → 1200 (minutes since midnight); invalid → null. */
function timeToMinutes(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 1200 → "20:00"; null/undefined → "". */
function minutesToTime(mins: number | null | undefined): string {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function useSchedule() {
  return { DAY_OPTIONS, VENUE_TYPE_OPTIONS, timeToMinutes, minutesToTime };
}
