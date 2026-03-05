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
              <span class="text-xs text-text-muted italic">Click the map to set the hunt center</span>
              <div ref="pickerMapEl" class="h-[280px] w-full rounded-xl overflow-hidden border-2 border-border mt-1.5"></div>
            </div>
          </div>
        </section>

        <!-- Codes (read only) -->
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

        <!-- Bars -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <h2 class="m-0 mb-3.5 text-lg">Bars</h2>
          <div v-if="searchingBars" class="flex items-center gap-2 text-sm text-text-muted">
            <span class="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></span>
            Searching for bars...
          </div>
          <template v-else>
            <p class="text-sm m-0" :class="barCount > 0 ? 'text-green font-semibold' : 'text-text-muted'">
              {{ barCount > 0 ? `🍺 ${barCount} bars found in the zone` : 'No bars yet — search after setting your location.' }}
            </p>
            <button
              v-if="locationChanged"
              type="button"
              class="mt-3 px-5 py-2.5 border-2 border-accent rounded-xl bg-transparent text-accent font-semibold text-sm cursor-pointer transition-all animate-pulse hover:bg-accent hover:text-white"
              @click="updateBars"
            >
              🔄 Update Bars for New Location
            </button>
          </template>
        </section>

        <!-- Submit -->
        <div>
          <div v-if="error" class="px-3 py-2 mb-3 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ error }}</div>
          <button
            type="submit"
            class="w-full px-6 py-3.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-[15px] transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="submitting || searchingBars"
          >
            {{ submitting ? "Saving..." : "💾 Save Changes" }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Hunt, Team, TeamInput, TeamMemberInput } from "~/types";

const auth = useAuth();
const router = useRouter();
const route = useRoute();
const huntId = route.params.id as string;

// Hunt details
const huntName = ref("");
const lat = ref("");
const lng = ref("");
const radius = ref("1500");
const hunterCode = ref("");
const chickenCode = ref("");

// Teams
const teams = ref<{ name: string; members: TeamMemberInput[] }[]>([]);

// UI state
const loading = ref(true);
const loadError = ref("");
const error = ref("");
const submitting = ref(false);

// Bar tracking
const barCount = ref(0);
const savedLat = ref("");
const savedLng = ref("");
const savedRadius = ref("");
const searchingBars = ref(false);

const locationChanged = computed(() => {
  return (
    lat.value !== savedLat.value ||
    lng.value !== savedLng.value ||
    radius.value !== savedRadius.value
  );
});

// ── Location picker ──────────────────────────────────────
const pickerMapEl = ref<HTMLDivElement | null>(null);
const { initPicker, placePin, updateRadius, cleanupPicker, setOnLocationPicked } = useLocationPicker();

setOnLocationPicked((newLat, newLng) => {
  lat.value = newLat.toFixed(6);
  lng.value = newLng.toFixed(6);
  updateRadius(parseInt(radius.value) || 1500);
});

watch(radius, (val) => {
  const r = parseInt(val) || 1500;
  updateRadius(r);
});

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
    const searchRes = await auth.authFetch<{ count: number }>(
      `/api/hunts/${huntId}/bars/search`,
      { method: "POST" }
    );

    barCount.value = searchRes.count;

    // Update saved location to match
    savedLat.value = lat.value;
    savedLng.value = lng.value;
    savedRadius.value = radius.value;
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
    const res = await auth.authFetch<{ hunt: Hunt; teams: Team[]; bars: any[] }>(`/api/hunts/${huntId}`);
    const h = res.hunt;

    huntName.value = h.name;
    lat.value = String(h.centerLat);
    lng.value = String(h.centerLng);
    radius.value = String(h.radiusMeters);
    hunterCode.value = h.hunterCode;
    chickenCode.value = h.chickenCode;

    // Track saved location for change detection
    savedLat.value = lat.value;
    savedLng.value = lng.value;
    savedRadius.value = radius.value;

    // Bar count from loaded bars
    barCount.value = res.bars?.length || 0;

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

    // Init map at hunt location
    nextTick(() => {
      if (pickerMapEl.value) {
        initPicker(
          pickerMapEl.value,
          { lat: h.centerLat, lng: h.centerLng },
          h.radiusMeters
        );
      }
    });
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Failed to load hunt";
  } finally {
    loading.value = false;
  }
}

// ── Validation ───────────────────────────────────────────
function validateTeams(): string | null {
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

  const allEmails = teams.value.flatMap((t) =>
    t.members.map((m) => m.email.trim().toLowerCase()).filter(Boolean)
  );
  const globalSeen = new Set<string>();
  for (const email of allEmails) {
    if (globalSeen.has(email)) {
      return `Email "${email}" appears in multiple teams. Each person can only be on one team.`;
    }
    globalSeen.add(email);
  }

  return null;
}

// ── Save ─────────────────────────────────────────────────
async function saveHunt() {
  error.value = "";

  const validationError = validateTeams();
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

    await auth.authFetch(`/api/hunts/${huntId}`, {
      method: "PUT",
      body: {
        name: huntName.value.trim(),
        centerLat: Number(lat.value),
        centerLng: Number(lng.value),
        radiusMeters: Number(radius.value) || 1500,
        teams: teamsPayload,
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
onMounted(() => {
  auth.restore();
  if (auth.isHost.value) {
    loadHunt();
  }
});

onUnmounted(() => {
  cleanupPicker();
});
</script>
