<template>
  <div v-if="total > 0" class="grid grid-cols-3 gap-2 mb-3">
    <div class="bg-surface border-2 border-border rounded-xl p-2.5 text-center">
      <span class="block text-xl font-bold">{{ counts.unchecked }}</span>
      <span class="block text-[11px] text-text-muted uppercase tracking-wide mt-0.5">{{ labels.unchecked }}</span>
    </div>
    <div class="bg-surface border-2 border-green rounded-xl p-2.5 text-center">
      <span class="block text-xl font-bold">{{ counts.checked }}</span>
      <span class="block text-[11px] text-text-muted uppercase tracking-wide mt-0.5">{{ labels.checked }}</span>
    </div>
    <div class="bg-surface border-2 border-gray rounded-xl p-2.5 text-center">
      <span class="block text-xl font-bold">{{ counts.not_checking }}</span>
      <span class="block text-[11px] text-text-muted uppercase tracking-wide mt-0.5">{{ labels.not_checking }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    counts: { unchecked: number; checked: number; not_checking: number };
    labels?: { unchecked: string; checked: string; not_checking: string };
  }>(),
  {
    labels: () => ({ unchecked: "To check", checked: "Visited", not_checking: "Maybe skip" }),
  }
);

const total = computed(
  () => props.counts.unchecked + props.counts.checked + props.counts.not_checking
);
</script>
