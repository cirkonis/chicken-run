<template>
  <div>
    <!-- Empty state -->
    <div v-if="checkIns.length === 0" class="text-center py-12 text-text-muted">
      <p class="text-3xl mb-2">📸</p>
      <p class="text-sm m-0">No check-ins yet. The feed will update as teams visit bars.</p>
    </div>

    <!-- Feed list -->
    <div v-else class="flex flex-col gap-3">
      <!-- Chaos mode banner -->
      <div
        v-if="chaosMode"
        class="px-4 py-3 bg-red/5 border-2 border-red/20 rounded-xl text-xs text-text-muted text-center leading-relaxed"
      >
        The chickens have been found! In their panic they shook the feed cage — everything's been scrambled and some info seems to have gone missing...
      </div>

      <!-- Feed items -->
      <div
        v-for="ci in displayCheckIns"
        :key="ci.id"
        class="bg-surface border-2 rounded-2xl overflow-hidden"
        :class="isRedacted(ci) ? 'border-red/20 opacity-80' : 'border-border'"
      >
        <!-- Header: team name -->
        <div class="px-4 pt-3 pb-1">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm font-bold truncate">{{ getTeamName(ci.teamId) }}</span>
            <span class="text-[11px] text-text-muted whitespace-nowrap">checked in</span>
            <span
              v-if="isRedacted(ci)"
              class="ml-auto text-[10px] font-bold uppercase tracking-wider text-red/60 bg-red/10 px-2 py-0.5 rounded"
            >redacted</span>
          </div>
        </div>

        <!-- Bar name -->
        <div class="px-4 pb-2">
          <span v-if="isRedacted(ci)" class="text-xs text-text-muted/60 font-mono">📍 {{ scrambleText(getBarName(ci.barId), ci.id) }}</span>
          <span v-else class="text-xs text-text-muted">📍 {{ getBarName(ci.barId) }}</span>
        </div>

        <!-- Photo -->
        <div v-if="ci.imageUrl" class="px-3 pb-2">
          <!-- Normal photo -->
          <img
            v-if="!isRedacted(ci)"
            :src="ci.imageUrl"
            alt="Check-in photo"
            class="w-full rounded-xl object-cover max-h-[360px] cursor-pointer"
            loading="lazy"
            @click="fullImageUrl = ci.imageUrl!"
          />
          <!-- Redacted photo (blurred) -->
          <div v-else class="relative overflow-hidden rounded-xl">
            <img
              :src="ci.imageUrl"
              alt="Redacted photo"
              class="w-full rounded-xl object-cover max-h-[360px]"
              loading="lazy"
              style="filter: blur(20px) saturate(0.3); transform: scale(1.1)"
            />
          </div>
        </div>

        <!-- Note + with team (normal) -->
        <div v-if="!isRedacted(ci) && (ci.note || ci.withTeamName)" class="px-4 pb-3 flex flex-col gap-1.5">
          <p v-if="ci.note" class="text-sm m-0 leading-relaxed">{{ ci.note }}</p>
          <span
            v-if="ci.withTeamName"
            class="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-md w-fit"
          >⚔️ Ran into {{ ci.withTeamName }}!</span>
        </div>

        <!-- Note (redacted) -->
        <div v-else-if="isRedacted(ci) && ci.note" class="px-4 pb-3">
          <p class="text-sm m-0 leading-relaxed font-mono text-text-muted/50">{{ scrambleText(ci.note, ci.id + 'note') }}</p>
        </div>
      </div>
    </div>

    <!-- Fullscreen image viewer -->
    <Teleport to="body">
      <div
        v-if="fullImageUrl"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] cursor-pointer p-4"
        @click="fullImageUrl = null"
      >
        <img :src="fullImageUrl" class="max-w-full max-h-full object-contain rounded-lg" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { HuntCheckIn, HuntBar, Team, HuntArrival } from "~/types";

const props = defineProps<{
  checkIns: HuntCheckIn[];
  bars: HuntBar[];
  teams: Team[];
  arrivals: HuntArrival[];
}>();

const fullImageUrl = ref<string | null>(null);

// ── Chaos mode (triggered by team arrivals) ────────────
const chaosMode = computed(() => props.arrivals.length > 0);
const arrivedTeamIds = computed(() => new Set(props.arrivals.map((a) => a.teamId)));

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffled base when chaos triggers
const shuffledBase = ref<HuntCheckIn[]>([]);
const baseCheckInIds = ref<Set<string>>(new Set());
let lastArrivalCount = 0;

// Each new arrival re-shuffles the entire feed
watch(
  () => props.arrivals.length,
  (count) => {
    if (count > 0 && count !== lastArrivalCount) {
      lastArrivalCount = count;
      shuffledBase.value = shuffle([...props.checkIns]);
      baseCheckInIds.value = new Set(props.checkIns.map((ci) => ci.id));
    }
  },
  { immediate: true }
);

// Build the display list
const displayCheckIns = computed(() => {
  if (!chaosMode.value) {
    // Normal mode: reverse chronological
    return [...props.checkIns].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Chaos mode:
  // 1. New check-ins (added AFTER last shuffle) → reverse chrono on top
  // 2. Shuffled base (maintain randomized order)
  const currentMap = new Map(props.checkIns.map((ci) => [ci.id, ci]));

  const newOnes = props.checkIns
    .filter((ci) => !baseCheckInIds.value.has(ci.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const existingBase = shuffledBase.value
    .filter((ci) => currentMap.has(ci.id))
    .map((ci) => currentMap.get(ci.id)!);

  return [...newOnes, ...existingBase];
});

// ── Redaction ──────────────────────────────────────────
function isRedacted(ci: HuntCheckIn): boolean {
  return ci.teamId != null && arrivedTeamIds.value.has(ci.teamId);
}

/** Deterministic text scrambler seeded by check-in ID */
function scrambleText(text: string, seed: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";
  // Simple hash from seed
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return text
    .split("")
    .map((c) => {
      if (c === " ") return " ";
      // LCG step for deterministic pseudo-random
      h = (h * 1103515245 + 12345) | 0;
      return chars[Math.abs(h) % chars.length];
    })
    .join("");
}

// ── Lookup helpers ─────────────────────────────────────
const barMap = computed(() => {
  const m = new Map<string, string>();
  for (const b of props.bars) m.set(b.id, b.name);
  return m;
});

const teamMap = computed(() => {
  const m = new Map<string, string>();
  for (const t of props.teams) m.set(t.id, t.name);
  return m;
});

function getBarName(barId: string): string {
  return barMap.value.get(barId) || "Unknown bar";
}

function getTeamName(teamId: string | null): string {
  if (!teamId) return "Unknown";
  return teamMap.value.get(teamId) || "Unknown team";
}
</script>
