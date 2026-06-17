<template>
  <div class="fixed inset-0 bg-bg z-50 flex flex-col">
    <!-- Header -->
    <div class="px-4 pt-5 pb-3">
      <h1 class="m-0 text-xl text-accent-dark text-center">Pick Your Coop</h1>
      <p class="text-sm text-text-muted text-center mt-1 mb-0">
        Choose the bar where the chickens will be hiding. This choice is <strong>permanent</strong> and <strong>secret</strong> until the hunt ends!
      </p>
    </div>

    <!-- Search -->
    <div class="px-4 mb-3">
      <input
        ref="searchInput"
        v-model="search"
        type="text"
        placeholder="Search bars..."
        class="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-surface outline-none transition-colors focus:border-accent"
      />
    </div>

    <!-- Add a bar that isn't in the list -->
    <div class="px-4 mb-3">
      <button
        v-if="!showAddForm"
        type="button"
        class="text-sm font-semibold text-accent hover:text-accent-dark cursor-pointer bg-transparent border-0 p-0"
        @click="showAddForm = true"
      >+ Add a bar that's not listed</button>
      <div v-else class="flex flex-col gap-2 p-3 border-2 border-accent/30 rounded-xl bg-accent/5">
        <input v-model="addName" type="text" placeholder="Bar name" class="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-accent" />
        <input v-model="addAddress" type="text" placeholder="Address" class="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-accent" />
        <div class="flex gap-2">
          <button type="button" class="px-3 py-2 rounded-lg text-xs font-semibold border-0 bg-accent text-white cursor-pointer disabled:opacity-50" :disabled="!addName.trim()" @click="submitAdd">Add bar</button>
          <button type="button" class="px-3 py-2 rounded-lg text-xs font-semibold border-2 border-border bg-surface text-text-muted cursor-pointer" @click="cancelAdd">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Bar list -->
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <div v-if="filteredBars.length === 0" class="text-center py-8 text-text-muted text-sm">
        No bars match your search
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="bar in filteredBars"
          :key="bar.id"
          class="px-4 py-3.5 bg-surface border-2 rounded-xl transition-all"
          :class="selectedBar?.id === bar.id ? 'border-accent bg-accent/5' : 'border-border'"
        >
          <!-- Inline edit form: fix a wrong name / address -->
          <div v-if="editingId === bar.id" class="flex flex-col gap-2">
            <input v-model="editName" type="text" placeholder="Bar name" class="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-bg focus:outline-none focus:border-accent" />
            <input v-model="editAddress" type="text" placeholder="Address" class="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-bg focus:outline-none focus:border-accent" />
            <div class="flex gap-2">
              <button type="button" class="px-3 py-1.5 rounded-lg text-xs font-semibold border-0 bg-accent text-white cursor-pointer" @click="saveEdit(bar)">Save</button>
              <button type="button" class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-border bg-surface text-text-muted cursor-pointer" @click="editingId = null">Cancel</button>
            </div>
          </div>
          <!-- Normal: tap to select; "fix" to correct details -->
          <template v-else>
            <button
              type="button"
              class="w-full text-left cursor-pointer bg-transparent border-0 p-0"
              @click="selectBar(bar)"
            >
              <div class="font-semibold text-sm">
                {{ bar.name }}
                <span v-if="bar.edited" class="ml-1 text-[10px] font-bold uppercase tracking-wide text-accent/60">edited</span>
              </div>
              <div class="text-xs text-text-muted mt-0.5">{{ bar.address }}</div>
              <div v-if="bar.category" class="text-[11px] text-accent mt-1 font-medium">{{ bar.category }}</div>
            </button>
            <button
              type="button"
              class="mt-1.5 text-[11px] font-semibold text-text-muted hover:text-accent cursor-pointer bg-transparent border-0 p-0"
              @click.stop="startEdit(bar)"
            >✏️ Fix name / address</button>
          </template>
        </div>
      </div>
    </div>

    <!-- Confirm button (sticky bottom) -->
    <div v-if="selectedBar" class="px-4 pb-5 pt-3 bg-bg border-t-2 border-border">
      <button
        type="button"
        class="w-full py-3.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-sm transition-colors hover:bg-accent-dark"
        :disabled="loading"
        @click="showConfirm = true"
      >{{ loading ? 'Saving...' : `Select ${selectedBar.name}` }}</button>
    </div>

    <!-- Confirmation dialog -->
    <ConfirmModal
      v-model="showConfirm"
      title="Are you absolutely sure?"
      :message="`You are choosing <strong>${selectedBar?.name ?? ''}</strong> as your coop. This choice is <strong>permanent</strong> and cannot be changed!`"
      confirm-label="Lock it in"
      :loading="loading"
      @confirm="confirmSelection"
    />
  </div>
</template>

<script setup lang="ts">
import type { HuntBar } from "~/types";

const props = defineProps<{
  bars: HuntBar[];
}>();

const emit = defineEmits<{
  selected: [barId: string];
  add: [name: string, address: string];
  edit: [barId: string, payload: { name: string; address: string }];
}>();

const search = ref("");
const selectedBar = ref<HuntBar | null>(null);
const showConfirm = ref(false);
const loading = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);

// Add-a-bar form
const showAddForm = ref(false);
const addName = ref("");
const addAddress = ref("");

// Inline edit (fix a wrong name/address)
const editingId = ref<string | null>(null);
const editName = ref("");
const editAddress = ref("");

const filteredBars = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return props.bars;
  return props.bars.filter(
    (b) => b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
  );
});

function selectBar(bar: HuntBar) {
  selectedBar.value = bar;
}

function submitAdd() {
  if (!addName.value.trim()) return;
  emit("add", addName.value.trim(), addAddress.value.trim());
  cancelAdd();
}
function cancelAdd() {
  showAddForm.value = false;
  addName.value = "";
  addAddress.value = "";
}

function startEdit(bar: HuntBar) {
  editingId.value = bar.id;
  editName.value = bar.name;
  editAddress.value = bar.address;
}
function saveEdit(bar: HuntBar) {
  emit("edit", bar.id, { name: editName.value.trim() || bar.name, address: editAddress.value.trim() });
  editingId.value = null;
}

function confirmSelection() {
  if (!selectedBar.value) return;
  loading.value = true;
  emit("selected", selectedBar.value.id);
}

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
});
</script>
