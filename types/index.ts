// ── Hunt ──────────────────────────────────────────────────
export interface Hunt {
  id: string;
  name: string;
  hunterCode: string;
  chickenCode: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  status: "active" | "completed" | "archived";
  creatorId: string;
  createdAt: string;
  teams?: Team[];
}

/** Hunt with the current user's role (used in dashboard list) */
export interface HuntWithRole extends Hunt {
  role: string;
}

// ── Team ─────────────────────────────────────────────────
export interface Team {
  id: string;
  huntId: string;
  name: string;
  renamed: boolean;
  displayOrder: number;
  createdAt: string;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  name: string;
  email: string;
  createdAt: string;
}

/** Used when creating/editing a hunt (input from host) */
export interface TeamInput {
  name: string;
  members: TeamMemberInput[];
}

export interface TeamMemberInput {
  name: string;
  email: string;
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
  placeId: string;
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
}

// ── Hint ─────────────────────────────────────────────────
export interface Hint {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
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
