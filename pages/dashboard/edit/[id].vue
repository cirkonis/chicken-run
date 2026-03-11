<template>
  <div class="max-w-[700px] mx-auto px-4 py-5">
    <div v-if="!auth.isHost.value" class="text-center py-16 text-text-muted">
      <p>🐔 Hosts only! <NuxtLink to="/" class="text-accent">Go back</NuxtLink></p>
    </div>

    <template v-else-if="loading">
      <div class="text-center py-16 text-text-muted">Loading hunt...</div>
    </template>

    <template v-else-if="loadError">
      <div class="text-center py-16 text-text-muted">
        <p class="text-red font-semibold">{{ loadError }}</p>
        <NuxtLink to="/dashboard" class="text-accent">← Back to dashboard</NuxtLink>
      </div>
    </template>

    <template v-else>
      <header class="mb-6">
        <NuxtLink to="/dashboard" class="text-[13px] text-accent no-underline font-semibold hover:underline">← Dashboard</NuxtLink>
        <h1 class="mt-1 mb-0 text-2xl text-accent-dark">✏️ Manage Hunt</h1>
        <p class="text-text-muted text-sm mt-1">Update your hunt, manage teams, and get ready to go.</p>
      </header>

      <form @submit.prevent="saveHunt" class="flex flex-col gap-5">
        <!-- Hunt Name -->
        <input
          v-model="huntName"
          type="text"
          placeholder="Hunt name"
          class="px-4 py-3 border-2 border-border rounded-[18px] text-lg font-semibold bg-surface w-full focus:outline-none focus:border-accent"
          required
        />

        <!-- Budget -->
        <div class="flex items-center gap-3">
          <label class="flex flex-col gap-1 flex-1">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Budget (kr)</span>
            <input
              v-model="budget"
              type="number"
              inputmode="numeric"
              placeholder="Optional — leave blank for no budget"
              min="0"
              class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent"
            />
          </label>
          <button
            v-if="budget"
            type="button"
            class="mt-5 px-3 py-2 border-2 border-border rounded-lg bg-surface text-xs text-text-muted cursor-pointer transition-all hover:border-red hover:text-red"
            @click="budget = ''"
          >Clear</button>
        </div>

        <!-- Hunt Codes -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <div class="flex justify-between items-center" :class="codesOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Hunt Codes</h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="codesOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="codesOpen = !codesOpen"
            >{{ codesOpen ? 'Hide' : 'Show' }}</button>
          </div>

          <div v-show="codesOpen">
            <div v-if="savedTeamCodes.length > 0" class="flex flex-col gap-2">
              <p class="text-xs text-text-muted m-0 mb-1">Give each team their code to join the hunt.</p>
              <div
                v-for="tc in savedTeamCodes"
                :key="tc.name"
                class="flex items-center gap-2 px-3 py-2.5 border-2 rounded-[10px]"
                :class="tc.isChicken
                  ? 'bg-[#fff8e1] border-chicken-yellow'
                  : 'bg-bg border-border'"
              >
                <span class="text-xs text-text-muted truncate min-w-0 flex-1">
                  {{ tc.isChicken ? '🐔 ' : '' }}{{ tc.name }}
                </span>
                <span class="font-extrabold text-base tracking-[2px] text-accent-dark">{{ tc.code }}</span>
                <button
                  type="button"
                  class="px-2 py-1 border-2 rounded-lg text-[11px] cursor-pointer transition-all"
                  :class="tc.isChicken
                    ? 'border-chicken-yellow/40 bg-white/60 text-text-muted hover:border-accent hover:text-accent'
                    : 'border-border bg-surface text-text-muted hover:border-accent hover:text-accent'"
                  @click="copyCode(tc.code)"
                >{{ copiedCode === tc.code ? 'Copied!' : 'Copy' }}</button>
                <button
                  type="button"
                  class="px-2 py-1 border-2 border-accent/30 rounded-lg bg-accent/10 text-[11px] text-accent font-semibold cursor-pointer transition-all hover:bg-accent hover:text-white"
                  @click="flashCode = { name: tc.isChicken ? '🐔 Chickens' : tc.name, code: tc.code }"
                >Flash</button>
              </div>
            </div>
            <p v-else class="text-xs text-text-muted m-0">
              Save teams to get hunt codes for each team.
            </p>
          </div>
        </section>

        <!-- Hunting Grounds -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <div class="flex justify-between items-center" :class="mapOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Hunting Grounds</h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="mapOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="mapOpen = !mapOpen"
            >{{ mapOpen ? 'Hide map' : 'Show map' }}</button>
          </div>
          <div v-show="mapOpen" class="flex flex-col gap-2.5">
              <div class="grid grid-cols-3 gap-2">
                <label class="flex flex-col gap-1">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lat</span>
                  <input v-model="lat" inputmode="decimal" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" required />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lng</span>
                  <input v-model="lng" inputmode="decimal" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" required />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Radius (m)</span>
                  <input v-model="radius" inputmode="numeric" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" />
                </label>
              </div>
              <!-- Location picker map -->
              <div>
                <div class="flex items-center gap-2 mb-1.5">
                  <button
                    type="button"
                    class="px-3 py-1.5 border-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    :class="pickingMode
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-bg text-text-muted hover:border-accent hover:text-accent'"
                    @click="togglePickingMode"
                  >
                    {{ pickingMode ? '📍 Picking...' : '📍 Set new location' }}
                  </button>
                  <button
                    v-if="locationChanged"
                    type="button"
                    class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
                    @click="resetLocation"
                  >
                    ↩ Put it back
                  </button>
                  <span v-if="pickingMode" class="text-xs text-accent italic animate-pulse">Click the map to move the pin</span>
                </div>
                <div class="rounded-xl overflow-hidden border-2 transition-colors" :class="pickingMode ? 'border-accent' : 'border-border'">
                  <div ref="pickerMapEl" class="h-[280px] w-full"></div>
                </div>
              </div>
          </div>
        </section>

        <!-- Bars -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <!-- Header row: always visible -->
          <div class="flex justify-between items-center" :class="barsOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Bars</h2>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold" :class="barCount > 0 ? 'text-green' : 'text-text-muted'">
                {{ barCount > 0 ? `🍺 ${barCount}` : 'None' }}
              </span>
              <button
                v-if="barCount > 0"
                type="button"
                class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
                :class="barsOpen ? 'border-accent text-accent' : 'text-text-muted'"
                @click="barsOpen = !barsOpen"
              >
                {{ barsOpen ? 'Close ▾' : 'Manage bars ▸' }}
              </button>
            </div>
          </div>

          <!-- Searching spinner -->
          <div v-if="searchingBars" class="flex items-center gap-2 text-sm text-text-muted mt-3">
            <span class="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></span>
            Searching for bars...
          </div>

          <!-- Update bars button (always visible when location changed) -->
          <button
            v-if="locationChanged && !searchingBars"
            type="button"
            class="mt-3 px-5 py-2.5 border-2 border-accent rounded-xl bg-transparent text-accent font-semibold text-sm cursor-pointer transition-all animate-pulse hover:bg-accent hover:text-white"
            @click="updateBars"
          >
            🔄 Update Bars for New Location
          </button>

          <!-- Expanded bar management -->
          <template v-if="barsOpen && barCount > 0 && !searchingBars">
            <!-- Search + filter row -->
            <div class="flex gap-2 items-center mb-3">
              <input
                v-model="barFilter"
                placeholder="Search bars..."
                class="flex-1 px-2.5 py-2 border-2 border-border rounded-[10px] text-sm bg-bg focus:outline-none focus:border-accent"
              />
              <select
                v-model="barStatusFilter"
                class="px-2.5 py-2 border-2 border-border rounded-[10px] bg-bg text-[13px]"
              >
                <option value="all">All</option>
                <option value="marked">Marked for removal</option>
              </select>
            </div>

            <!-- Remove action bar -->
            <div
              v-if="markedForRemoval.size > 0"
              class="flex items-center justify-between px-3 py-2.5 mb-3 bg-[#fef0ef] border-2 border-red rounded-xl"
            >
              <span class="text-sm font-semibold text-red">
                {{ markedForRemoval.size }} bar{{ markedForRemoval.size !== 1 ? 's' : '' }} marked
              </span>
              <button
                type="button"
                class="px-4 py-1.5 border-0 rounded-lg bg-red text-white font-semibold text-xs cursor-pointer transition-opacity hover:opacity-90"
                @click="showRemoveModal = true"
              >
                🗑️ Remove from game
              </button>
            </div>

            <!-- Bar list -->
            <ul class="list-none p-0 m-0 flex flex-col gap-2 max-h-[400px] overflow-y-auto">
              <li
                v-for="bar in filteredBars"
                :key="bar.id"
                class="grid grid-cols-[1fr_auto] gap-2.5 border-2 rounded-[14px] p-3 transition-all"
                :class="markedForRemoval.has(bar.id)
                  ? 'border-red bg-[#fef0ef] opacity-60'
                  : 'border-border bg-bg'"
              >
                <div>
                  <div
                    class="text-[15px] leading-snug"
                    :class="markedForRemoval.has(bar.id) ? 'line-through text-text-muted' : ''"
                  >{{ bar.name }}</div>
                  <div class="text-[13px] text-text-muted mt-0.5">{{ bar.address }}</div>
                  <div class="mt-1 text-xs text-text-muted">
                    <span v-if="bar.rating">{{ bar.rating }}</span>
                    <span v-if="bar.ratingsTotal" class="opacity-70">({{ bar.ratingsTotal }})</span>
                    <span v-if="bar.priceLevel">{{ '$'.repeat(bar.priceLevel) }}</span>
                    <a :href="bar.mapsUrl" target="_blank" rel="noreferrer" class="ml-1.5 no-underline text-accent font-semibold hover:underline" @click.stop>Maps ↗</a>
                  </div>
                </div>
                <div class="flex items-center">
                  <button
                    type="button"
                    class="w-[34px] h-[34px] border-2 rounded-[10px] cursor-pointer text-base flex items-center justify-center transition-all"
                    :class="markedForRemoval.has(bar.id)
                      ? 'border-red bg-[#fef0ef] text-red opacity-100'
                      : 'border-border bg-surface opacity-40 hover:opacity-100 hover:border-red hover:text-red'"
                    :title="markedForRemoval.has(bar.id) ? 'Unmark' : 'Mark for removal'"
                    @click="toggleRemoveMark(bar.id)"
                  >🗑️</button>
                </div>
              </li>
            </ul>

            <p v-if="filteredBars.length === 0" class="text-center text-text-muted text-sm py-3 m-0">
              No bars match your search.
            </p>
          </template>
        </section>

        <!-- Teams (includes chicken team) -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <div class="flex justify-between items-center" :class="teamsOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Teams</h2>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold" :class="teams.length > 0 ? 'text-accent-dark' : 'text-text-muted'">
                {{ teamSummary }}
              </span>
              <button
                type="button"
                class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
                :class="teamsOpen ? 'border-accent text-accent' : 'text-text-muted'"
                @click="teamsOpen = !teamsOpen"
              >{{ teamsOpen ? 'Close' : 'Manage teams' }}</button>
            </div>
          </div>
          <TeamManager v-if="teamsOpen" v-model="teams" />
        </section>

        <!-- Submit -->
        <div>
          <div v-if="error" class="px-3 py-2 mb-3 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ error }}</div>
          <button
            type="submit"
            class="w-full px-6 py-3.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-[15px] transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="submitting || searchingBars || locationChanged"
          >
            {{ submitting ? "Saving..." : locationChanged ? "⚠️ Update bars before saving" : "💾 Save Changes" }}
          </button>
        </div>

        <!-- Scary Stuff -->
        <section class="bg-surface border-2 border-red/20 rounded-[18px] p-6">
          <h2 class="m-0 mb-2 text-lg text-red">Scary Stuff</h2>
          <p class="text-sm text-text-muted mb-4">These actions affect the hunt for all participants.</p>
          <div class="flex gap-3">
            <button
              v-if="huntStatus === 'active'"
              type="button"
              class="px-5 py-2.5 border-2 border-border rounded-xl bg-surface text-text font-semibold text-sm cursor-pointer transition-all hover:border-accent hover:text-accent"
              @click="showEndModal = true"
            >End Hunt</button>
            <button
              v-if="huntStatus === 'completed'"
              type="button"
              class="px-5 py-2.5 border-2 border-green/40 rounded-xl bg-surface text-green font-semibold text-sm cursor-pointer transition-all hover:bg-green hover:text-white hover:border-green"
              @click="doReactivate"
            >Reactivate Hunt</button>
            <button
              type="button"
              class="px-5 py-2.5 border-2 border-red rounded-xl bg-surface text-red font-semibold text-sm cursor-pointer transition-all hover:bg-red hover:text-white"
              @click="showDeleteModal = true"
            >Delete Hunt</button>
          </div>
        </section>
      </form>

      <!-- End Hunt modal -->
      <ConfirmModal
        v-model="showEndModal"
        title="End this hunt?"
        message="Players won't be able to join anymore, but all data will be preserved. You can reactivate the hunt later."
        confirm-label="End Hunt"
        :loading="dangerLoading"
        @confirm="doEndHunt"
      />

      <!-- Delete Hunt modal -->
      <ConfirmModal
        v-model="showDeleteModal"
        title="Delete this hunt?"
        message="This will permanently delete the hunt and all its data — bars, hints, teams, participants. This cannot be undone."
        confirm-label="Delete Hunt"
        variant="danger"
        :loading="dangerLoading"
        @confirm="doDeleteHunt"
      />

      <!-- Remove Bars modal -->
      <ConfirmModal
        v-model="showRemoveModal"
        :title="`Remove ${markedForRemoval.size} bar${markedForRemoval.size !== 1 ? 's' : ''} from the game?`"
        message="These bars will be permanently deleted. Hunters will never see them. This cannot be undone."
        confirm-label="Remove bars"
        variant="danger"
        :loading="removeLoading"
        @confirm="doRemoveBars"
      />

      <!-- Flash Code overlay -->
      <Teleport to="body">
        <div
          v-if="flashCode"
          class="fixed inset-0 bg-[#1a1a2e]/95 flex flex-col items-center justify-center z-[9999] cursor-pointer select-none"
          @click="flashCode = null"
        >
          <div class="text-white/60 text-sm font-semibold tracking-wider uppercase mb-3">{{ flashCode.name }}</div>
          <div class="text-white text-[72px] sm:text-[96px] font-black tracking-[12px] sm:tracking-[16px] leading-none">{{ flashCode.code }}</div>
          <div class="text-white/40 text-xs mt-6">Enter this code to join the hunt</div>
          <div class="text-white/25 text-[11px] mt-10">Tap anywhere to close</div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Hunt, HuntBar, Team, TeamInput, TeamMemberInput, HuntChicken } from "~/types";

