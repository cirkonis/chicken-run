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

      <!-- Create New Hunt CTA -->
      <div class="mb-7">
        <NuxtLink
          v-if="huntCount < maxHunts"
          to="/dashboard/create"
          class="flex items-center justify-center gap-2 w-full px-6 py-4 border-2 border-dashed border-accent rounded-[18px] bg-surface text-accent font-bold text-base no-underline transition-all hover:bg-accent hover:text-white hover:border-solid"
        >
          + Create a New Hunt
        </NuxtLink>
        <div
          v-else
          class="flex items-center justify-center gap-2 w-full px-6 py-4 border-2 border-dashed border-border rounded-[18px] bg-bg text-text-muted font-bold text-base cursor-not-allowed"
        >
          Hunt limit reached
        </div>
        <div class="flex justify-between items-center mt-2 px-1">
          <span class="text-xs text-text-muted">{{ huntCount }} / {{ maxHunts }} hunts used</span>
          <span class="text-[11px] text-text-muted italic">Completed hunts auto-remove after 90 days</span>
        </div>
      </div>

      <!-- My Hunts -->
      <div>
        <h2 class="m-0 mb-3.5 text-lg">My Hunts</h2>

        <div v-if="huntsLoading" class="text-center py-5 text-text-muted">Loading hunts...</div>

        <div v-else-if="hunts.length === 0" class="text-center py-7 border-2 border-dashed border-border rounded-2xl text-text-muted">
          <p class="m-0">🐔 No hunts yet. Create your first one!</p>
        </div>

        <div v-else class="flex flex-col gap-3">
          <HuntCard
            v-for="h in hunts"
            :key="h.id"
            :hunt="h"
          />
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import type { HuntWithRole } from "~/types";

const auth = useAuth();

const hunts = ref<HuntWithRole[]>([]);
const huntsLoading = ref(true);
const huntCount = ref(0);
const maxHunts = ref(3);

onMounted(async () => {
  await auth.restore();
  if (auth.isHost.value) {
    loadHunts();
  }
});

async function loadHunts() {
  huntsLoading.value = true;
  try {
    const res = await auth.authFetch<{ hunts: HuntWithRole[]; huntCount: number; maxHunts: number }>("/api/hunts");
    hunts.value = res.hunts;
    huntCount.value = res.huntCount ?? 0;
    maxHunts.value = res.maxHunts ?? 3;
  } catch {
    // silent
  } finally {
    huntsLoading.value = false;
  }
}

</script>
