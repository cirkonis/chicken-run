<template>
  <div class="fixed inset-0 bg-bg z-50 flex flex-col">
    <!-- Header -->
    <div class="px-4 pt-5 pb-3">
      <h1 class="m-0 text-xl text-accent-dark text-center">Pick Your Coop</h1>
      <p class="text-sm text-text-muted text-center mt-1 mb-0">
        Choose the bar where the chickens will be hiding. This choice is <strong>permanent</strong> and <strong>secret</strong> until the hunt ends!
      </p>
    </div>

    <!-- Search -->
    <div class="px-4 mb-3">
      <input
        ref="searchInput"
        v-model="search"
        type="text"
        placeholder="Search bars..."
        class="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-surface outline-none transition-colors focus:border-accent"
      />
    </div>

    <!-- Bar list -->
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <div v-if="filteredBars.length === 0" class="text-center py-8 text-text-muted text-sm">
        No bars match your search
      </div>
      <div class="flex flex-col gap-2">
        <button
          v-for="bar in filteredBars"
          :key="bar.id"
          type="button"
          class="w-full text-left px-4 py-3.5 bg-surface border-2 rounded-xl cursor-pointer transition-all"
          :class="selectedBar?.id === bar.id
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent/50'"
          @click="selectBar(bar)"
        >
          <div class="font-semibold text-sm">{{ bar.name }}</div>
          <div class="text-xs text-text-muted mt-0.5">{{ bar.address }}</div>
          <div v-if="bar.category" class="text-[11px] text-accent mt-1 font-medium">{{ bar.category }}</div>
        </button>
      </div>
    </div>

    <!-- Confirm button (sticky bottom) -->
    <div v-if="selectedBar" class="px-4 pb-5 pt-3 bg-bg border-t-2 border-border">
      <button
        type="button"
        class="w-full py-3.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-sm transition-colors hover:bg-accent-dark"
        :disabled="loading"
        @click="showConfirm = true"
      >{{ loading ? 'Saving...' : `Select ${selectedBar.name}` }}</button>
    </div>

    <!-- Confirmation dialog -->
    <ConfirmModal
      v-model="showConfirm"
      title="Are you absolutely sure?"
      :message="`You are choosing <strong>${selectedBar?.name ?? ''}</strong> as your coop. This choice is <strong>permanent</strong> and cannot be changed!`"
      confirm-label="Lock it in"
      :loading="loading"
      @confirm="confirmSelection"
    />
  </div>
</template>

<script setup lang="ts">
import type { HuntBar } from "~/types";

const props = defineProps<{
  bars: HuntBar[];
}>();

const emit = defineEmits<{
  selected: [barId: string];
}>();

const search = ref("");
const selectedBar = ref<HuntBar | null>(null);
const showConfirm = ref(false);
const loading = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);

const filteredBars = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return props.bars;
  return props.bars.filter(
    (b) => b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
  );
});

function selectBar(bar: HuntBar) {
  selectedBar.value = bar;
}

function confirmSelection() {
  if (!selectedBar.value) return;
  loading.value = true;
  emit("selected", selectedBar.value.id);
}

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
});
</script>
