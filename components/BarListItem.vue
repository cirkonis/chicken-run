<template>
  <li
    class="grid grid-cols-[1fr_auto] gap-2.5 border-2 rounded-[14px] p-3 bg-surface transition-all"
    :class="{
      'border-green bg-[#f0faf4] opacity-75': bar.checkStatus === 'checked',
      'border-gray bg-[#f5f5f5] opacity-50': bar.checkStatus === 'not_checking',
      'border-border': bar.checkStatus === 'unchecked',
    }"
  >
    <div>
      <div class="text-[15px] leading-snug">{{ bar.name }}</div>
      <div class="text-[13px] text-text-muted mt-0.5">{{ bar.address }}</div>
      <div class="mt-1 text-xs text-text-muted">
        <span v-if="bar.rating">{{ bar.rating }}</span>
        <span v-if="bar.ratingsTotal" class="opacity-70">({{ bar.ratingsTotal }})</span>
        <span v-if="bar.priceLevel">{{ '$'.repeat(bar.priceLevel) }}</span>
      </div>
    </div>
    <div class="flex flex-col items-end gap-2">
      <div class="flex gap-1">
        <button
          class="w-[34px] h-[34px] border-2 rounded-[10px] cursor-pointer bg-surface text-base flex items-center justify-center transition-all opacity-50 hover:opacity-100 hover:scale-110"
          :class="bar.checkStatus === 'checked' ? 'opacity-100 scale-105 border-green bg-[#f0faf4]' : 'border-border'"
          @click="$emit('toggle', bar, 'checked')"
          title="Mark as visited"
        >&#10003;</button>
        <button
          class="w-[34px] h-[34px] border-2 rounded-[10px] cursor-pointer bg-surface text-base flex items-center justify-center transition-all opacity-50 hover:opacity-100 hover:scale-110"
          :class="bar.checkStatus === 'not_checking' ? 'opacity-100 scale-105 border-gray bg-[#f0f0f0]' : 'border-border'"
          @click="$emit('toggle', bar, 'not_checking')"
          title="Skip this one"
        >&#10005;</button>
      </div>
      <a :href="bar.mapsUrl" target="_blank" rel="noreferrer" class="text-xs no-underline text-accent font-semibold hover:underline">Maps</a>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { HuntBar } from "~/types";

defineProps<{ bar: HuntBar }>();
defineEmits<{ toggle: [bar: HuntBar, target: string] }>();
</script>
