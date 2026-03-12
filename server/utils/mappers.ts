/**
 * Snake_case DB rows → camelCase API responses.
 * Nuxt auto-imports everything from server/utils/, so these
 * are available in all server API handlers without importing.
 */

import type { Hunt, HuntWithRole, HuntBar, Hint, Participant, Team, TeamMember, HuntChicken, HuntExpense, HuntArrival, HuntCheckIn } from "~/types";

export function mapHunt(row: Record<string, any>): Hunt {
  return {
    id: row.id,
    name: row.name,
    hunterCode: row.hunter_code,
    chickenCode: row.chicken_code,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    radiusMeters: row.radius_meters,
    budget: row.budget ?? null,
    status: row.status,
    startedAt: row.started_at ?? null,
    creatorId: row.creator_id,
    createdAt: row.created_at,
  };
}

export function mapHuntWithRole(
  row: Record<string, any>,
  role: string,
  stats?: { teamCount?: number; memberCount?: number; barCount?: number; budget?: number | null }
): HuntWithRole {
  return {
    ...mapHunt(row),
    role,
    teamCount: stats?.teamCount ?? 0,
    memberCount: stats?.memberCount ?? 0,
    barCount: stats?.barCount ?? 0,
    budget: stats?.budget ?? null,
  };
}

export function mapBar(row: Record<string, any>): HuntBar {
  return {
    id: row.id,
    placeId: row.place_id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    rating: row.rating,
    ratingsTotal: row.ratings_total,
    priceLevel: row.price_level,
    status: row.business_status,
    mapsUrl: row.maps_url,
    category: row.category,
    checkStatus: row.check_status ?? "unchecked",
    checkedBy: row.checked_by,
    checkedAt: row.checked_at,
  };
}

export function mapHint(row: Record<string, any>): Hint & { imagePath?: string | null } {
  return {
    id: row.id,
    text: row.text,
    authorId: row.author_id,
    authorName: row.profiles?.display_name || "The Chickens 🐔",
    createdAt: row.created_at,
    imagePath: row.image_path || null,
  };
}

export function mapParticipant(row: Record<string, any>): Participant {
  return {
    userId: row.user_id,
    role: row.role,
    displayName: row.profiles?.display_name || "Unknown",
    avatarUrl: row.profiles?.avatar_url,
    joinedAt: row.joined_at,
    teamId: row.team_id ?? undefined,
    teamName: row.hunt_teams?.name ?? undefined,
  };
}

export function mapTeam(row: Record<string, any>): Team {
  return {
    id: row.id,
    huntId: row.hunt_id,
    name: row.name,
    renamed: row.renamed,
    isChicken: row.is_chicken ?? false,
    displayOrder: row.display_order,
    joinCode: row.join_code,
    createdAt: row.created_at,
    members: row.hunt_team_members?.map(mapTeamMember),
  };
}

export function mapTeamMember(row: Record<string, any>): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    email: row.email ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapChicken(row: Record<string, any>): HuntChicken {
  return {
    id: row.id,
    huntId: row.hunt_id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export function mapExpense(row: Record<string, any>): HuntExpense {
  return {
    id: row.id,
    huntId: row.hunt_id,
    amount: row.amount,
    note: row.note || "",
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapArrival(row: Record<string, any>): HuntArrival & { imagePath?: string | null } {
  return {
    id: row.id,
    huntId: row.hunt_id,
    teamId: row.team_id,
    teamName: row.hunt_teams?.name || "Unknown",
    arrivedAt: row.arrived_at,
    note: row.note || "",
    imagePath: row.image_path || null,
  };
}

export function mapCheckIn(row: Record<string, any>): HuntCheckIn & { imagePath?: string | null } {
  return {
    id: row.id,
    huntId: row.hunt_id,
    barId: row.bar_id,
    teamId: row.team_id ?? null,
    withTeamId: row.with_team_id ?? null,
    withTeamName: row.with_team?.name ?? null,
    userId: row.user_id,
    note: row.note || "",
    imagePath: row.image_path || null,
    createdAt: row.created_at,
  };
}
