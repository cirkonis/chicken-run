/**
 * Snake_case DB rows → camelCase API responses.
 * Nuxt auto-imports everything from server/utils/, so these
 * are available in all server API handlers without importing.
 */

import type { Hunt, HuntWithRole, HuntBar, Hint, Participant } from "~/types";

export function mapHunt(row: Record<string, any>): Hunt {
  return {
    id: row.id,
    name: row.name,
    hunterCode: row.hunter_code,
    chickenCode: row.chicken_code,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    radiusMeters: row.radius_meters,
    status: row.status,
    creatorId: row.creator_id,
    createdAt: row.created_at,
  };
}

export function mapHuntWithRole(
  row: Record<string, any>,
  role: string
): HuntWithRole {
  return { ...mapHunt(row), role };
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

export function mapHint(row: Record<string, any>): Hint {
  return {
    id: row.id,
    text: row.text,
    authorId: row.author_id,
    authorName: row.profiles?.display_name || "Unknown",
    createdAt: row.created_at,
  };
}

export function mapParticipant(row: Record<string, any>): Participant {
  return {
    userId: row.user_id,
    role: row.role,
    displayName: row.profiles?.display_name || "Unknown",
    avatarUrl: row.profiles?.avatar_url,
    joinedAt: row.joined_at,
  };
}