const auth = useAuth();
const router = useRouter();
const route = useRoute();
const huntId = route.params.id as string;
const { $L } = useNuxtApp();

// Hunt details
const huntName = ref("");
const lat = ref("");
const lng = ref("");
const radius = ref("1500");
const budget = ref("");
const hunterCode = ref("");

// Teams (now includes chicken team via isChicken flag)
const teams = ref<{ name: string; members: TeamMemberInput[]; isChicken?: boolean }[]>([]);
const savedTeamCodes = ref<{ name: string; code: string; isChicken: boolean }[]>([]);

// Flash code overlay
const flashCode = ref<{ name: string; code: string } | null>(null);

// Copy helper
const copiedCode = ref("");
function copyCode(code: string) {
  navigator.clipboard.writeText(code);
  copiedCode.value = code;
  setTimeout(() => { if (copiedCode.value === code) copiedCode.value = ""; }, 2000);
}

// UI state
const loading = ref(true);
const loadError = ref("");
const error = ref("");
const submitting = ref(false);

// Hunt status + danger zone
const huntStatus = ref<string>("active");
const showEndModal = ref(false);
const showDeleteModal = ref(false);
const dangerLoading = ref(false);

// Team summary for the header
const teamSummary = computed(() => {
  if (teams.value.length === 0) return "None";
  const hunterTeams = teams.value.filter((t) => !t.isChicken);
  const chickenTeam = teams.value.find((t) => t.isChicken);
  const hunterMembers = hunterTeams.reduce((sum, t) => sum + t.members.length, 0);
  const chickenMembers = chickenTeam?.members.length ?? 0;
  let parts = [];
  if (hunterTeams.length > 0) {
    parts.push(`${hunterMembers} hunters in ${hunterTeams.length} team${hunterTeams.length !== 1 ? 's' : ''}`);
  }
  if (chickenMembers > 0) {
    parts.push(`${chickenMembers} 🐔`);
  }
  return parts.join(", ") || "None";
});

