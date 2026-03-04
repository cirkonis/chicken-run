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
              <template v-if="participants.length > 1"> · {{ participants.length }} hunters</template>
            </span>
          </div>
          <div class="flex items-start gap-2.5">
            <div v-if="isCreator">
              <div class="bg-surface border-2 border-border rounded-[10px] px-3 py-1.5 text-center">
                <span class="block text-[10px] text-text-muted uppercase tracking-wide">Hunter Code</span>
                <span class="font-bold text-base tracking-widest text-accent-dark">{{ hunt.hunterCode }}</span>
              </div>
            </div>
            <button class="w-9 h-9 border-2 border-border rounded-full bg-surface cursor-pointer text-lg flex items-center justify-center transition-all shrink-0 hover:border-accent hover:scale-105" @click="showWelcomeModal = true" title="Show instructions">i</button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2.5 items-center">
          <button
            class="px-4 py-2 border-0 rounded-xl cursor-pointer bg-accent text-white font-semibold text-sm transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="searching"
            @click="searchBars"
          >
            {{ searching ? "Searching the coop..." : bars.length ? "Re-search bars" : "Hunt bars" }}
          </button>

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
            <div class="flex gap-4 mt-2 px-3 py-2 bg-surface rounded-[10px] border border-border text-xs">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red"></span> Not visited</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-green"></span> Visited</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-gray"></span> Skipping</span>
            </div>
          </div>
        </section>

        <section>
          <!-- Hints -->
          <HintBox
            :hints="hints"
            :show-when-empty="bars.length > 0"
            @add-hint="addHint"
          />

          <!-- Toolbar -->
          <div class="flex gap-2 items-center mb-2.5" v-if="bars.length">
            <input v-model="filter" placeholder="Filter bars..." class="flex-1 px-2.5 py-2 border-2 border-border rounded-[10px] text-sm bg-surface focus:outline-none focus:border-accent" />
            <select v-model="statusFilter" class="px-2.5 py-2 border-2 border-border rounded-[10px] bg-surface text-[13px]">
              <option value="all">All</option>
              <option value="unchecked">Unchecked</option>
              <option value="checked">Visited</option>
              <option value="not_checking">Skipping</option>
            </select>
            <button class="px-3 py-1.5 border-2 border-border rounded-[10px] cursor-pointer bg-surface text-xs font-semibold transition-all hover:border-accent hover:text-accent" @click="refreshHunt" :disabled="syncing">
              {{ syncing ? "Refreshing..." : "Refresh" }}
            </button>
          </div>

          <!-- Stats -->
          <StatsGrid :counts="statusCounts" />

          <div v-if="error" class="p-3 border-2 border-red bg-[#fef0ef] rounded-xl text-sm">{{ error }}</div>

          <!-- Empty state -->
          <div v-if="!bars.length && !searching" class="py-8 px-5 border-2 border-dashed border-border rounded-2xl text-center text-text-muted">
            <p class="my-1 text-lg">🐔 The chickens are hiding somewhere...</p>
            <p class="my-1">Hit "Hunt bars" to search for bars around this hunt's location.</p>
          </div>

          <!-- Bar list -->
          <ul v-else-if="bars.length" class="list-none p-0 m-0 grid gap-2">
            <BarListItem
              v-for="b in filteredBars"
              :key="b.id"
              :bar="b"
              @toggle="toggleStatus"
            />
          </ul>
        </section>
      </main>

      <footer class="text-center py-5 text-[13px] text-text-muted border-t border-border mt-6">
        <p class="m-0">🐔 Don't be a chicken — check every bar. Or at least the ones that look fun.</p>
      </footer>
    </template>

    <!-- Welcome modal -->
    <WelcomeModal v-model="showWelcomeModal" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const huntId = route.params.id as string;

// ── Composables ──────────────────────────────────────────
const {
  pageLoading, searching, syncing, error,
  hunt, bars, hints, participants,
  filter, statusFilter, showHintInput, newHint, showWelcomeModal,
  isCreator, statusCounts, filteredBars,
  loadHunt, searchBars, toggleStatus, addHint, refreshHunt, formatTime,
  setOnMarkersChanged, startPolling, stopPolling,
} = useHunt(huntId);

const {
  initMap, paintMarkers, invalidateSize, cleanup,
} = useMap();

// Wire map repaint into hunt actions
setOnMarkersChanged(() => paintMarkers(bars.value));

// ── Map toggle ───────────────────────────────────────────
const mapEl = ref<HTMLDivElement | null>(null);
const mapOpen = ref(true);

watch(mapOpen, (open) => {
  if (open) nextTick(() => invalidateSize());
});

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

  // Show welcome modal on first visit
  const hasSeenWelcome = localStorage.getItem("chickenRunWelcomeSeen");
  if (!hasSeenWelcome) {
    showWelcomeModal.value = true;
    localStorage.setItem("chickenRunWelcomeSeen", "true");
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
    paintMarkers(bars.value);
  }

  startPolling();
});

onUnmounted(() => {
  stopPolling();
  cleanup();
});
</script>
