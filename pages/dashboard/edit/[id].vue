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
        <h1 class="mt-1 mb-0 text-2xl text-accent-dark">✏️ Edit Hunt</h1>
        <p class="text-text-muted text-sm mt-1">Update hunt details and manage teams.</p>
      </header>

      <form @submit.prevent="saveHunt" class="flex flex-col gap-5">
        <!-- Hunt Codes (read only) -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <h2 class="m-0 mb-3.5 text-lg">Hunt Codes</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex items-center gap-2 px-3 py-2.5 bg-bg border-2 border-border rounded-[10px]">
              <span class="text-[10px] text-text-muted whitespace-nowrap">Hunter</span>
              <span class="font-extrabold text-base tracking-[2px] text-accent-dark flex-1">{{ hunterCode }}</span>
            </div>
            <div class="flex items-center gap-2 px-3 py-2.5 bg-[#fff8e1] border-2 border-chicken-yellow rounded-[10px]">
              <span class="text-[10px] text-text-muted whitespace-nowrap">Chicken</span>
              <span class="font-extrabold text-base tracking-[2px] text-accent-dark flex-1">{{ chickenCode }}</span>
            </div>
          </div>
        </section>

        <!-- Hunt Details -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <h2 class="m-0 mb-3.5 text-lg">Hunt Details</h2>
          <div class="flex flex-col gap-2.5">
            <input
              v-model="huntName"
              type="text"
              placeholder="Hunt name"
              class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent"
              required
            />
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
                  {{ pickingMode ? '📍 Picking...' : '📍 Set location' }}
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

        <!-- Teams -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <div class="flex justify-between items-center mb-3.5">
            <h2 class="m-0 text-lg">Teams</h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="w-8 h-8 flex items-center justify-center border-2 border-border rounded-lg bg-bg text-sm font-bold cursor-pointer transition-all hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="teams.length <= 0"
                @click="removeTeam"
              >−</button>
              <span class="text-sm font-semibold min-w-[60px] text-center">{{ teams.length }} team{{ teams.length !== 1 ? 's' : '' }}</span>
              <button
                type="button"
                class="w-8 h-8 flex items-center justify-center border-2 border-border rounded-lg bg-bg text-sm font-bold cursor-pointer transition-all hover:border-accent hover:text-accent"
                @click="addTeam"
              >+</button>
            </div>
          </div>

          <p v-if="teams.length === 0" class="text-text-muted text-sm m-0">
            No teams configured. Add teams to organize players into groups.
          </p>

          <div v-else class="flex flex-col gap-4">
            <div
              v-for="(team, ti) in teams"
              :key="ti"
              class="border-2 border-border rounded-xl p-4 bg-bg"
            >
              <div class="flex items-center gap-2 mb-3">
                <input
                  v-model="team.name"
                  type="text"
                  class="flex-1 px-3 py-2 border-2 border-border rounded-lg text-sm bg-surface font-semibold focus:outline-none focus:border-accent"
                  :placeholder="`Team ${ti + 1}`"
                />
                <button
                  type="button"
                  class="px-2.5 py-1.5 border-2 border-border rounded-lg bg-surface text-xs text-text-muted cursor-pointer transition-all hover:border-red hover:text-red"
                  @click="teams.splice(ti, 1)"
                  title="Remove team"
                >✕</button>
              </div>

              <div class="flex flex-col gap-2">
                <div
                  v-for="(member, mi) in team.members"
                  :key="mi"
                  class="flex gap-2 items-center"
                >
                  <input
                    v-model="member.name"
                    type="text"
                    placeholder="Name"
                    class="flex-1 px-2.5 py-2 border-2 border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-accent"
                  />
                  <input
                    v-model="member.email"
                    type="email"
                    placeholder="email@example.com"
                    class="flex-[2] px-2.5 py-2 border-2 border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    class="px-2 py-1.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red"
                    @click="team.members.splice(mi, 1)"
                    title="Remove member"
                  >✕</button>
                </div>
                <button
                  type="button"
                  class="self-start px-3 py-1.5 border-2 border-dashed border-border rounded-lg bg-transparent text-xs text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
                  @click="team.members.push({ name: '', email: '' })"
                >
                  + Add member
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Chickens -->
        <section class="bg-[#fffde7] border-2 border-chicken-yellow rounded-[18px] p-6">
          <div class="flex justify-between items-center mb-3.5">
            <h2 class="m-0 text-lg">Chickens</h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="w-8 h-8 flex items-center justify-center border-2 border-chicken-yellow rounded-lg bg-white text-sm font-bold cursor-pointer transition-all hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="chickens.length <= 0"
                @click="removeChicken"
              >−</button>
              <span class="text-sm font-semibold min-w-[80px] text-center">{{ chickens.length }} chicken{{ chickens.length !== 1 ? 's' : '' }}</span>
              <button
                type="button"
                class="w-8 h-8 flex items-center justify-center border-2 border-chicken-yellow rounded-lg bg-white text-sm font-bold cursor-pointer transition-all hover:border-accent hover:text-accent"
                @click="addChicken"
              >+</button>
            </div>
          </div>

          <p v-if="chickens.length === 0" class="text-text-muted text-sm m-0">
            No chickens — anyone with the chicken code can join as prey. Add chickens to control who can play.
          </p>

          <div v-else class="flex flex-col gap-2">
            <div
              v-for="(chicken, ci) in chickens"
              :key="ci"
              class="flex gap-2 items-center"
            >
              <input
                v-model="chicken.name"
                type="text"
                placeholder="Name"
                class="flex-1 px-2.5 py-2 border-2 border-chicken-yellow rounded-lg text-sm bg-white focus:outline-none focus:border-accent"
              />
              <input
                v-model="chicken.email"
                type="email"
                placeholder="email@example.com"
                class="flex-[2] px-2.5 py-2 border-2 border-chicken-yellow rounded-lg text-sm bg-white focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                class="px-2 py-1.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red"
                @click="chickens.splice(ci, 1)"
                title="Remove chicken"
              >✕</button>
            </div>
            <button
              type="button"
              class="self-start px-3 py-1.5 border-2 border-dashed border-chicken-yellow rounded-lg bg-transparent text-xs text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
              @click="addChicken"
            >
              + Add another chicken
            </button>
          </div>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Hunt, HuntBar, Team, TeamInput, TeamMemberInput, ChickenInput, HuntChicken } from "~/types";

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
const hunterCode = ref("");
const chickenCode = ref("");

