<template>
  <div class="max-w-[700px] mx-auto px-4 py-5">
    <div v-if="!auth.isHost.value" class="text-center py-16 text-text-muted">
      <p>🐔 Hosts only! <NuxtLink to="/" class="text-accent">Go back</NuxtLink></p>
    </div>

    <template v-else>
      <header class="mb-6">
        <NuxtLink to="/dashboard" class="text-[13px] text-accent no-underline font-semibold hover:underline">← Dashboard</NuxtLink>
        <h1 class="mt-1 mb-0 text-2xl text-accent-dark">🐔 Create a Hunt</h1>
        <p class="text-text-muted text-sm mt-1">Give your hunt a name and choose your hunting grounds. You'll add teams and chickens next.</p>
      </header>

      <!-- Success state -->
      <div v-if="created" class="text-center py-16">
        <p class="text-5xl mb-4">🎉</p>
        <p class="text-xl font-bold text-accent-dark mb-2">Hunt created!</p>
        <p class="text-text-muted text-sm">Found <strong>{{ barCount }}</strong> bars nearby. Taking you to manage your hunt...</p>
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
            <p class="text-xs text-text-muted m-0 mt-1">
              <strong>Note:</strong> Don't worry, the location and radius can be changed later in the manage hunt page.
            </p>

            <!-- When the crawl runs — drives the opening-hours bar filter (bar rules) -->
            <div class="grid grid-cols-2 gap-2 mt-1">
              <label class="flex flex-col gap-1">
                <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Game day</span>
                <select v-model.number="gameDay" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent">
                  <option v-for="d in DAY_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Start time</span>
                <input v-model="startTime" type="time" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" />
              </label>
            </div>
            <p class="text-xs text-text-muted m-0">Bars not open by your start time get filtered out. You can fine-tune bar rules after creating.</p>
            <!-- Budget can be set later in the manage hunt page -->
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
          <p class="text-xs text-text-muted text-center mt-2 m-0">
            You'll add teams and chickens on the next screen.
          </p>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth();
const router = useRouter();

// Hunt details
const huntName = ref("");
const lat = ref("55.678831");
const lng = ref("12.579570");
const radius = ref("1500");

// When the crawl runs (drives the opening-hours bar filter). Default: Saturday 2pm.
const { DAY_OPTIONS, timeToMinutes } = useSchedule();
const gameDay = ref<number>(6);
const startTime = ref("14:00");
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
const { initPicker, updateRadius, cleanupPicker, setOnLocationPicked } = useLocationPicker();

setOnLocationPicked((newLat, newLng) => {
  lat.value = newLat.toFixed(6);
  lng.value = newLng.toFixed(6);
  updateRadius(parseInt(radius.value) || 1500);
});

watch(radius, (val) => {
  const r = parseInt(val) || 1500;
  updateRadius(r);
});

// ── Submit ───────────────────────────────────────────────
async function createHunt() {
  error.value = "";
  submitting.value = true;

  try {
    // 1. Create the hunt (no teams or chickens — those go in the edit page)
    const createBody: Record<string, any> = {
      name: huntName.value.trim(),
      centerLat: Number(lat.value),
      centerLng: Number(lng.value),
      radiusMeters: Number(radius.value) || 1500,
      gameDay: gameDay.value,
      startMinute: timeToMinutes(startTime.value),
    };
    const res = await auth.authFetch<{ hunt: any }>("/api/hunts", {
      method: "POST",
      body: createBody,
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

    // 4. Redirect to the edit page for this hunt after a brief pause
    setTimeout(() => router.push(`/dashboard/edit/${huntId}`), 1500);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to create hunt";
    created.value = false;
  } finally {
    submitting.value = false;
  }
}

// ── Lifecycle ────────────────────────────────────────────
onMounted(async () => {
  await auth.restore();
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
