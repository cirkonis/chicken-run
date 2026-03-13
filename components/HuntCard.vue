<template>
  <div class="bg-surface border-2 border-border rounded-2xl p-[18px]">
    <!-- Name + Status -->
    <div class="flex justify-between items-center mb-3">
      <div class="font-bold text-base">{{ hunt.name }}</div>
      <div class="flex items-center gap-2">
        <HuntTimer v-if="hunt.startedAt" :started-at="hunt.startedAt" :ended-at="hunt.completedAt" />
        <span
          class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide"
          :class="{
            'bg-[#fff8e1] text-amber-700': hunt.status === 'preparing',
            'bg-[#e8f5e9] text-green': hunt.status === 'active',
            'bg-[#f5f5f5] text-gray': hunt.status === 'completed',
          }"
        >{{ statusLabel }}</span>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-4 gap-2 mb-3">
      <div class="flex flex-col items-center py-2.5 bg-bg border-2 border-border rounded-xl">
        <span class="text-lg font-bold text-accent-dark">{{ hunt.teamCount }}</span>
        <span class="text-[10px] text-text-muted mt-0.5">Teams</span>
      </div>
      <div class="flex flex-col items-center py-2.5 bg-bg border-2 border-border rounded-xl">
        <span class="text-lg font-bold text-accent-dark">{{ hunt.memberCount }}</span>
        <span class="text-[10px] text-text-muted mt-0.5">Hunters</span>
      </div>
      <div class="flex flex-col items-center py-2.5 bg-bg border-2 border-border rounded-xl">
        <span class="text-lg font-bold text-accent-dark">{{ hunt.barCount }}</span>
        <span class="text-[10px] text-text-muted mt-0.5">Bars</span>
      </div>
      <div class="flex flex-col items-center py-2.5 bg-bg border-2 border-border rounded-xl">
        <span class="text-lg font-bold text-accent-dark">{{ hunt.budget != null ? `${hunt.budget}` : '—' }}</span>
        <span class="text-[10px] text-text-muted mt-0.5">Budget</span>
      </div>
    </div>

    <!-- Meta -->
    <div class="flex gap-3 text-xs text-text-muted mb-3">
      <span>{{ formatDate(hunt.createdAt) }}</span>
      <span v-if="hunt.status === 'completed' && daysUntilRemoval != null" class="text-red/70">
        Auto-removes in {{ daysUntilRemoval }} day{{ daysUntilRemoval !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-2">
      <NuxtLink
        :to="`/dashboard/edit/${hunt.id}`"
        class="flex-1 block text-center py-2.5 border-2 border-accent rounded-xl text-accent font-semibold text-sm no-underline transition-all hover:bg-accent hover:text-white"
      >
        Manage Hunt →
      </NuxtLink>
      <NuxtLink
        v-if="hunt.status === 'completed'"
        :to="`/hunt/${hunt.id}/results`"
        class="px-4 py-2.5 border-2 border-green rounded-xl text-green font-semibold text-sm no-underline transition-all hover:bg-green hover:text-white"
      >View Results</NuxtLink>
      <button
        v-if="hunt.status === 'preparing'"
        type="button"
        class="px-4 py-2.5 border-0 rounded-xl cursor-pointer bg-green text-white font-bold text-sm transition-colors hover:bg-green/90"
        @click="showStartModal = true"
      >Start</button>
      <button
        v-if="hunt.status === 'active'"
        type="button"
        class="px-4 py-2.5 border-2 border-border rounded-xl cursor-pointer bg-surface text-text font-semibold text-sm transition-all hover:border-red hover:text-red"
        @click="showEndModal = true"
      >End Hunt</button>
    </div>

    <!-- Start Hunt modal -->
    <ConfirmModal
      v-model="showStartModal"
      title="Start this hunt?"
      message="Once started, the hunt name, budget, hunting grounds, teams, and bars will be locked. Players can begin hunting!"
      confirm-label="Start Hunt"
      :loading="actionLoading"
      @confirm="doStart"
    />

    <!-- End Hunt modal -->
    <ConfirmModal
      v-model="showEndModal"
      title="End this hunt?"
      message="The hunt will be marked as completed. All data will be preserved."
      confirm-label="End Hunt"
      :loading="actionLoading"
      @confirm="doEnd"
    />
  </div>
</template>

<script setup lang="ts">
import type { HuntWithRole } from "~/types";

const auth = useAuth();

const props = defineProps<{ hunt: HuntWithRole }>();
const emit = defineEmits<{ updated: [] }>();

const showStartModal = ref(false);
const showEndModal = ref(false);
const actionLoading = ref(false);

const daysUntilRemoval = computed(() => {
  if (props.hunt.status !== "completed" || !props.hunt.completedAt) return null;
  const completedMs = new Date(props.hunt.completedAt).getTime();
  const expiresMs = completedMs + 90 * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(remaining, 0);
});

const statusLabel = computed(() => {
  switch (props.hunt.status) {
    case "preparing": return "Preparing";
    case "active": return "Running";
    case "completed": return "Completed";
    default: return props.hunt.status;
  }
});

async function doStart() {
  actionLoading.value = true;
  try {
    const res = await auth.authFetch<{ hunt: any }>(`/api/hunts/${props.hunt.id}/status`, {
      method: "PATCH",
      body: { status: "active" },
    });
    props.hunt.status = "active";
    props.hunt.startedAt = res.hunt?.startedAt ?? new Date().toISOString();
    showStartModal.value = false;
    emit("updated");
  } catch {
    // silent — user can retry
  } finally {
    actionLoading.value = false;
  }
}

async function doEnd() {
  actionLoading.value = true;
  try {
    await auth.authFetch(`/api/hunts/${props.hunt.id}/status`, {
      method: "PATCH",
      body: { status: "completed" },
    });
    props.hunt.status = "completed";
    showEndModal.value = false;
    emit("updated");
  } catch {
    // silent — user can retry
  } finally {
    actionLoading.value = false;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return "";
  }
}
</script>
