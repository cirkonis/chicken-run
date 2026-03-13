<template>
  <div>
    <!-- Empty state -->
    <div v-if="timeline.length === 0" class="text-center py-12 text-text-muted">
      <p class="text-3xl mb-2">📖</p>
      <p class="text-sm m-0">No events were recorded during this hunt.</p>
    </div>

    <!-- Timeline -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="item in timeline"
        :key="item.key"
        class="bg-surface border-2 rounded-2xl overflow-hidden"
        :class="item.type === 'arrival' ? 'border-chicken-yellow/60' : item.type === 'hint' ? 'border-accent/30' : 'border-border'"
      >
        <!-- Header -->
        <div class="px-4 pt-3 pb-1 flex items-center gap-2">
          <!-- Type badge -->
          <span
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            :class="badgeClass(item.type)"
          >{{ badgeLabel(item.type) }}</span>
          <!-- Timestamp -->
          <span class="ml-auto text-[11px] text-text-muted">{{ formatTime(item.timestamp) }}</span>
          <span class="text-[11px] text-accent font-semibold">{{ minutesInto(item.timestamp) }}</span>
        </div>

        <!-- Check-in content -->
        <template v-if="item.type === 'checkin'">
          <div class="px-4 pb-1">
            <span class="text-sm font-bold">{{ getTeamName(item.data.teamId) }}</span>
            <span class="text-[11px] text-text-muted ml-1">checked in</span>
          </div>
          <div class="px-4 pb-2">
            <span class="text-xs text-text-muted">📍 {{ getBarName(item.data.barId) }}</span>
          </div>
        </template>

        <!-- Arrival content -->
        <template v-else-if="item.type === 'arrival'">
          <div class="px-4 pb-2">
            <span class="text-sm font-bold">{{ item.data.teamName }}</span>
            <span class="text-[11px] text-text-muted ml-1">found the chickens!</span>
          </div>
        </template>

        <!-- Hint content -->
        <template v-else-if="item.type === 'hint'">
          <div class="px-4 pb-2">
            <span class="text-xs text-text-muted">From {{ item.data.authorName }}</span>
          </div>
        </template>

        <!-- Photo -->
        <div v-if="getImageUrl(item)" class="px-3 pb-2 relative group">
          <img
            v-if="!failedImages.has(item.key)"
            :src="getImageUrl(item)!"
            alt="Photo"
            class="w-full rounded-xl object-cover max-h-[360px] cursor-pointer"
            loading="lazy"
            @click="fullImageUrl = getImageUrl(item)!"
            @error="onImageError(item.key)"
          />
          <div
            v-else
            class="w-full h-[120px] rounded-xl bg-bg border-2 border-dashed border-border flex items-center justify-center text-text-muted text-xs"
          >Photo unavailable — try refreshing</div>
          <!-- Save button -->
          <button
            v-if="!failedImages.has(item.key)"
            type="button"
            class="absolute bottom-4 right-5 w-9 h-9 flex items-center justify-center bg-black/50 text-white rounded-full border-0 cursor-pointer backdrop-blur-sm transition-opacity"
            style="opacity: 0.85"
            title="Download photo"
            @click.stop="downloadImage(getImageUrl(item)!, `hunt-${item.type}-${item.key}.jpg`)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>

        <!-- Note text -->
        <div v-if="getNote(item)" class="px-4 pb-3">
          <p class="text-sm m-0 leading-relaxed">{{ getNote(item) }}</p>
        </div>

        <!-- Ran into -->
        <div v-if="item.type === 'checkin' && item.data.withTeamName" class="px-4 pb-3">
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-md">
            ⚔️ Ran into {{ item.data.withTeamName }}!
          </span>
        </div>
      </div>
    </div>

    <!-- Fullscreen image viewer -->
    <Teleport to="body">
      <div
        v-if="fullImageUrl"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
        @click="fullImageUrl = null"
      >
        <img :src="fullImageUrl" class="max-w-full max-h-full object-contain rounded-lg" />
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <button
            type="button"
            class="w-12 h-12 flex items-center justify-center bg-white text-accent-dark rounded-full border-0 cursor-pointer shadow-lg"
            @click.stop="downloadImage(fullImageUrl!, 'hunt-photo.jpg'); fullImageUrl = null"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <span class="text-white/50 text-[11px]">Long-press photo to save to camera roll</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Hunt, HuntBar, HuntCheckIn, HuntArrival, Hint, Team } from "~/types";

type TimelineItem =
  | { type: "checkin"; data: HuntCheckIn; timestamp: number; key: string }
  | { type: "arrival"; data: HuntArrival; timestamp: number; key: string }
  | { type: "hint"; data: Hint; timestamp: number; key: string };

const props = defineProps<{
  hunt: Hunt;
  bars: HuntBar[];
  checkIns: HuntCheckIn[];
  arrivals: HuntArrival[];
  hints: Hint[];
  teams: Team[];
}>();

const fullImageUrl = ref<string | null>(null);
const failedImages = ref(new Set<string>());

function onImageError(key: string) {
  failedImages.value = new Set([...failedImages.value, key]);
}

// ── Timeline ──────────────────────────────────────────

const timeline = computed<TimelineItem[]>(() => {
  const items: TimelineItem[] = [];

  for (const ci of props.checkIns) {
    items.push({
      type: "checkin",
      data: ci,
      timestamp: new Date(ci.createdAt).getTime(),
      key: `ci-${ci.id}`,
    });
  }
  for (const a of props.arrivals) {
    items.push({
      type: "arrival",
      data: a,
      timestamp: new Date(a.arrivedAt).getTime(),
      key: `ar-${a.id}`,
    });
  }
  for (const h of props.hints) {
    items.push({
      type: "hint",
      data: h,
      timestamp: new Date(h.createdAt).getTime(),
      key: `hi-${h.id}`,
    });
  }

  // Reverse chronological
  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
});

// ── Lookup helpers ────────────────────────────────────

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

function getImageUrl(item: TimelineItem): string | null {
  if (item.type === "checkin") return item.data.imageUrl || null;
  if (item.type === "arrival") return item.data.imageUrl || null;
  if (item.type === "hint") return item.data.imageUrl || null;
  return null;
}

function getNote(item: TimelineItem): string {
  if (item.type === "checkin") return item.data.note;
  if (item.type === "arrival") return item.data.note;
  if (item.type === "hint") return item.data.text !== "(photo)" ? item.data.text : "";
  return "";
}

// ── Badge styling ─────────────────────────────────────

function badgeClass(type: string): string {
  if (type === "checkin") return "text-green bg-green/10";
  if (type === "arrival") return "text-[#b8860b] bg-chicken-yellow/20";
  if (type === "hint") return "text-accent bg-accent/10";
  return "";
}

function badgeLabel(type: string): string {
  if (type === "checkin") return "Check-in";
  if (type === "arrival") return "Arrival";
  if (type === "hint") return "Hint";
  return "";
}

// ── Time formatting ───────────────────────────────────

const startTime = computed(() =>
  props.hunt.startedAt ? new Date(props.hunt.startedAt).getTime() : 0
);

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function minutesInto(ts: number): string {
  if (!startTime.value) return "";
  const diff = ts - startTime.value;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "start";
  if (mins < 60) return `${mins}m in`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m in`;
}

// ── Image download ────────────────────────────────────

async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}
</script>
