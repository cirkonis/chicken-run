<template>
  <div class="max-w-[700px] mx-auto px-4 py-5">
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
      <div class="flex justify-between items-center mb-1">
        <button class="bg-transparent border-none text-accent font-semibold text-[13px] cursor-pointer p-0 hover:underline" @click="goBack" title="Back">← Back</button>
        <InfoButton @click="showGuide = true" />
      </div>
      <header class="mb-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="m-0 text-2xl text-accent-dark">🐔 {{ hunt.name }}</h1>
              <HuntTimer v-if="hunt.startedAt" :started-at="hunt.startedAt" :ended-at="hunt.completedAt" />
            </div>
            <span class="text-sm text-text-muted italic">
              Playing as <strong>{{ auth.state.user?.displayName || 'Unknown' }}</strong>
              <template v-if="myTeam"> · Team: <strong>{{ myTeam.name }}</strong></template>
              <template v-if="myTeamHunterCount"> · {{ myTeamHunterCount }} hunter{{ myTeamHunterCount === 1 ? '' : 's' }}</template>
            </span>
          </div>
        </div>

        <!-- Team rename banner (one-time, for team members) -->
        <div
          v-if="myTeam && !myTeam.renamed && !isCreator"
          class="flex items-center gap-2 px-4 py-3 bg-[#fff8e1] border-2 border-chicken-yellow rounded-xl mb-3"
        >
          <span class="text-sm flex-1">
            Your team is <strong>{{ myTeam.name }}</strong> — want to pick a name?
          </span>
          <button
            class="px-3 py-1.5 border-2 border-accent rounded-lg bg-transparent text-accent text-xs font-semibold cursor-pointer transition-all hover:bg-accent hover:text-white"
            @click="renaming = true"
          >Rename</button>
        </div>

        <div class="flex flex-wrap gap-2.5 items-center" v-if="bars.length || totalHunterCount">
          <span class="text-sm text-text-muted" v-if="bars.length">
            <b>{{ bars.length }}</b> bars in the zone
          </span>

          <span class="text-sm text-text-muted font-semibold" v-if="totalHunterCount">
            {{ totalHunterCount }} hunter{{ totalHunterCount === 1 ? '' : 's' }}
          </span>
        </div>
      </header>

      <!-- Tab bar -->
      <div class="flex gap-1 p-1 bg-bg border-2 border-border rounded-xl mb-4">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all border-0"
          :class="activeTab === 'hunt'
            ? 'bg-accent text-white shadow-sm'
            : 'bg-transparent text-text-muted hover:text-accent'"
          @click="activeTab = 'hunt'"
        >Hunt</button>
        <button
          type="button"
          class="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all border-0"
          :class="activeTab === 'feed'
            ? 'bg-accent text-white shadow-sm'
            : 'bg-transparent text-text-muted hover:text-accent'"
          @click="activeTab = 'feed'"
        >Feed<span v-if="hasUnseenFeed" class="inline-block w-2 h-2 rounded-full bg-red ml-1.5 animate-pulse align-middle"></span></button>
      </div>

      <!-- Hunt tab content -->
      <main v-show="activeTab === 'hunt'" class="flex flex-col gap-4">
        <!-- Clucking Info -->
        <section class="bg-[#fff8e1] border-2 border-chicken-yellow rounded-[18px] p-5">
          <div class="flex justify-between items-center" :class="cluckingOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Clucking Info</h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-chicken-yellow/40 rounded-lg bg-white/60 text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="cluckingOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="cluckingOpen = !cluckingOpen"
            >{{ cluckingOpen ? 'Hide' : 'Show' }}<span v-if="hasUnseenCluckingInfo" class="inline-block w-2 h-2 rounded-full bg-red ml-1 animate-pulse align-middle"></span></button>
          </div>

          <div v-show="cluckingOpen">
            <!-- Money left (only if budget is set) -->
            <div v-if="budgetTotal != null" class="px-4 py-3 bg-white/60 border-2 border-chicken-yellow/40 rounded-xl mb-3">
              <div class="flex items-center gap-3">
                <div class="flex-1">
                  <div class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-0.5">Money left</div>
                  <div class="text-2xl font-bold text-accent-dark">
                    {{ budgetRemaining }}
                    <span class="text-sm font-normal text-text-muted">of {{ budgetTotal }}</span>
                  </div>
                </div>
                <div
                  class="w-16 h-16 rounded-full border-4 flex items-center justify-center"
                  :class="budgetPercent > 25 ? 'border-chicken-yellow' : 'border-red'"
                >
                  <span class="text-sm font-bold" :class="budgetPercent > 25 ? 'text-accent-dark' : 'text-red'">{{ budgetPercent }}%</span>
                </div>
              </div>
              <!-- Expandable expense details -->
              <div v-if="expenses.length > 0" class="mt-2 pt-2 border-t border-chicken-yellow/30">
                <button
                  type="button"
                  class="text-[11px] font-semibold text-text-muted cursor-pointer bg-transparent border-0 p-0 hover:text-accent transition-colors"
                  @click="expensesOpen = !expensesOpen"
                >{{ expensesOpen ? 'Hide' : 'Show' }} spending details ({{ expenses.length }})</button>
                <ul v-show="expensesOpen" class="list-none p-0 m-0 mt-1.5 flex flex-col gap-1">
                  <li
                    v-for="e in expenses"
                    :key="e.id"
                    class="flex items-center gap-2 px-2.5 py-1.5 bg-white/60 rounded-lg text-xs"
                  >
                    <span class="font-bold text-accent-dark min-w-[40px]">{{ e.amount }}</span>
                    <span class="flex-1 text-text-muted truncate">{{ e.note || '—' }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Chicken hints -->
            <HintBox
              :hints="hints"
              :show-when-empty="bars.length > 0"
              v-model:collapsed="hintsCollapsed"
              :notification="hasUnseenHints"
            />

            <!-- Who's with the chickens (arrivals) -->
            <div class="mt-3 px-4 py-3 bg-white/60 border-2 border-chicken-yellow/40 rounded-xl">
              <div class="flex justify-between items-center">
                <div class="text-xs font-semibold uppercase tracking-wide text-text-muted">Who's with the chickens</div>
                <button
                  class="px-2.5 py-1 border-2 border-chicken-yellow/40 rounded-lg bg-white/60 text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
                  @click="arrivalsOpen = !arrivalsOpen"
                >{{ arrivalsOpen ? 'Hide this' : 'Show this' }}<span v-if="hasUnseenArrivals" class="inline-block w-2 h-2 rounded-full bg-red ml-1 animate-pulse align-middle"></span></button>
              </div>
              <div v-show="arrivalsOpen" class="mt-2">
                <div v-if="arrivals.length > 0" class="flex flex-col gap-1.5">
                  <div
                    v-for="(a, idx) in arrivals"
                    :key="a.id"
                    class="flex flex-col gap-1.5"
                  >
                    <div class="flex items-center gap-2 text-sm">
                      <span class="w-6 h-6 rounded-full bg-accent/10 text-accent font-bold text-[10px] flex items-center justify-center">
                        {{ idx + 1 }}{{ idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th' }}
                      </span>
                      <span class="font-semibold">{{ a.teamName }}</span>
                    </div>
                    <p v-if="a.note" class="text-sm text-text-muted m-0 pl-8">{{ a.note }}</p>
                    <MediaImage
                      v-if="a.imagePath"
                      :path="a.imagePath"
                      alt="Arrival photo"
                      class="max-h-48 rounded-lg object-cover cursor-pointer border border-chicken-yellow/30"
                      loading="lazy"
                      @click="fullImagePath = a.imagePath"
                    />
                  </div>
                </div>
                <p v-else class="text-[13px] text-text-muted italic m-0">No teams have found the chickens yet.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Hunting Grounds -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-5">
          <div class="flex justify-between items-center" :class="mapOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Hunting Grounds</h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="mapOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="mapOpen = !mapOpen"
            >{{ mapOpen ? 'Hide map' : 'Show map' }}</button>
          </div>
          <div v-show="mapOpen">
            <div ref="mapEl" class="h-[420px] w-full rounded-2xl overflow-hidden border-2 border-border max-[900px]:h-[300px]"></div>
            <div class="flex flex-wrap gap-3 mt-2 px-3 py-2 bg-bg rounded-[10px] border border-border text-xs items-center">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red"></span> Not visited</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-green"></span> Visited</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-gray"></span> Maybe skip</span>
              <span class="flex-1"></span>
              <button
                class="flex items-center gap-1 px-2.5 py-1 border-2 rounded-lg cursor-pointer text-xs font-semibold transition-all"
                :class="locationActive ? 'border-blue bg-blue/10 text-blue' : 'border-border bg-bg text-text-muted hover:border-accent hover:text-accent'"
                @click="toggleUserLocation"
                title="Show my location"
              >{{ locationActive ? 'Tracking' : 'My location' }}</button>
            </div>
          </div>
        </section>

        <!-- Bars -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-5">
          <div class="flex justify-between items-center" :class="barsOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Bars <span v-if="bars.length" class="text-sm font-normal text-text-muted">({{ bars.length }})</span></h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="barsOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="barsOpen = !barsOpen"
            >{{ barsOpen ? 'Hide bars' : 'Show bars' }}</button>
          </div>
          <div v-show="barsOpen">
            <!-- Toolbar -->
            <div class="flex gap-2 items-center mb-2.5" v-if="bars.length">
              <input v-model="filter" placeholder="Search bars..." class="flex-1 px-2.5 py-2 border-2 border-border rounded-[10px] text-sm bg-bg focus:outline-none focus:border-accent" />
              <select v-model="statusFilter" class="px-2.5 py-2 border-2 border-border rounded-[10px] bg-bg text-[13px]">
                <option value="all">All</option>
                <option value="unchecked">Unchecked</option>
                <option value="checked">Visited</option>
                <option value="not_checking">Maybe skip</option>
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
                @toggle="handleBarToggle"
                @select="onBarSelect"
              />
            </ul>

          </div>
        </section>
      </main>

      <footer v-show="activeTab === 'hunt'" class="text-center py-5 text-[13px] text-text-muted border-t border-border mt-6">
        <p class="m-0">🐔 Don't be a chicken — check every bar. Or at least the ones that look fun.</p>
      </footer>

      <!-- Feed tab content -->
      <div v-show="activeTab === 'feed'">
        <CheckInFeed
          :check-ins="checkIns"
          :bars="bars"
          :teams="teams"
          :arrivals="arrivals"
          :current-user-id="auth.state.user?.id"
          @edit="editCheckIn"
          @delete="deleteCheckIn"
        />
      </div>

      <!-- Team Rename Modal -->
      <Teleport to="body">
        <div
          v-if="renaming"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] backdrop-blur-sm"
          @click.self="renaming = false"
        >
          <div class="bg-surface rounded-[20px] p-7 w-[380px] max-w-[90vw] shadow-[0_16px_48px_rgba(0,0,0,0.2)]">
            <div class="text-center mb-5">
              <div class="text-lg font-bold mb-1">Name your team</div>
              <p class="text-sm text-text-muted leading-relaxed m-0">
                This is a <strong>one-time thing</strong> — once you confirm, the name is locked in forever.
                Make it count! Check the spelling, make it good... no, make it legendary.
              </p>
            </div>

            <input
              ref="renameInput"
              v-model="newTeamName"
              type="text"
              placeholder="Something legendary..."
              class="w-full px-4 py-3 border-[3px] border-border rounded-xl text-base font-semibold text-center bg-bg focus:outline-none focus:border-accent mb-2"
              maxlength="40"
              @keyup.enter="showRenameConfirm = true"
            />
            <p class="text-[11px] text-text-muted text-center m-0 mb-4">{{ 40 - newTeamName.length }} characters left</p>

            <div v-if="renameError" class="px-3 py-2 mb-3 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ renameError }}</div>

            <div class="flex gap-2.5">
              <button
                class="flex-1 px-4 py-2.5 border-2 border-border rounded-xl cursor-pointer bg-surface text-text-muted font-semibold text-sm transition-all hover:border-accent hover:text-accent"
                @click="renaming = false; newTeamName = ''"
              >Never mind</button>
              <button
                class="flex-1 px-4 py-2.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-semibold text-sm transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="!newTeamName.trim()"
                @click="showRenameConfirm = true"
              >This is the one</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Rename Confirm Modal -->
      <ConfirmModal
        v-model="showRenameConfirm"
        title="Lock it in?"
        :message="`Your team will be called &quot;${newTeamName.trim()}&quot; forever. No take-backs, no typo fixes. Sure about this?`"
        confirm-label="Lock it in!"
        :loading="renamingLoading"
        @confirm="doRenameTeam"
      />

      <!-- Check-In Modal -->
      <CheckInModal
        v-model="showCheckInModal"
        :bar-name="checkInBarName"
        :teams="otherTeams"
        :loading="checkInUploading"
        @submit="onCheckInSubmit"
      />

      <!-- Fullscreen image viewer -->
      <Teleport to="body">
        <div
          v-if="fullImagePath"
          class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] cursor-pointer p-4"
          @click="fullImagePath = null"
        >
          <MediaImage :path="fullImagePath" class="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      </Teleport>
    </template>

    <GameGuide v-model="showGuide" />
  </div>
</template>

<script setup lang="ts">
import type { HuntBar } from "~/types";

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const huntId = route.params.id as string;
const showGuide = ref(false);

// ── Composables ──────────────────────────────────────────
const {
  pageLoading, error,
  hunt, bars, hints, participants, teams, expenses, arrivals, checkIns,
  filter, statusFilter,
  isCreator, myTeam, myTeamHunterCount, totalHunterCount, statusCounts, filteredBars,
  budgetTotal, budgetSpent, budgetRemaining, budgetPercent,
  checkInUploading,
  loadHunt, toggleStatus, checkInBar, deleteCheckIn, editCheckIn, renameTeam,
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

// ── Tabs ─────────────────────────────────────────────────
const activeTab = ref<'hunt' | 'feed'>('hunt');

// ── Feed notification dot ────────────────────────────────
const seenCheckInCount = ref(0);
const hasUnseenFeed = computed(() =>
  activeTab.value !== 'feed' && checkIns.value.length > seenCheckInCount.value
);

watch(activeTab, (tab) => {
  if (tab === 'feed') seenCheckInCount.value = checkIns.value.length;
});

watch(() => checkIns.value.length, (count) => {
  if (activeTab.value === 'feed') seenCheckInCount.value = count;
});

// ── Map toggle ───────────────────────────────────────────
const mapEl = ref<HTMLDivElement | null>(null);
const cluckingOpen = ref(true);
const expensesOpen = ref(false);
const hintsCollapsed = ref(true);
const arrivalsOpen = ref(false);
const mapOpen = ref(true);
const barsOpen = ref(true);

// ── Clucking Info notification dots ──────────────────────
const seenHintCount = ref(0);
const seenArrivalCount = ref(0);
const seenBudgetSpent = ref(0);

// Outer dot: Clucking Info is collapsed and something inside changed
const hasUnseenCluckingInfo = computed(() => {
  if (cluckingOpen.value) return false;
  return hints.value.length > seenHintCount.value
    || arrivals.value.length > seenArrivalCount.value
    || budgetSpent.value !== seenBudgetSpent.value;
});

// Inner dot: hints collapsed and new hints came in
const hasUnseenHints = computed(() => {
  if (!hintsCollapsed.value) return false;
  return hints.value.length > seenHintCount.value;
});

// Inner dot: arrivals sub-section is collapsed and new arrivals came in
const hasUnseenArrivals = computed(() => {
  if (arrivalsOpen.value) return false;
  return arrivals.value.length > seenArrivalCount.value;
});

// Mark budget seen when Clucking Info opens (budget is immediately visible)
watch(cluckingOpen, (open) => {
  if (open) {
    seenBudgetSpent.value = budgetSpent.value;
  }
});

// Mark hints seen when hints section opens
watch(hintsCollapsed, (collapsed) => {
  if (!collapsed) seenHintCount.value = hints.value.length;
});

// Mark arrivals seen when arrivals sub-section opens
watch(arrivalsOpen, (open) => {
  if (open) seenArrivalCount.value = arrivals.value.length;
});

// Auto-update seen counts when data changes while sections are visible
watch(() => hints.value.length, (count) => {
  if (cluckingOpen.value && !hintsCollapsed.value) seenHintCount.value = count;
});

watch(() => arrivals.value.length, (count) => {
  if (cluckingOpen.value && arrivalsOpen.value) seenArrivalCount.value = count;
});

watch(budgetSpent, (spent) => {
  if (cluckingOpen.value) seenBudgetSpent.value = spent;
});

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

// ── Image viewer ─────────────────────────────────────────
const fullImagePath = ref<string | null>(null);

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

// ── Check-In Flow (modal-based) ─────────────────────
const checkInBarId = ref<string | null>(null);
const showCheckInModal = ref(false);

const checkInBarName = computed(() => {
  if (!checkInBarId.value) return "";
  return bars.value.find((b) => b.id === checkInBarId.value)?.name || "Bar";
});

/** Non-chicken teams excluding the current user's team (for "ran into" selector) */
const otherTeams = computed(() =>
  teams.value.filter((t) => !t.isChicken && t.id !== myTeam.value?.id)
);

/** Intercept check-in / skip toggles on bars */
function handleBarToggle(bar: HuntBar, target: string) {
  if (target === "checked") {
    // Open the check-in modal. Allowed even when the bar is already "checked",
    // so a 2nd/3rd/4th team that shows up later can record their own check-in +
    // photo instead of being locked out (the "4 teams, one bar" problem).
    checkInBarId.value = bar.id;
    showCheckInModal.value = true;
  } else {
    // Toggle skip status as before.
    toggleStatus(bar, target);
  }
}

async function onCheckInSubmit(payload: { note: string; image: File; withTeamId: string | null }) {
  if (!checkInBarId.value) return;
  try {
    await checkInBar(checkInBarId.value, payload.note, payload.image, payload.withTeamId);
    showCheckInModal.value = false;
    checkInBarId.value = null;
  } catch {
    // error is set in the composable
  }
}

// ── Team rename ──────────────────────────────────────────
const renaming = ref(false);
const newTeamName = ref("");
const renamingLoading = ref(false);
const showRenameConfirm = ref(false);
const renameError = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

// Focus the input when the rename modal opens
watch(renaming, (open) => {
  if (open) {
    renameError.value = "";
    nextTick(() => renameInput.value?.focus());
  }
});

async function doRenameTeam() {
  if (!myTeam.value || !newTeamName.value.trim()) return;
  renamingLoading.value = true;
  renameError.value = "";
  try {
    await renameTeam(myTeam.value.id, newTeamName.value.trim());
    showRenameConfirm.value = false;
    renaming.value = false;
    newTeamName.value = "";
  } catch (e: any) {
    showRenameConfirm.value = false;
    renameError.value = e?.data?.message || e?.message || "Failed to rename team";
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
  await auth.restore();

  if (!auth.state.user) {
    router.push("/");
    return;
  }

  await loadHunt();

  // Redirect if hunt is already completed
  if (hunt.value?.status === 'completed') {
    navigateTo(`/hunt/${huntId}/results`);
    return;
  }

  seenCheckInCount.value = checkIns.value.length;
  seenHintCount.value = hints.value.length;
  seenArrivalCount.value = arrivals.value.length;
  seenBudgetSpent.value = budgetSpent.value;

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

// Redirect when hunt ends mid-game (detected via polling)
watch(() => hunt.value?.status, (status) => {
  if (status === 'completed') {
    stopPolling();
    navigateTo(`/hunt/${huntId}/results`);
  }
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
