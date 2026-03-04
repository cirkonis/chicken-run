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
}

/** Hunt with the current user's role (used in dashboard list) */
export interface HuntWithRole extends Hunt {
  role: string;
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
