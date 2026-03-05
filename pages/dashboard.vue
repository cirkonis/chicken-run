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
      <NuxtLink
        to="/dashboard/create"
        class="flex items-center justify-center gap-2 w-full px-6 py-4 mb-7 border-2 border-dashed border-accent rounded-[18px] bg-surface text-accent font-bold text-base no-underline transition-all hover:bg-accent hover:text-white hover:border-solid"
      >
        + Create a New Hunt
      </NuxtLink>

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

const hunts = ref<HuntWithRole[]>([]);
const huntsLoading = ref(true);
const showCopied = ref(false);

onMounted(() => {
  auth.restore();
  if (auth.isHost.value) {
    loadHunts();
  }
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
