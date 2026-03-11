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
