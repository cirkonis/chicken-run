<template>
  <div v-if="hints.length || showWhenEmpty">
    <div class="bg-[#fff8e1] border-2 border-dashed border-chicken-yellow rounded-[14px] p-3 mb-3">
      <div class="flex justify-between items-center font-semibold text-sm">
        <span>Chicken hints <span v-if="hints.length" class="font-normal text-text-muted text-xs">({{ hints.length }})</span></span>
        <button
          class="px-3 py-1.5 border-2 border-border rounded-[10px] cursor-pointer bg-surface text-xs font-semibold transition-all hover:border-accent hover:text-accent"
          @click="toggle"
        >{{ collapsed ? "Show hints" : "Hide hints" }}<span v-if="notification" class="inline-block w-2 h-2 rounded-full bg-red ml-1 animate-pulse align-middle"></span></button>
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
            <MediaImage
              v-if="h.imagePath"
              :path="h.imagePath"
              alt="Hint photo"
              class="max-h-48 rounded-lg object-cover cursor-pointer border border-chicken-yellow/30"
              loading="lazy"
              @click="fullImagePath = h.imagePath"
            />
          </li>
        </ul>
        <p v-else class="mt-2 text-[13px] text-text-muted italic">No hints yet. The chickens are silent...</p>
      </template>
    </div>

    <!-- Fullscreen image viewer -->
    <Teleport to="body">
      <div
        v-if="fullImagePath"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] cursor-pointer p-4"
        @click="fullImagePath = null"
      >
        <MediaImage :path="fullImagePath" class="max-w-full max-h-full object-contain rounded-lg" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Hint } from "~/types";

const props = withDefaults(
  defineProps<{
    hints: Hint[];
    showWhenEmpty?: boolean;
    collapsed?: boolean;
    notification?: boolean;
  }>(),
  {
    collapsed: false,
    notification: false,
  }
);

const emit = defineEmits<{
  "update:collapsed": [value: boolean];
}>();

const fullImagePath = ref<string | null>(null);

function toggle() {
  emit("update:collapsed", !props.collapsed);
}

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
