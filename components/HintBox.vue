<template>
  <div>
    <div
      v-if="hints.length || showWhenEmpty"
      class="bg-[#fff8e1] border-2 border-dashed border-chicken-yellow rounded-[14px] p-3 mb-3"
    >
      <div class="flex justify-between items-center font-semibold text-sm">
        <span>Chicken hints</span>
        <button
          class="px-3 py-1.5 border-2 border-border rounded-[10px] cursor-pointer bg-surface text-xs font-semibold transition-all hover:border-accent hover:text-accent"
          @click="showInput = !showInput"
        >+ Add hint</button>
      </div>
      <ul v-if="hints.length" class="mt-2 pl-5 text-sm">
        <li
          v-for="h in hints"
          :key="h.id"
          class="mb-1 flex justify-between items-baseline gap-2"
        >
          <span>{{ h.text }}</span>
          <span class="text-[11px] text-text-muted opacity-70 whitespace-nowrap">
            {{ h.authorName }} · {{ formatTime(h.createdAt) }}
          </span>
        </li>
      </ul>
      <p v-else class="mt-2 text-[13px] text-text-muted italic">No hints yet. The chickens are silent...</p>
    </div>

    <div v-if="showInput" class="flex gap-2 mb-3">
      <input
        v-model="newHintText"
        placeholder="What did the chickens say?"
        class="flex-1 px-2.5 py-2 border-2 border-border rounded-[10px] text-sm focus:outline-none focus:border-chicken-yellow"
        @keyup.enter="submitHint"
      />
      <button
        class="px-3 py-1.5 border-2 border-border rounded-[10px] cursor-pointer bg-surface text-xs font-semibold transition-all hover:border-accent hover:text-accent"
        @click="submitHint"
      >Add</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Hint } from "~/types";

const props = defineProps<{
  hints: Hint[];
  showWhenEmpty?: boolean;
}>();

const emit = defineEmits<{ addHint: [text: string] }>();

const showInput = ref(false);
const newHintText = ref("");

function submitHint() {
  const text = newHintText.value.trim();
  if (!text) return;
  emit("addHint", text);
  newHintText.value = "";
  showInput.value = false;
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