async function doEndHunt() {
  dangerLoading.value = true;
  try {
    await auth.authFetch(`/api/hunts/${huntId}/status`, { method: "PATCH", body: { status: "completed" } });
    huntStatus.value = "completed";
    showEndModal.value = false;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to end hunt";
  } finally {
    dangerLoading.value = false;
  }
}

async function doReactivate() {
  dangerLoading.value = true;
  try {
    await auth.authFetch(`/api/hunts/${huntId}/status`, { method: "PATCH", body: { status: "active" } });
    huntStatus.value = "active";
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to reactivate hunt";
  } finally {
    dangerLoading.value = false;
  }
}

async function doDeleteHunt() {
  dangerLoading.value = true;
  try {
    await auth.authFetch(`/api/hunts/${huntId}`, { method: "DELETE" });
    showDeleteModal.value = false;
    router.push("/dashboard");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to delete hunt";
  } finally {
    dangerLoading.value = false;
  }
}

// ── Bars ────────────────────────────────────────────────
const bars = ref<HuntBar[]>([]);
const barCount = computed(() => bars.value.length);
const savedLat = ref("");
const savedLng = ref("");
const savedRadius = ref("");
const searchingBars = ref(false);

// Hunt Codes UI
const codesOpen = ref(true);

// Hunting Grounds (map) UI — open by default
const mapOpen = ref(true);
watch(mapOpen, (open) => {
  if (open) nextTick(() => invalidatePickerSize());
});

