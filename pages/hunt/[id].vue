<template>
  <div class="max-w-7xl mx-auto p-4">
    <!-- Loading -->
    <LoadingSpinner v-if="pageLoading" message="Loading hunt..." />

    <!-- Error state -->
    <div v-else-if="error && !hunt" class="text-center py-16 text-text-muted">
      <p class="text-4xl mb-4">🐔</p>
      <p class="text-lg font-semibold text-red mb-2">Failed to load hunt</p>
      <p class="text-sm mb-4">{{ error }}</p>
      <button
        class="px-6 py-2.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-semibold text-sm transition-colors hover:bg-accent-dark"
        @click="goBack"
      >Go back</button>
    </div>

    <template v-else-if="hunt">
      <header class="mb-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex flex-col gap-1">
            <button class="bg-transparent border-none text-accent font-semibold text-[13px] cursor-pointer p-0 mb-1 hover:underline" @click="goBack" title="Back">← Back</button>
            <h1 class="m-0 text-2xl text-accent-dark">🐔 {{ hunt.name }}</h1>
            <span class="text-sm text-text-muted italic">
              Playing as <strong>{{ auth.state.user?.displayName || 'Unknown' }}</strong>
              <template v-if="myTeam"> · Team: <strong>{{ myTeam.name }}</strong></template>
              <template v-if="participants.length > 1"> · {{ participants.length }} hunters</template>
            </span>
          </div>
          <div v-if="isCreator" class="bg-surface border-2 border-border rounded-[10px] px-3 py-1.5 text-center">
            <span class="block text-[10px] text-text-muted uppercase tracking-wide">Hunter Code</span>
            <span class="font-bold text-base tracking-widest text-accent-dark">{{ hunt.hunterCode }}</span>
          </div>
        </div>

        <!-- Team rename banner (one-time, for team members) -->
        <div
          v-if="myTeam && !myTeam.renamed && !isCreator"
          class="flex items-center gap-2 px-4 py-3 bg-[#fff8e1] border-2 border-chicken-yellow rounded-xl mb-3"
        >
          <template v-if="!renaming">
            <span class="text-sm flex-1">
              🏷️ Your team is <strong>{{ myTeam.name }}</strong> — want to pick a name?
            </span>
            <button
              class="px-3 py-1.5 border-2 border-accent rounded-lg bg-transparent text-accent text-xs font-semibold cursor-pointer transition-all hover:bg-accent hover:text-white"
              @click="renaming = true"
            >Rename</button>
          </template>
          <template v-else>
            <input
              v-model="newTeamName"
              type="text"
              placeholder="New team name"
              class="flex-1 px-3 py-2 border-2 border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-accent"
              maxlength="40"
              @keyup.enter="doRenameTeam"
            />
            <button
              class="px-3 py-1.5 border-2 border-accent rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer transition-all hover:bg-accent-dark disabled:opacity-60"
              :disabled="renamingLoading || !newTeamName.trim()"
              @click="doRenameTeam"
            >{{ renamingLoading ? '...' : 'Save' }}</button>
            <button
              class="px-3 py-1.5 border-2 border-border rounded-lg bg-surface text-text-muted text-xs cursor-pointer hover:border-accent"
              @click="renaming = false"
            >Cancel</button>
          </template>
        </div>

        <div class="flex flex-wrap gap-2.5 items-center" v-if="bars.length || participants.length > 1">
          <span class="text-sm text-text-muted" v-if="bars.length">
            <b>{{ bars.length }}</b> bars in the zone
          </span>

          <span class="text-sm text-text-muted font-semibold" v-if="participants.length > 1">
            {{ participants.length }} hunters
          </span>
        </div>
      </header>

      <main>
        <!-- Map -->
        <section class="mb-4">
          <div class="flex gap-2 mb-2.5">
            <button class="flex items-center gap-1.5 px-4 py-2 border-2 border-border rounded-xl cursor-pointer bg-surface text-sm font-semibold transition-all hover:border-accent hover:text-accent" @click="mapOpen = !mapOpen">
              {{ mapOpen ? "Hide map" : "Show map" }}
            </button>
          </div>
          <div v-show="mapOpen" class="max-w-[800px]">
            <div ref="mapEl" class="h-[420px] w-full rounded-2xl overflow-hidden border-2 border-border max-[900px]:h-[300px]"></div>
            <div class="flex gap-4 mt-2 px-3 py-2 bg-surface rounded-[10px] border border-border text-xs items-center">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red"></span> Not visited</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-green"></span> Visited</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-gray"></span> Skipping</span>
              <span class="flex-1"></span>
              <button
                class="flex items-center gap-1 px-2.5 py-1 border-2 rounded-lg cursor-pointer text-xs font-semibold transition-all"
                :class="locationActive ? 'border-blue bg-blue/10 text-blue' : 'border-border bg-surface text-text-muted hover:border-accent hover:text-accent'"
                @click="toggleUserLocation"
                title="Show my location"
              >📍 {{ locationActive ? 'Tracking' : 'My location' }}</button>
            </div>
          </div>
        </section>

        <section>
          <!-- Hints -->
          <HintBox
            :hints="hints"
            :show-when-empty="bars.length > 0"
          />

          <!-- Toolbar -->
          <div class="flex gap-2 items-center mb-2.5" v-if="bars.length">
            <input v-model="filter" placeholder="Search bars..." class="flex-1 px-2.5 py-2 border-2 border-border rounded-[10px] text-sm bg-surface focus:outline-none focus:border-accent" />
            <select v-model="statusFilter" class="px-2.5 py-2 border-2 border-border rounded-[10px] bg-surface text-[13px]">
              <option value="all">All</option>
              <option value="unchecked">Unchecked</option>
              <option value="checked">Visited</option>
              <option value="not_checking">Skipping</option>
            </select>
          </div>

          <!-- Stats -->
          <StatsGrid :counts="statusCounts" />

          <div v-if="error" class="p-3 border-2 border-red bg-[#fef0ef] rounded-xl text-sm">{{ error }}</div>

          <!-- Empty state -->
          <div v-if="!bars.length" class="py-8 px-5 border-2 border-dashed border-border rounded-2xl text-center text-text-muted">
            <p class="my-1 text-lg">🐔 The chickens are hiding somewhere...</p>
            <p class="my-1">Waiting for the host to set up the bar list.</p>
          </div>

          <!-- Bar list -->
          <ul v-else-if="bars.length" class="list-none p-0 m-0 grid gap-2">
            <BarListItem
              v-for="b in filteredBars"
              :key="b.id"
              :bar="b"
              :selected="b.id === selectedBarId"
              @toggle="toggleStatus"
              @select="onBarSelect"
            />
          </ul>
        </section>
      </main>

      <footer class="text-center py-5 text-[13px] text-text-muted border-t border-border mt-6">
        <p class="m-0">🐔 Don't be a chicken — check every bar. Or at least the ones that look fun.</p>
      </footer>
    </template>

  </div>
