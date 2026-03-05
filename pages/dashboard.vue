<template>
  <div class="max-w-[700px] mx-auto px-4 py-5">
    <div v-if="!auth.isHost.value" class="text-center py-16 text-text-muted">
      <p>🐔 Hosts only! <NuxtLink to="/" class="text-accent">Go back</NuxtLink></p>
    </div>

    <template v-else>
      <header class="flex justify-between items-start mb-6">
        <div>
          <NuxtLink to="/" class="text-[13px] text-accent no-underline font-semibold hover:underline">← Home</NuxtLink>
          <h1 class="mt-1 mb-0 text-2xl text-accent-dark">Host Dashboard</h1>
          <p class="text-text-muted text-sm mt-1">Hey {{ auth.state.user?.displayName }}! Your hunts, your rules.</p>
        </div>
        <button class="px-3.5 py-1.5 border-2 border-border rounded-[10px] cursor-pointer bg-surface text-xs font-semibold transition-all hover:border-accent hover:text-accent" @click="auth.logout()">Logout</button>
      </header>

      <!-- Create Hunt -->
      <div class="bg-surface border-2 border-border rounded-[18px] p-6 mb-7">
        <h2 class="m-0 mb-3.5 text-lg">Create a New Hunt</h2>
        <form @submit.prevent="createHunt" class="flex flex-col gap-2.5">
          <input
            v-model="newHuntName"
            type="text"
            placeholder="Hunt name (e.g. Copenhagen Bar Crawl)"
            class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent"
            required
          />
          <div class="grid grid-cols-3 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lat</span>
              <input v-model="newLat" inputmode="decimal" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" required />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lng</span>
              <input v-model="newLng" inputmode="decimal" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" required />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Radius (m)</span>
              <input v-model="newRadius" inputmode="numeric" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" />
            </label>
          </div>
          <!-- Location picker map -->
          <div>
            <span class="text-xs text-text-muted italic">Click the map to set the hunt center</span>
            <div ref="pickerMapEl" class="h-[280px] w-full rounded-xl overflow-hidden border-2 border-border mt-1.5"></div>
          </div>

          <div v-if="createError" class="px-3 py-2 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ createError }}</div>
          <button type="submit" class="px-6 py-3 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-[15px] transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed" :disabled="creating">
            {{ creating ? "Creating..." : "🐔 Create Hunt" }}
          </button>
        </form>
      </div>

      <!-- My Hunts -->
      <div>
        <h2 class="m-0 mb-3.5 text-lg">My Hunts</h2>

        <div v-if="huntsLoading" class="text-center py-5 text-text-muted">Loading hunts...</div>

        <div v-else-if="hunts.length === 0" class="text-center py-7 border-2 border-dashed border-border rounded-2xl text-text-muted">
          <p class="m-0">🐔 No hunts yet. Create your first one above!</p>
        </div>

        <div v-else class="flex flex-col gap-3">
          <HuntCard
            v-for="h in hunts"
            :key="h.id"
            :hunt="h"
            @copy="copyCode"
          />
        </div>
      </div>
    </template>

    <!-- Copied toast -->
    <Teleport to="body">
      <div v-if="showCopied" class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-text text-white rounded-[10px] text-sm font-semibold z-[9999] animate-slide-up">Copied!</div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { HuntWithRole } from "~/types";

const auth = useAuth();
const router = useRouter();

const hunts = ref<HuntWithRole[]>([]);
const huntsLoading = ref(true);

// Create hunt form
const newHuntName = ref("");
const newLat = ref("55.678831");
const newLng = ref("12.579570");
const newRadius = ref("1500");
const createError = ref("");
const creating = ref(false);

const showCopied = ref(false);

// ── Location picker ──────────────────────────────────────
const pickerMapEl = ref<HTMLDivElement | null>(null);
const { initPicker, placePin, updateRadius, cleanupPicker, setOnLocationPicked } = useLocationPicker();

// When map is clicked, update the form inputs
setOnLocationPicked((lat, lng) => {
  newLat.value = lat.toFixed(6);
  newLng.value = lng.toFixed(6);
  updateRadius(parseInt(newRadius.value) || 1500);
});

// When radius input changes, update the circle preview
watch(newRadius, (val) => {
  const r = parseInt(val) || 1500;
  updateRadius(r);
});

onMounted(() => {
  auth.restore();
  if (auth.isHost.value) {
    loadHunts();
  }
  // Init picker map
  nextTick(() => {
    if (pickerMapEl.value) {
      const lat = parseFloat(newLat.value) || 55.678831;
      const lng = parseFloat(newLng.value) || 12.579570;
      initPicker(pickerMapEl.value, { lat, lng }, parseInt(newRadius.value) || 1500);
    }
  });
});

onUnmounted(() => {
  cleanupPicker();
});

async function loadHunts() {
  huntsLoading.value = true;
  try {
    const res = await auth.authFetch<{ hunts: HuntWithRole[] }>("/api/hunts");
    hunts.value = res.hunts;
  } catch {
    // silent
  } finally {
    huntsLoading.value = false;
  }
}

async function createHunt() {
  createError.value = "";
  creating.value = true;
  try {
    const res = await auth.authFetch<{ hunt: HuntWithRole }>("/api/hunts", {
      method: "POST",
      body: {
        name: newHuntName.value.trim(),
        centerLat: Number(newLat.value),
        centerLng: Number(newLng.value),
        radiusMeters: Number(newRadius.value) || 1500,
      },
    });

    // Add to list
    hunts.value.unshift({
      ...res.hunt,
      role: "creator",
    });

    // Clear form
    newHuntName.value = "";
  } catch (e: any) {
    createError.value = e?.data?.message || e?.message || "Failed to create hunt";
  } finally {
    creating.value = false;
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    showCopied.value = true;
    setTimeout(() => (showCopied.value = false), 1500);
  } catch {
    // fallback
  }
}

</script>