// Teams
const teams = ref<{ name: string; members: TeamMemberInput[] }[]>([]);

// Chickens
const chickens = ref<{ name: string; email: string }[]>([]);

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

// ── Team helpers ─────────────────────────────────────────
function addTeam() {
  teams.value.push({
    name: `Team ${teams.value.length + 1}`,
    members: [{ name: "", email: "" }],
  });
}

function removeTeam() {
  if (teams.value.length > 0) {
    teams.value.pop();
  }
}

// ── Chicken helpers ──────────────────────────────────────
function addChicken() {
  chickens.value.push({ name: "", email: "" });
}

function removeChicken() {
  if (chickens.value.length > 0) {
    chickens.value.pop();
  }
}

// ── Update bars ─────────────────────────────────────────
async function updateBars() {
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
    hunterCode.value = h.hunterCode;
    chickenCode.value = h.chickenCode;
    huntStatus.value = h.status;

    // Track saved location for change detection
    savedLat.value = lat.value;
    savedLng.value = lng.value;
    savedRadius.value = radius.value;

    // Store full bars array
    bars.value = res.bars || [];

    // Populate teams
    if (res.teams && res.teams.length > 0) {
      teams.value = res.teams.map((t) => ({
        name: t.name,
        members: (t.members || []).map((m) => ({
          name: m.name,
          email: m.email,
        })),
      }));
    }

    // Populate chickens
    if (res.chickens && res.chickens.length > 0) {
      chickens.value = res.chickens.map((c) => ({
        name: c.name,
        email: c.email,
      }));
    }

    // Init map at hunt location (picking disabled by default)
    nextTick(() => {
      if (pickerMapEl.value) {
        initPicker(
          pickerMapEl.value,
          { lat: h.centerLat, lng: h.centerLng },
          h.radiusMeters
        );
        setPickingEnabled(false);
        // Paint bar markers after map init
        nextTick(() => paintBarMarkers());
      }
    });
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Failed to load hunt";
  } finally {
    loading.value = false;
  }
}

// ── Validation ───────────────────────────────────────────
function validateForm(): string | null {
  // Validate team emails (no duplicates within or across teams)
  for (const team of teams.value) {
    const emails = team.members
      .map((m) => m.email.trim().toLowerCase())
      .filter(Boolean);
    const seen = new Set<string>();
    for (const email of emails) {
      if (seen.has(email)) {
        return `Duplicate email "${email}" in ${team.name || "a team"}. Each member needs a unique email.`;
      }
      seen.add(email);
    }
  }

  const allTeamEmails = teams.value.flatMap((t) =>
    t.members.map((m) => m.email.trim().toLowerCase()).filter(Boolean)
  );
  const globalSeen = new Set<string>();
  for (const email of allTeamEmails) {
    if (globalSeen.has(email)) {
      return `Email "${email}" appears in multiple teams. Each person can only be on one team.`;
    }
    globalSeen.add(email);
  }

  // Validate chicken emails (no duplicates)
  const chickenEmails = chickens.value
    .map((c) => c.email.trim().toLowerCase())
    .filter(Boolean);
  const chickenSeen = new Set<string>();
  for (const email of chickenEmails) {
    if (chickenSeen.has(email)) {
      return `Duplicate chicken email "${email}". Each chicken needs a unique email.`;
    }
    chickenSeen.add(email);
  }

  // Check no overlap between hunter and chicken emails
  for (const email of chickenEmails) {
    if (globalSeen.has(email)) {
      return `Email "${email}" is in both a team and the chicken list. A person can't be both a hunter and a chicken.`;
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
        members: t.members.filter((m) => m.name.trim() && m.email.trim()),
      }));

    const chickensPayload: ChickenInput[] = chickens.value
      .filter((c) => c.name.trim() && c.email.trim());

    await auth.authFetch(`/api/hunts/${huntId}`, {
      method: "PUT",
      body: {
        name: huntName.value.trim(),
        centerLat: Number(lat.value),
        centerLng: Number(lng.value),
        radiusMeters: Number(radius.value) || 1500,
        teams: teamsPayload,
        chickens: chickensPayload,
      },
    });

    router.push("/dashboard");
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