</template>

<script setup lang="ts">
import type { HuntBar } from "~/types";

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const huntId = route.params.id as string;

// ── Composables ──────────────────────────────────────────
const {
  pageLoading, error,
  hunt, bars, hints, participants, teams,
  filter, statusFilter,
  isCreator, myTeam, statusCounts, filteredBars,
  loadHunt, toggleStatus, renameTeam,
  setOnMarkersChanged, startPolling, stopPolling,
} = useHunt(huntId);

const {
  initMap, paintMarkers, invalidateSize, cleanup,
  highlightBar, clearHighlight, getHighlightedId,
  setOnMarkerClick,
  startUserLocation, stopUserLocation,
} = useMap();

// Wire map repaint into hunt actions (uses filtered list so map matches the bar list)
setOnMarkersChanged(() => paintMarkers(filteredBars.value));

// ── Map toggle ───────────────────────────────────────────
const mapEl = ref<HTMLDivElement | null>(null);
const mapOpen = ref(true);

watch(mapOpen, (open) => {
  if (open) nextTick(() => invalidateSize());
});

// Repaint markers when filters change
watch(filteredBars, () => paintMarkers(filteredBars.value));

// ── Bar selection / highlight ────────────────────────────
const selectedBarId = ref<string | null>(null);

// When a map marker is clicked → highlight in list + scroll to it
setOnMarkerClick((barId: string) => {
  if (selectedBarId.value === barId) {
    selectedBarId.value = null;
    clearHighlight();
  } else {
    selectedBarId.value = barId;
    highlightBar(barId);
    scrollToBar(barId);
  }
});

/** Called when a BarListItem is clicked. */
function onBarSelect(bar: HuntBar) {
  if (selectedBarId.value === bar.id) {
    // Deselect
    selectedBarId.value = null;
    clearHighlight();
  } else {
    selectedBarId.value = bar.id;

    // Open map if it's closed
    if (!mapOpen.value) {
      mapOpen.value = true;
      nextTick(() => {
        invalidateSize();
        highlightBar(bar.id);
      });
    } else {
      highlightBar(bar.id);
    }
  }
}

/** Scroll the bar list item with the given id into view. */
function scrollToBar(barId: string) {
  nextTick(() => {
    const el = document.querySelector(`[data-bar-id="${barId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

// ── User location ────────────────────────────────────────
const locationActive = ref(false);

function toggleUserLocation() {
  if (locationActive.value) {
    stopUserLocation();
    locationActive.value = false;
  } else {
    const started = startUserLocation();
    locationActive.value = started;
  }
}

// ── Team rename ──────────────────────────────────────────
const renaming = ref(false);
const newTeamName = ref("");
const renamingLoading = ref(false);

async function doRenameTeam() {
  if (!myTeam.value || !newTeamName.value.trim()) return;
  renamingLoading.value = true;
  try {
    await renameTeam(myTeam.value.id, newTeamName.value.trim());
    renaming.value = false;
    newTeamName.value = "";
  } catch {
    // error handled by composable
  } finally {
    renamingLoading.value = false;
  }
}

// ── Navigation ───────────────────────────────────────────
function goBack() {
  if (auth.isHost.value) {
    router.push("/dashboard");
  } else {
    auth.logout();
  }
}

// ── Lifecycle ────────────────────────────────────────────
onMounted(async () => {
  auth.restore();

  if (!auth.state.user) {
    router.push("/");
    return;
  }

  await loadHunt();

  // Init map once the template is rendered (pageLoading is now false)
  await nextTick();
  if (hunt.value && mapEl.value) {
    initMap(
      mapEl.value,
      { lat: hunt.value.centerLat, lng: hunt.value.centerLng },
      hunt.value.radiusMeters
    );
    paintMarkers(filteredBars.value);
  }

  startPolling();
});

onUnmounted(() => {
  stopPolling();
  cleanup();
});
</script>

<style>
/* User location blue pulsing dot */
.user-location-icon {
  background: none !important;
  border: none !important;
}
.user-location-dot {
  position: relative;
  width: 24px;
  height: 24px;
}
.user-location-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: #4285f4;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0,0,0,.3);
  z-index: 2;
}
.user-location-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background: rgba(66, 133, 244, 0.25);
  border-radius: 50%;
  z-index: 1;
  animation: location-pulse 2s ease-out infinite;
}
@keyframes location-pulse {
  0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
}
</style>
