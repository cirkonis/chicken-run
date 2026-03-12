<template>
  <div v-if="hints.length || showWhenEmpty">
    <div class="bg-[#fff8e1] border-2 border-dashed border-chicken-yellow rounded-[14px] p-3 mb-3">
      <div class="flex justify-between items-center font-semibold text-sm">
        <span>Chicken hints</span>
        <button
          class="px-3 py-1.5 border-2 border-border rounded-[10px] cursor-pointer bg-surface text-xs font-semibold transition-all hover:border-accent hover:text-accent"
          @click="collapsed = !collapsed"
        >{{ collapsed ? "Show hints" : "Hide hints" }}</button>
      </div>
      <template v-if="!collapsed">
        <ul v-if="hints.length" class="list-none p-0 mt-2 text-sm flex flex-col gap-1.5">
          <li
            v-for="h in hints"
            :key="h.id"
            class="flex flex-col gap-1.5 px-3 py-2 bg-white/60 rounded-lg"
          >
            <div class="flex justify-between items-baseline gap-2">
              <span>{{ h.text }}</span>
              <span class="text-[11px] text-text-muted opacity-70 whitespace-nowrap">
                {{ h.authorName }} · {{ formatTime(h.createdAt) }}
              </span>
            </div>
            <img
              v-if="h.imageUrl"
              :src="h.imageUrl"
              alt="Hint photo"
              class="max-h-48 rounded-lg object-cover cursor-pointer border border-chicken-yellow/30"
              loading="lazy"
              @click="fullImageUrl = h.imageUrl"
            />
          </li>
        </ul>
        <p v-else class="mt-2 text-[13px] text-text-muted italic">No hints yet. The chickens are silent...</p>
      </template>
    </div>

    <!-- Fullscreen image viewer -->
    <Teleport to="body">
      <div
        v-if="fullImageUrl"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] cursor-pointer p-4"
        @click="fullImageUrl = null"
      >
        <img :src="fullImageUrl" class="max-w-full max-h-full object-contain rounded-lg" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Hint } from "~/types";

defineProps<{
  hints: Hint[];
  showWhenEmpty?: boolean;
}>();

const collapsed = ref(false);
const fullImageUrl = ref<string | null>(null);

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
</script>
