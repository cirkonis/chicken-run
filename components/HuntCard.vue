<template>
  <div class="bg-surface border-2 border-border rounded-2xl p-[18px]">
    <!-- Name + Status -->
    <div class="flex justify-between items-center mb-3">
      <div class="font-bold text-base">{{ hunt.name }}</div>
      <span
        class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide"
        :class="{
          'bg-[#e8f5e9] text-green': hunt.status === 'active',
          'bg-[#e3f2fd] text-[#1976d2]': hunt.status === 'completed',
          'bg-[#f5f5f5] text-gray': hunt.status === 'archived',
        }"
      >{{ hunt.status }}</span>
    </div>

    <!-- Codes (stacked) -->
    <div class="flex flex-col gap-2 mb-3">
      <div class="flex items-center gap-1.5 px-3 py-2.5 bg-bg border-2 border-border rounded-[10px]">
        <span class="text-[10px] text-text-muted whitespace-nowrap">Hunter Code</span>
        <span class="font-extrabold text-base tracking-[2px] text-accent-dark flex-1">{{ hunt.hunterCode }}</span>
        <button class="bg-transparent border-none cursor-pointer text-sm p-0.5 opacity-50 transition-opacity hover:opacity-100" @click="$emit('copy', hunt.hunterCode)" title="Copy">Copy</button>
      </div>
      <div class="flex items-center gap-1.5 px-3 py-2.5 bg-[#fff8e1] border-2 border-chicken-yellow rounded-[10px]">
        <span class="text-[10px] text-text-muted whitespace-nowrap">Chicken Code</span>
        <span class="font-extrabold text-base tracking-[2px] text-accent-dark flex-1">{{ hunt.chickenCode }}</span>
        <button class="bg-transparent border-none cursor-pointer text-sm p-0.5 opacity-50 transition-opacity hover:opacity-100" @click="$emit('copy', hunt.chickenCode)" title="Copy">Copy</button>
      </div>
    </div>

    <!-- Meta -->
    <div class="flex gap-3 text-xs text-text-muted mb-3">
      <span>{{ hunt.centerLat.toFixed(4) }}, {{ hunt.centerLng.toFixed(4) }}</span>
      <span>{{ hunt.radiusMeters }}m radius</span>
      <span>{{ formatDate(hunt.createdAt) }}</span>
    </div>

    <!-- Manage button -->
    <NuxtLink
      :to="`/dashboard/edit/${hunt.id}`"
      class="block text-center py-2.5 border-2 border-accent rounded-xl text-accent font-semibold text-sm no-underline transition-all hover:bg-accent hover:text-white"
    >
      Manage Hunt →
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { HuntWithRole } from "~/types";

defineProps<{ hunt: HuntWithRole }>();
defineEmits<{
  copy: [code: string];
}>();

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