// Team management UI
const teamsOpen = ref(false);

// Bar management UI
const barsOpen = ref(false);
const barFilter = ref("");
const barStatusFilter = ref<"all" | "marked">("all");
const markedForRemoval = ref(new Set<string>());
const showRemoveModal = ref(false);
const removeLoading = ref(false);

const locationChanged = computed(() => {
  return (
    lat.value !== savedLat.value ||
    lng.value !== savedLng.value ||
    radius.value !== savedRadius.value
  );
});

const filteredBars = computed(() => {
  let result = bars.value;

  // Text filter
  const q = barFilter.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (b) => b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
    );
  }

  // Status filter
  if (barStatusFilter.value === "marked") {
    result = result.filter((b) => markedForRemoval.value.has(b.id));
  }

  return result;
});

function toggleRemoveMark(barId: string) {
  const next = new Set(markedForRemoval.value);
  if (next.has(barId)) {
    next.delete(barId);
  } else {
    next.add(barId);
  }
  markedForRemoval.value = next;
}

async function doRemoveBars() {
  removeLoading.value = true;
  try {
    const barIds = Array.from(markedForRemoval.value);
    await auth.authFetch(`/api/hunts/${huntId}/bars/remove`, {
      method: "POST",
      body: { barIds },
    });

    // Remove from local state
    bars.value = bars.value.filter((b) => !markedForRemoval.value.has(b.id));
    markedForRemoval.value = new Set();
    showRemoveModal.value = false;

    // Repaint markers
    nextTick(() => paintBarMarkers());
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to remove bars";
  } finally {
    removeLoading.value = false;
  }
}

