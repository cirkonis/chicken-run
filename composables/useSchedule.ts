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

// The bar venue categories the host can toggle on/off. The real drinking spots
// (bar/pub/taproom/biergarten) are ON by default; the rest are relevant-ish and
// OFF by default. Each maps to a Geoapify category server-side (geoapify.ts).
const VENUE_TYPE_OPTIONS = [
  { value: "bar", label: "Bars", default: true },
  { value: "pub", label: "Pubs", default: true },
  { value: "taproom", label: "Taprooms", default: true },
  { value: "biergarten", label: "Beer gardens", default: true },
  { value: "nightclub", label: "Nightclubs", default: false },
  { value: "brewery", label: "Breweries", default: false },
  { value: "cafe", label: "Cafés", default: false },
  { value: "restaurant", label: "Restaurants", default: false },
] as const;

/** The venue types enabled by default (bar/pub/taproom/biergarten). */
const DEFAULT_VENUE_TYPES: string[] = VENUE_TYPE_OPTIONS.filter((o) => o.default).map((o) => o.value);

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
  return { DAY_OPTIONS, VENUE_TYPE_OPTIONS, DEFAULT_VENUE_TYPES, timeToMinutes, minutesToTime };
}
