// ── Hunt ──────────────────────────────────────────────────
export interface Hunt {
  id: string;
  name: string;
  hunterCode: string;
  chickenCode: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  budget: number | null;
  status: "preparing" | "active" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  creatorId: string;
  createdAt: string;
  teams?: Team[];
}

/** Hunt with the current user's role and summary stats (used in dashboard list) */
export interface HuntWithRole extends Hunt {
  role: string;
  teamCount: number;
  memberCount: number;
  barCount: number;
  budget: number | null;
}

// ── Team ─────────────────────────────────────────────────
export interface Team {
  id: string;
  huntId: string;
  name: string;
  renamed: boolean;
  isChicken: boolean;
  displayOrder: number;
  joinCode?: string;
  selectedBarId?: string | null;
  createdAt: string;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  name: string;
  email?: string;
  createdAt: string;
}

/** Used when creating/editing a hunt (input from host) */
export interface TeamInput {
  name: string;
  members: TeamMemberInput[];
  isChicken?: boolean;
}

export interface TeamMemberInput {
  name: string;
}

// ── Chicken (pre-registered prey player) ────────────────
export interface HuntChicken {
  id: string;
  huntId: string;
  name: string;
  email: string;
  createdAt: string;
}

/** Used when creating/editing a hunt (input from host) */
export interface ChickenInput {
  name: string;
  email: string;
}

// ── Bar ──────────────────────────────────────────────────
export interface HuntBar {
  id: string;
  placeId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingsTotal: number | null;
  priceLevel: number | null;
  status: string | null;
  mapsUrl: string;
  category: string;
  checkStatus: "unchecked" | "checked" | "not_checking";
  checkedBy: string | null;
  checkedAt: string | null;
  source?: string;
  edited?: boolean;
}

// ── Hint ─────────────────────────────────────────────────
export interface Hint {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  imagePath?: string | null;
}

// ── Participant ──────────────────────────────────────────
export interface Participant {
  userId: string;
  role: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt?: string;
  teamId?: string;
  teamName?: string;
}

// ── Auth ─────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  isGuest?: boolean;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

/**
 * The hunt a player is currently in. We stash this in their saved session so
 * the home screen can offer a one-tap "jump back in" shortcut after they close
 * the app or hit the mobile Back button — no need to re-enter a join code.
 * (Issue #1.)
 */
export interface ActiveHunt {
  /** The hunt to return to. */
  huntId: string;
  /** "chicken" routes to /chicken/[id]; anything else to /hunt/[id]. */
  role: string;
  /** Hunt name, shown on the resume banner. */
  huntName: string;
  /** The name the player joined as (friendly label on the banner). */
  playerName?: string;
}

// ── Expense (chicken budget tracking) ────────────────────
export interface HuntExpense {
  id: string;
  huntId: string;
  amount: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

// ── Arrival (team found the chickens) ────────────────────
export interface HuntArrival {
  id: string;
  huntId: string;
  teamId: string;
  teamName: string;
  arrivedAt: string;
  note: string;
  imagePath?: string | null;
}

// ── Check-in (team visited a bar) ───────────────────────
export interface HuntCheckIn {
  id: string;
  huntId: string;
  barId: string;
  teamId: string | null;
  withTeams: { id: string; name: string }[];
  userId: string;
  note: string;
  imagePath?: string | null;
  createdAt: string;
}
