<template>
  <li
    class="grid grid-cols-[1fr_auto] gap-2.5 border-2 rounded-[14px] p-3 bg-surface transition-all cursor-pointer"
    :class="{
      'border-accent bg-[#fff8f0] scale-[1.01] shadow-md': selected,
      'border-green bg-[#f0faf4] opacity-75': !selected && bar.checkStatus === 'checked',
      'border-gray bg-[#f5f5f5] opacity-50': !selected && bar.checkStatus === 'not_checking',
      'border-border': !selected && bar.checkStatus === 'unchecked',
    }"
    :data-bar-id="bar.id"
    @click="$emit('select', bar)"
  >
    <!-- Bar info -->
    <div>
      <div class="text-[15px] leading-snug font-medium">{{ bar.name }}</div>
      <div class="text-[13px] text-text-muted mt-0.5">{{ bar.address }}</div>
      <a
        :href="bar.mapsUrl"
        target="_blank"
        rel="noreferrer"
        class="text-xs no-underline text-accent font-semibold hover:underline mt-1 inline-block"
        @click.stop
      >Open in Maps</a>
    </div>

    <!-- Status or action buttons (right side) -->
    <div class="flex flex-col gap-1.5 items-end justify-center">
      <template v-if="bar.checkStatus === 'checked'">
        <span class="text-xs font-semibold text-green whitespace-nowrap">Visited and checked</span>
      </template>
      <template v-else>
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all whitespace-nowrap min-w-[100px] text-center"
          :class="'border-green/40 bg-[#f0faf4] text-green hover:border-green hover:bg-green/10'"
          @click.stop="$emit('toggle', bar, 'checked')"
        >{{ labels.checked }}</button>
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all whitespace-nowrap min-w-[100px] text-center"
          :class="bar.checkStatus === 'not_checking'
            ? 'border-gray bg-gray text-white'
            : 'border-border bg-bg text-text-muted hover:border-gray hover:bg-gray/10'"
          @click.stop="$emit('toggle', bar, 'not_checking')"
        >{{ bar.checkStatus === 'not_checking' ? labels.notCheckingActive : labels.not_checking }}</button>
      </template>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { HuntBar } from "~/types";

withDefaults(
  defineProps<{
    bar: HuntBar;
    selected?: boolean;
    labels?: { checked: string; checkedActive: string; not_checking: string; notCheckingActive: string };
  }>(),
  {
    selected: false,
    labels: () => ({
      checked: "Check In",
      checkedActive: "Checked In",
      not_checking: "Maybe Skip",
      notCheckingActive: "Unskip",
    }),
  }
);
defineEmits<{
  toggle: [bar: HuntBar, target: string];
  select: [bar: HuntBar];
}>();
</script>
