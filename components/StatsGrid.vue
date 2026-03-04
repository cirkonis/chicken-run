<template>
  <div v-if="total > 0" class="grid grid-cols-4 gap-2 mb-3">
    <div class="bg-surface border-2 border-border rounded-xl p-2.5 text-center">
      <span class="block text-xl font-bold">{{ counts.unchecked }}</span>
      <span class="block text-[11px] text-text-muted uppercase tracking-wide mt-0.5">To check</span>
    </div>
    <div class="bg-surface border-2 border-green rounded-xl p-2.5 text-center">
      <span class="block text-xl font-bold">{{ counts.checked }}</span>
      <span class="block text-[11px] text-text-muted uppercase tracking-wide mt-0.5">Visited</span>
    </div>
    <div class="bg-surface border-2 border-gray rounded-xl p-2.5 text-center">
      <span class="block text-xl font-bold">{{ counts.not_checking }}</span>
      <span class="block text-[11px] text-text-muted uppercase tracking-wide mt-0.5">Skipping</span>
    </div>
    <div class="bg-surface border-2 border-accent rounded-xl p-2.5 text-center">
      <span class="block text-xl font-bold">{{ counts.checked }}</span>
      <span class="block text-[11px] text-text-muted uppercase tracking-wide mt-0.5">Drinks deep</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  counts: { unchecked: number; checked: number; not_checking: number };
}>();

const total = computed(
  () => props.counts.unchecked + props.counts.checked + props.counts.not_checking
);
</script>
