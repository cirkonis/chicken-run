<template>
  <div class="max-w-[700px] mx-auto px-4 py-5">
    <div v-if="!auth.isHost.value" class="text-center py-16 text-text-muted">
      <p>🐔 Hosts only! <NuxtLink to="/" class="text-accent">Go back</NuxtLink></p>
    </div>

    <template v-else>
      <header class="mb-6">
        <NuxtLink to="/dashboard" class="text-[13px] text-accent no-underline font-semibold hover:underline">← Dashboard</NuxtLink>
        <h1 class="mt-1 mb-0 text-2xl text-accent-dark">🐔 Create a Hunt</h1>
        <p class="text-text-muted text-sm mt-1">Set up the hunt, add your teams, and let the games begin.</p>
      </header>

      <!-- Success state -->
      <div v-if="created" class="text-center py-16">
        <p class="text-5xl mb-4">🎉</p>
        <p class="text-xl font-bold text-accent-dark mb-2">Hunt created!</p>
        <p class="text-text-muted text-sm">Found <strong>{{ barCount }}</strong> bars nearby. Redirecting...</p>
      </div>

      <form v-else @submit.prevent="createHunt" class="flex flex-col gap-5">
        <!-- Hunt Details -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-6">
          <h2 class="m-0 mb-3.5 text-lg">Hunt Details</h2>
          <div class="flex flex-col gap-2.5">
            <input
              v-model="huntName"
              type="text"
              placeholder="Hunt name (e.g. Copenhagen Bar Crawl)"
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
            No teams — hunters will join without team assignment. Add teams if you want to organize players into groups.
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

              <!-- Members -->
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

        <!-- Submit -->
        <div>
          <div v-if="error" class="px-3 py-2 mb-3 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ error }}</div>
          <button
            type="submit"
            class="w-full px-6 py-3.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-[15px] transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="submitting"
          >
            {{ submitLabel }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { TeamInput, TeamMemberInput } from "~/types";

const auth = useAuth();
const router = useRouter();

// Hunt details
const huntName = ref("");
const lat = ref("55.678831");
const lng = ref("12.579570");
const radius = ref("1500");

// Teams
const teams = ref<{ name: string; members: TeamMemberInput[] }[]>([]);

// UI state
const error = ref("");
const submitting = ref(false);
const created = ref(false);
const barCount = ref(0);

const submitLabel = computed(() => {
  if (!submitting.value) return "🐔 Create Hunt";
  if (created.value) return "Finding bars...";
  return "Creating hunt...";
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

  // Check across all teams too
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

// ── Submit ───────────────────────────────────────────────
async function createHunt() {
  error.value = "";

  // Validate before submitting
  const validationError = validateTeams();
  if (validationError) {
    error.value = validationError;
    return;
  }

  submitting.value = true;

  try {
    // Build teams payload (filter out empty members)
    const teamsPayload: TeamInput[] = teams.value
      .filter((t) => t.name.trim())
      .map((t) => ({
        name: t.name.trim(),
        members: t.members.filter((m) => m.name.trim() && m.email.trim()),
      }));

    // 1. Create the hunt
    const res = await auth.authFetch<{ hunt: any }>("/api/hunts", {
      method: "POST",
      body: {
        name: huntName.value.trim(),
        centerLat: Number(lat.value),
        centerLng: Number(lng.value),
        radiusMeters: Number(radius.value) || 1500,
        teams: teamsPayload.length > 0 ? teamsPayload : undefined,
      },
    });

    // 2. Auto-search bars
    const huntId = res.hunt.id;
    const searchRes = await auth.authFetch<{ count: number }>(
      `/api/hunts/${huntId}/bars/search`,
      { method: "POST" }
    );

    // 3. Show success
    barCount.value = searchRes.count;
    created.value = true;

    // 4. Redirect after a brief pause
    setTimeout(() => router.push("/dashboard"), 1500);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to create hunt";
    created.value = false;
  } finally {
    submitting.value = false;
  }
}

// ── Lifecycle ────────────────────────────────────────────
onMounted(() => {
  auth.restore();
  nextTick(() => {
    if (pickerMapEl.value) {
      const latVal = parseFloat(lat.value) || 55.678831;
      const lngVal = parseFloat(lng.value) || 12.579570;
      initPicker(pickerMapEl.value, { lat: latVal, lng: lngVal }, parseInt(radius.value) || 1500);
    }
  });
});

onUnmounted(() => {
  cleanupPicker();
});
</script>