// ── Location picker ──────────────────────────────────────
const pickerMapEl = ref<HTMLDivElement | null>(null);
const pickingMode = ref(false);
const { initPicker, placePin, updateRadius, invalidatePickerSize, getMap, cleanupPicker, setOnLocationPicked, setPickingEnabled } = useLocationPicker();

setOnLocationPicked((newLat, newLng) => {
  lat.value = newLat.toFixed(6);
  lng.value = newLng.toFixed(6);
  updateRadius(parseInt(radius.value) || 1500);
});

watch(radius, (val) => {
  const r = parseInt(val) || 1500;
  updateRadius(r);
});

function togglePickingMode() {
  pickingMode.value = !pickingMode.value;
  setPickingEnabled(pickingMode.value);
  nextTick(() => invalidatePickerSize());
}

function resetLocation() {
  lat.value = savedLat.value;
  lng.value = savedLng.value;
  radius.value = savedRadius.value;
  placePin(parseFloat(savedLat.value), parseFloat(savedLng.value));
  updateRadius(parseInt(savedRadius.value) || 1500);
  pickingMode.value = false;
  setPickingEnabled(false);
}

// ── Bar markers on map ──────────────────────────────────
let markersLayer: L.LayerGroup | null = null;

function paintBarMarkers() {
  const map = getMap();
  if (!map || !$L) return;

  if (!markersLayer) {
    markersLayer = $L.layerGroup().addTo(map);
  }
  markersLayer.clearLayers();

  for (const b of bars.value) {
    const isMarked = markedForRemoval.value.has(b.id);
    const color = isMarked ? "#e74c3c" : "#e67e22";
    const opacity = isMarked ? 0.4 : 1;

    const icon = $L.divIcon({
      html: `<div style="font-size:14px;text-align:center;background:${color};color:white;border-radius:50%;width:24px;height:24px;line-height:24px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);opacity:${opacity};">🍺</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: "bar-icon",
    });

    const m = $L.marker([b.lat, b.lng], { icon }).addTo(markersLayer!);
    m.bindPopup(`<b>${b.name}</b><br/>${b.address}`);
  }
}

// Repaint markers when marks change
watch(markedForRemoval, () => paintBarMarkers());

// ── Update bars ─────────────────────────────────────────
async function updateBars() {
  // Exit picking mode when updating bars
  pickingMode.value = false;
  setPickingEnabled(false);

  error.value = "";
  searchingBars.value = true;

  try {
    // Save the hunt first so DB has the new location
    await auth.authFetch(`/api/hunts/${huntId}`, {
      method: "PUT",
      body: {
        name: huntName.value.trim(),
        centerLat: Number(lat.value),
        centerLng: Number(lng.value),
        radiusMeters: Number(radius.value) || 1500,
      },
    });

    // Now search for bars at the new location
    const searchRes = await auth.authFetch<{ count: number; bars: HuntBar[] }>(
      `/api/hunts/${huntId}/bars/search`,
      { method: "POST" }
    );

    bars.value = searchRes.bars || [];
    markedForRemoval.value = new Set(); // fresh location = fresh bar set

    // Update saved location to match
    savedLat.value = lat.value;
    savedLng.value = lng.value;
    savedRadius.value = radius.value;

    // Repaint markers
    nextTick(() => paintBarMarkers());
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to update bars";
  } finally {
    searchingBars.value = false;
  }
}

// ── Load hunt ────────────────────────────────────────────
async function loadHunt() {
  loading.value = true;
  try {
    const res = await auth.authFetch<{ hunt: Hunt; teams: Team[]; bars: HuntBar[]; chickens: HuntChicken[] }>(`/api/hunts/${huntId}`);
    const h = res.hunt;

    huntName.value = h.name;
    lat.value = String(h.centerLat);
    lng.value = String(h.centerLng);
    radius.value = String(h.radiusMeters);
    budget.value = h.budget != null ? String(h.budget) : "";
    hunterCode.value = h.hunterCode;
    huntStatus.value = h.status;

    // Track saved location for change detection
    savedLat.value = lat.value;
    savedLng.value = lng.value;
    savedRadius.value = radius.value;

    // Store full bars array
    bars.value = res.bars || [];

    // Populate teams (with isChicken flag) + save their codes for display
    if (res.teams && res.teams.length > 0) {
      teams.value = res.teams.map((t) => ({
        name: t.name,
        members: (t.members || []).map((m) => ({
          name: m.name,
        })),
        isChicken: t.isChicken || false,
      }));
      savedTeamCodes.value = res.teams
        .filter((t) => t.joinCode)
        .map((t) => ({ name: t.name, code: t.joinCode!, isChicken: t.isChicken || false }));
    }

    // Auto-migrate old-style chickens: if the hunt has old hunt_chickens rows
    // but no chicken team, create one in the teams array
    const hasChickenTeam = teams.value.some((t) => t.isChicken);
    if (!hasChickenTeam && res.chickens && res.chickens.length > 0) {
      teams.value.unshift({
        name: "Chickens",
        members: res.chickens.map((c) => ({ name: c.name })),
        isChicken: true,
      });
    }

    // Set loading false FIRST so Vue renders the form (and map container)
    loading.value = false;

    // Then wait for DOM to be ready and init the map
    await nextTick();
    if (pickerMapEl.value) {
      initPicker(
        pickerMapEl.value,
        { lat: h.centerLat, lng: h.centerLng },
        h.radiusMeters
      );
      setPickingEnabled(false);
      await nextTick();
      paintBarMarkers();
    }
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Failed to load hunt";
    loading.value = false;
  }
}

// ── Validation ───────────────────────────────────────────
function validateForm(): string | null {
  // Validate team member names (no duplicates within a team)
  for (const team of teams.value) {
    const names = team.members
      .map((m) => m.name.trim().toLowerCase())
      .filter(Boolean);
    const seen = new Set<string>();
    for (const name of names) {
      if (seen.has(name)) {
        return `Duplicate name "${name}" in ${team.name || "a team"}. Each member needs a unique name.`;
      }
      seen.add(name);
    }
  }

  return null;
}

// ── Save ─────────────────────────────────────────────────
async function saveHunt() {
  error.value = "";

  const validationError = validateForm();
  if (validationError) {
    error.value = validationError;
    return;
  }

  submitting.value = true;

  try {
    const teamsPayload: TeamInput[] = teams.value
      .filter((t) => t.name.trim())
      .map((t) => ({
        name: t.name.trim(),
        members: t.members.filter((m) => m.name.trim()),
        isChicken: t.isChicken || false,
      }));

    const saveRes = await auth.authFetch<{ hunt: Hunt }>(`/api/hunts/${huntId}`, {
      method: "PUT",
      body: {
        name: huntName.value.trim(),
        centerLat: Number(lat.value),
        centerLng: Number(lng.value),
        radiusMeters: Number(radius.value) || 1500,
        budget: budget.value ? Number(budget.value) : null,
        teams: teamsPayload,
      },
    });

    // Reload to reflect saved state (fresh codes, clean form)
    window.location.reload();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to save hunt";
  } finally {
    submitting.value = false;
  }
}

// ── Lifecycle ────────────────────────────────────────────
onMounted(async () => {
  await auth.restore();
  if (auth.isHost.value) {
    loadHunt();
  }
});

onUnmounted(() => {
  cleanupPicker();
});
</script>
