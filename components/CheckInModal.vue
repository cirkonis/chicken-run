<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] backdrop-blur-sm p-4"
      @click.self="close"
    >
      <div class="bg-surface rounded-[20px] p-6 w-[420px] max-w-[90vw] shadow-[0_16px_48px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="mb-4">
          <div class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-0.5">Check in at</div>
          <div class="text-lg font-bold text-accent-dark">{{ barName }}</div>
        </div>

        <!-- Photo input (required) -->
        <div class="mb-3">
          <label class="text-[13px] font-semibold text-text-muted block mb-1">Photo <span class="text-red">(required)</span></label>
          <div v-if="imagePreview" class="relative inline-block mb-2">
            <img :src="imagePreview" class="max-h-40 rounded-xl border-2 border-green/30 object-cover" />
            <button
              class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red text-white text-xs font-bold border-0 cursor-pointer flex items-center justify-center hover:bg-red/80"
              @click="clearImage"
            >&times;</button>
          </div>
          <div v-else>
            <button
              class="px-4 py-2 border-2 border-dashed border-green/40 rounded-xl bg-white text-sm text-text-muted cursor-pointer transition-all hover:border-green hover:text-green"
              @click="fileInput?.click()"
            >Choose photo...</button>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileSelected"
          />
        </div>

        <!-- Note input (optional) -->
        <div class="mb-3">
          <label class="text-[13px] font-semibold text-text-muted block mb-1">Note <span class="font-normal">(optional)</span></label>
          <input
            v-model="note"
            type="text"
            placeholder="Quick note about the visit..."
            class="w-full px-3 py-2 border-2 border-border rounded-xl text-sm bg-bg focus:outline-none focus:border-green"
            maxlength="200"
          />
        </div>

        <!-- Team selector (optional, hidden if no other teams) — pick any number -->
        <div v-if="teams.length > 0" class="mb-3">
          <label class="text-[13px] font-semibold text-text-muted block mb-1">Ran into other teams? <span class="font-normal">(optional)</span></label>
          <div class="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
            <label
              v-for="t in teams"
              :key="t.id"
              class="flex items-center gap-2 text-sm cursor-pointer px-3 py-2 border-2 border-border rounded-xl bg-bg"
            >
              <input type="checkbox" :value="t.id" v-model="withTeamIds" class="accent-green w-4 h-4" />
              {{ t.name }}
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2.5">
          <button
            class="flex-1 px-4 py-2.5 border-2 border-border rounded-xl cursor-pointer bg-surface text-text-muted font-semibold text-sm transition-all hover:border-accent hover:text-accent"
            @click="close"
          >Cancel</button>
          <button
            class="flex-1 px-4 py-2.5 border-0 rounded-xl cursor-pointer bg-green text-white font-semibold text-sm transition-colors hover:bg-green/90 disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="!image || loading"
            @click="submit"
          >
            <template v-if="loading">Checking in...</template>
            <template v-else>Check In</template>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Team } from "~/types";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    barName: string;
    teams: Team[];
    loading?: boolean;
  }>(),
  { loading: false }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  submit: [payload: { note: string; image: File; withTeamIds: string[] }];
}>();

// Internal state
const note = ref("");
const image = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const withTeamIds = ref<string[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  image.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

function clearImage() {
  image.value = null;
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value);
    imagePreview.value = null;
  }
  if (fileInput.value) fileInput.value.value = "";
}

function resetState() {
  note.value = "";
  clearImage();
  withTeamIds.value = [];
}

function close() {
  resetState();
  emit("update:modelValue", false);
}

function submit() {
  if (!image.value) return;
  emit("submit", {
    note: note.value,
    image: image.value,
    withTeamIds: withTeamIds.value,
  });
}

// Reset state when modal closes externally (e.g. v-model set to false)
watch(() => props.modelValue, (open) => {
  if (!open) resetState();
});
</script>
