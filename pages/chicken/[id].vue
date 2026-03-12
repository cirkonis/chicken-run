<template>
  <div class="max-w-[700px] mx-auto px-4 py-5">
    <!-- Loading -->
    <LoadingSpinner v-if="pageLoading" message="Loading hunt..." />

    <!-- Error state -->
    <div v-else-if="error && !hunt" class="text-center py-16 text-text-muted">
      <p class="text-4xl mb-4">🐔</p>
      <p class="text-lg font-semibold text-red mb-2">Failed to load hunt</p>
      <p class="text-sm mb-4">{{ error }}</p>
      <button
        class="px-6 py-2.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-semibold text-sm transition-colors hover:bg-accent-dark"
        @click="goBack"
      >Go back</button>
    </div>

    <template v-else-if="hunt">
      <header class="mb-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex flex-col gap-1">
            <button class="self-start bg-transparent border-none text-accent font-semibold text-[13px] cursor-pointer p-0 mb-1 hover:underline" @click="goBack" title="Back">← Back</button>
            <h1 class="m-0 text-2xl text-accent-dark">🐔 {{ hunt.name }}</h1>
            <span class="text-sm text-text-muted italic">
              Playing as <strong>{{ auth.state.user?.displayName || 'Unknown' }}</strong> · Chicken
            </span>
          </div>
        </div>
      </header>

      <main class="flex flex-col gap-4">
        <!-- ══════════════════════════════════════════════════ -->
        <!-- 1. Budget Section                                  -->
        <!-- ══════════════════════════════════════════════════ -->
        <section class="bg-[#fff8e1] border-2 border-chicken-yellow rounded-[18px] p-5">
          <div class="flex justify-between items-center" :class="budgetOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Budget</h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-chicken-yellow/40 rounded-lg bg-white/60 text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="budgetOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="budgetOpen = !budgetOpen"
            >{{ budgetOpen ? 'Hide' : 'Show' }}</button>
          </div>

          <div v-show="budgetOpen">
            <!-- No budget set -->
            <div v-if="budgetTotal == null" class="px-4 py-3 bg-white/60 border-2 border-chicken-yellow/40 rounded-xl text-sm text-text-muted text-center">
              No budget set for this hunt.
            </div>

            <!-- Budget display -->
            <template v-else>
              <div class="flex items-center gap-3 px-4 py-3 bg-white/60 border-2 border-chicken-yellow/40 rounded-xl mb-3">
                <div class="flex-1">
                  <div class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-0.5">Money left</div>
                  <div class="text-2xl font-bold text-accent-dark">
                    {{ budgetRemaining }} kr
                    <span class="text-sm font-normal text-text-muted">of {{ budgetTotal }} kr</span>
                  </div>
                  <div class="text-xs text-text-muted mt-1">Spent: {{ budgetSpent }} kr</div>
                </div>
                <div
                  class="w-16 h-16 rounded-full border-4 flex items-center justify-center"
                  :class="budgetPercent > 25 ? 'border-chicken-yellow' : 'border-red'"
                >
                  <span class="text-sm font-bold" :class="budgetPercent > 25 ? 'text-accent-dark' : 'text-red'">{{ budgetPercent }}%</span>
                </div>
              </div>

              <!-- Spend button -->
              <button
                v-if="!showSpendForm"
                type="button"
                class="w-full py-2.5 border-2 border-dashed border-chicken-yellow rounded-xl bg-transparent text-accent font-semibold text-sm cursor-pointer transition-all hover:bg-accent hover:text-white hover:border-solid"
                @click="showSpendForm = true"
              >
                + Log a Spend
              </button>

              <!-- Spend form -->
              <div v-else class="flex flex-col gap-2 p-3 bg-white/60 border-2 border-chicken-yellow/40 rounded-xl">
                <input
                  ref="spendAmountInput"
                  v-model="spendAmount"
                  type="number"
                  inputmode="numeric"
                  placeholder="Amount (kr)"
                  min="1"
                  class="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-bg focus:outline-none focus:border-accent"
                />
                <input
                  v-model="spendNote"
                  type="text"
                  placeholder="Note (optional)"
                  class="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-bg focus:outline-none focus:border-accent"
                  @keyup.enter="submitSpend"
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="flex-1 px-3 py-2 border-2 border-border rounded-lg bg-surface text-text-muted text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
                    @click="showSpendForm = false; spendAmount = ''; spendNote = ''"
                  >Cancel</button>
                  <button
                    type="button"
                    class="flex-1 px-3 py-2 border-0 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="!spendAmount || Number(spendAmount) <= 0"
                    @click="submitSpend"
                  >Add Spend</button>
                </div>
              </div>
            </template>

            <!-- Expense history -->
            <div v-if="expenses.length > 0" class="mt-3">
              <div class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Expense history</div>
              <ul class="list-none p-0 m-0 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                <li
                  v-for="e in expenses"
                  :key="e.id"
                  class="flex items-center gap-2 px-3 py-2 bg-white/60 border border-chicken-yellow/30 rounded-lg text-sm"
                >
                  <span class="font-bold text-accent-dark min-w-[50px]">{{ e.amount }} kr</span>
                  <span class="flex-1 text-text-muted text-xs truncate">{{ e.note || '—' }}</span>
                  <span class="text-[11px] text-text-muted opacity-60 whitespace-nowrap">{{ formatTime(e.createdAt) }}</span>
                  <button
                    type="button"
                    class="px-1.5 py-0.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red"
                    title="Undo"
                    @click="deleteExpense(e.id)"
                  >✕</button>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- ══════════════════════════════════════════════════ -->
        <!-- 2. Hints Section                                   -->
        <!-- ══════════════════════════════════════════════════ -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-5">
          <div class="flex justify-between items-center" :class="hintsOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Hints <span v-if="hints.length" class="text-sm font-normal text-text-muted">({{ hints.length }})</span></h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="hintsOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="hintsOpen = !hintsOpen"
            >{{ hintsOpen ? 'Hide' : 'Show' }}</button>
          </div>

          <div v-show="hintsOpen">
            <!-- Hint input -->
            <div class="flex flex-col gap-2 mb-3">
              <div class="flex gap-2">
                <input
                  v-model="newHint"
                  type="text"
                  placeholder="Drop a hint for the hunters..."
                  class="flex-1 px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-bg focus:outline-none focus:border-accent"
                  @keyup.enter="submitHint"
                />
                <label
                  class="px-3 py-2.5 border-2 border-border rounded-xl bg-bg cursor-pointer transition-all hover:border-accent flex items-center"
                  :class="selectedImage ? 'border-accent bg-accent/5' : ''"
                  title="Attach photo"
                >
                  <span class="text-base leading-none">+img</span>
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="hidden"
                    @change="onFileSelected"
                  />
                </label>
                <button
                  type="button"
                  class="px-4 py-2.5 border-0 rounded-xl bg-accent text-white font-semibold text-sm cursor-pointer transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="(!newHint.trim() && !selectedImage) || hintUploading"
                  @click="submitHint"
                >{{ hintUploading ? 'Uploading...' : 'Send' }}</button>
              </div>
              <!-- Image preview -->
              <div v-if="imagePreview" class="relative inline-block self-start">
                <img :src="imagePreview" class="h-20 rounded-lg border-2 border-border object-cover" />
                <button
                  type="button"
                  class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red text-white text-xs flex items-center justify-center cursor-pointer border-none"
                  @click="clearImage"
                >x</button>
              </div>
            </div>

            <!-- Hints list -->
            <ul v-if="hints.length" class="list-none p-0 m-0 flex flex-col gap-1.5">
              <li
                v-for="h in hints"
                :key="h.id"
                class="flex flex-col gap-1.5 px-3 py-2 bg-[#fff8e1] border border-chicken-yellow/30 rounded-lg text-sm"
              >
                <div class="flex items-baseline gap-2">
                  <span class="flex-1">{{ h.text }}</span>
                  <span class="text-[11px] text-text-muted opacity-70 whitespace-nowrap">
                    {{ h.authorName }} · {{ formatTime(h.createdAt) }}
                  </span>
                  <button
                    v-if="h.authorId === auth.state.user?.id || isCreator"
                    type="button"
                    class="px-1.5 py-0.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red"
                    title="Delete hint"
                    @click="pendingDeleteHintId = h.id; showDeleteHintConfirm = true"
                  >✕</button>
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
            <p v-else class="text-[13px] text-text-muted italic m-0">No hints yet. Time to give the hunters a clue!</p>
          </div>
        </section>

        <!-- ══════════════════════════════════════════════════ -->
        <!-- 3. Who's Here (Team Arrivals)                      -->
        <!-- ══════════════════════════════════════════════════ -->
        <section class="bg-surface border-2 border-border rounded-[18px] p-5">
          <div class="flex justify-between items-center" :class="arrivalsOpen ? 'mb-3.5' : ''">
            <h2 class="m-0 text-lg">Who's Here</h2>
            <button
              type="button"
              class="px-3 py-1.5 border-2 border-border rounded-lg bg-bg text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
              :class="arrivalsOpen ? 'border-accent text-accent' : 'text-text-muted'"
              @click="arrivalsOpen = !arrivalsOpen"
            >{{ arrivalsOpen ? 'Hide' : 'Show' }}</button>
          </div>

          <div v-show="arrivalsOpen">
            <!-- Arrived teams -->
            <div v-if="arrivals.length > 0" class="flex flex-col gap-1.5 mb-3">
              <div
                v-for="(a, idx) in arrivals"
                :key="a.id"
                class="flex flex-col gap-1.5 px-3 py-2.5 bg-bg border-2 border-border rounded-xl"
              >
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-full bg-accent/10 text-accent font-bold text-xs flex items-center justify-center">
                    {{ ordinal(idx + 1) }}
                  </span>
                  <span class="flex-1 font-semibold text-sm">{{ a.teamName }}</span>
                  <span class="text-[11px] text-text-muted">{{ formatTime(a.arrivedAt) }}</span>
                  <button
                    type="button"
                    class="px-1.5 py-0.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red"
                    title="Remove arrival"
                    @click="pendingDeleteArrivalId = a.id; showDeleteArrivalConfirm = true"
                  >✕</button>
                </div>
                <p v-if="a.note" class="text-sm text-text-muted m-0 pl-9">{{ a.note }}</p>
                <img
                  v-if="a.imageUrl"
                  :src="a.imageUrl"
                  alt="Arrival photo"
                  class="max-h-48 rounded-lg object-cover cursor-pointer border border-border"
                  loading="lazy"
                  @click="fullImageUrl = a.imageUrl"
                />
              </div>
            </div>
            <p v-else class="text-[13px] text-text-muted italic m-0 mb-3">No teams have found you yet. Stay hidden!</p>

            <!-- Record arrival button -->
            <div v-if="unarrivedTeams.length > 0">
              <button
                v-if="!showArrivalPicker"
                type="button"
                class="w-full py-2.5 border-2 border-dashed border-border rounded-xl bg-transparent text-accent font-semibold text-sm cursor-pointer transition-all hover:bg-accent hover:text-white hover:border-solid"
                @click="showArrivalPicker = true"
              >
                + Team Arrived!
              </button>

              <!-- Team picker (step 1: choose team) -->
              <div v-else-if="!selectedArrivalTeamId" class="flex flex-col gap-2 p-3 bg-bg border-2 border-border rounded-xl">
                <div class="text-xs font-semibold text-text-muted mb-1">Which team found you?</div>
                <button
                  v-for="t in unarrivedTeams"
                  :key="t.id"
                  type="button"
                  class="px-4 py-2.5 border-2 border-border rounded-xl bg-surface text-sm font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent text-left"
                  @click="selectedArrivalTeamId = t.id"
                >
                  {{ t.name }}
                </button>
                <button
                  type="button"
                  class="self-start px-3 py-1.5 border-2 border-border rounded-lg bg-surface text-xs font-semibold text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
                  @click="cancelArrivalPicker"
                >Cancel</button>
              </div>

              <!-- Team picker (step 2: optional photo + confirm) -->
              <div v-else class="flex flex-col gap-2 p-3 bg-bg border-2 border-border rounded-xl">
                <div class="text-xs font-semibold text-text-muted mb-1">
                  Record <strong>{{ selectedArrivalTeamName }}</strong> arriving
                </div>
                <!-- Photo attachment -->
                <div class="flex items-center gap-2">
                  <label
                    class="flex-1 py-2.5 border-2 border-dashed border-border rounded-xl bg-surface text-center text-sm cursor-pointer transition-all hover:border-accent"
                    :class="arrivalImagePreview ? 'border-accent bg-accent/5' : ''"
                  >
                    <span>{{ arrivalImagePreview ? 'Change photo' : '+ Add photo (optional)' }}</span>
                    <input
                      ref="arrivalFileInput"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      class="hidden"
                      @change="onArrivalFileSelected"
                    />
                  </label>
                </div>
                <!-- Image preview -->
                <div v-if="arrivalImagePreview" class="relative inline-block self-start">
                  <img :src="arrivalImagePreview" class="h-20 rounded-lg border-2 border-border object-cover" />
                  <button
                    type="button"
                    class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red text-white text-xs flex items-center justify-center cursor-pointer border-none"
                    @click="clearArrivalImage"
                  >x</button>
                </div>
                <!-- Note -->
                <input
                  v-model="arrivalNote"
                  type="text"
                  placeholder="Add a note (optional)"
                  class="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-bg focus:outline-none focus:border-accent"
                  maxlength="200"
                />
                <!-- Actions -->
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="flex-1 px-3 py-2 border-2 border-border rounded-lg bg-surface text-text-muted text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
                    @click="cancelArrivalPicker"
                  >Cancel</button>
                  <button
                    type="button"
                    class="flex-1 px-3 py-2 border-0 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="arrivalUploading"
                    @click="recordArrival"
                  >{{ arrivalUploading ? 'Uploading...' : 'Confirm Arrival' }}</button>
                </div>
              </div>
            </div>
            <p v-else-if="arrivals.length > 0" class="text-[13px] text-green font-semibold m-0">All teams have arrived!</p>
          </div>
        </section>
      </main>

      <footer class="text-center py-5 text-[13px] text-text-muted border-t border-border mt-6">
        <p class="m-0">🐔 Stay hidden. Stay spending. Stay clucking.</p>
      </footer>
    </template>

    <!-- Delete hint confirmation -->
    <ConfirmModal
      v-model="showDeleteHintConfirm"
      title="Delete this hint?"
      message="This hint will be permanently removed. Hunters will no longer see it."
      confirm-label="Delete"
      variant="danger"
      @confirm="confirmDeleteHint"
    />

    <!-- Delete arrival confirmation -->
    <ConfirmModal
      v-model="showDeleteArrivalConfirm"
      title="Remove this arrival?"
      message="This will remove the team's arrival record. You can re-add them later."
      confirm-label="Remove"
      variant="danger"
      @confirm="confirmDeleteArrival"
    />

    <!-- Error toast -->
    <Teleport to="body">
      <div
        v-if="error && hunt"
        class="fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-3 bg-red text-white rounded-xl text-sm font-semibold shadow-lg z-50 cursor-pointer"
        @click="error = null"
      >
        {{ error }}
      </div>
    </Teleport>

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
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const huntId = route.params.id as string;

// ── Composable ──────────────────────────────────────────
const {
  pageLoading, error,
  hunt, hints, expenses, arrivals,
  newHint, hintUploading, arrivalUploading,
  isCreator,
  budgetTotal, budgetSpent, budgetRemaining, budgetPercent,
  unarrivedTeams,
  loadHunt, addHint, deleteHint, addExpense, deleteExpense, addArrival, deleteArrival,
  formatTime,
  startPolling, stopPolling,
} = useChicken(huntId);

// ── Section toggles ─────────────────────────────────────
const budgetOpen = ref(true);
const hintsOpen = ref(true);
const arrivalsOpen = ref(true);

// ── Hint image handling ─────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null);
const selectedImage = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const fullImageUrl = ref<string | null>(null);

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  selectedImage.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

function clearImage() {
  selectedImage.value = null;
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value);
    imagePreview.value = null;
  }
  if (fileInput.value) fileInput.value.value = "";
}

async function submitHint() {
  await addHint(undefined, selectedImage.value);
  clearImage();
}

// ── Budget spending ─────────────────────────────────────
const showSpendForm = ref(false);
const spendAmount = ref("");
const spendNote = ref("");
const spendAmountInput = ref<HTMLInputElement | null>(null);

watch(showSpendForm, (open) => {
  if (open) nextTick(() => spendAmountInput.value?.focus());
});

async function submitSpend() {
  const amount = Number(spendAmount.value);
  if (amount <= 0) return;
  await addExpense(amount, spendNote.value.trim());
  spendAmount.value = "";
  spendNote.value = "";
  showSpendForm.value = false;
}

// ── Arrivals ────────────────────────────────────────────
const showArrivalPicker = ref(false);
const selectedArrivalTeamId = ref<string | null>(null);
const arrivalFileInput = ref<HTMLInputElement | null>(null);
const selectedArrivalImage = ref<File | null>(null);
const arrivalImagePreview = ref<string | null>(null);
const arrivalNote = ref("");

const selectedArrivalTeamName = computed(() => {
  if (!selectedArrivalTeamId.value) return "";
  return unarrivedTeams.value.find((t) => t.id === selectedArrivalTeamId.value)?.name || "";
});

function onArrivalFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  selectedArrivalImage.value = file;
  arrivalImagePreview.value = URL.createObjectURL(file);
}

function clearArrivalImage() {
  selectedArrivalImage.value = null;
  if (arrivalImagePreview.value) {
    URL.revokeObjectURL(arrivalImagePreview.value);
    arrivalImagePreview.value = null;
  }
  if (arrivalFileInput.value) arrivalFileInput.value.value = "";
}

function cancelArrivalPicker() {
  showArrivalPicker.value = false;
  selectedArrivalTeamId.value = null;
  arrivalNote.value = "";
  clearArrivalImage();
}

async function recordArrival() {
  if (!selectedArrivalTeamId.value) return;
  await addArrival(selectedArrivalTeamId.value, arrivalNote.value.trim(), selectedArrivalImage.value);
  cancelArrivalPicker();
}

// ── Delete confirmations ─────────────────────────────────
const pendingDeleteHintId = ref<string | null>(null);
const showDeleteHintConfirm = ref(false);
const pendingDeleteArrivalId = ref<string | null>(null);
const showDeleteArrivalConfirm = ref(false);

async function confirmDeleteHint() {
  if (!pendingDeleteHintId.value) return;
  await deleteHint(pendingDeleteHintId.value);
  showDeleteHintConfirm.value = false;
  pendingDeleteHintId.value = null;
}

async function confirmDeleteArrival() {
  if (!pendingDeleteArrivalId.value) return;
  await deleteArrival(pendingDeleteArrivalId.value);
  showDeleteArrivalConfirm.value = false;
  pendingDeleteArrivalId.value = null;
}

// ── Helpers ─────────────────────────────────────────────
function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

// ── Navigation ──────────────────────────────────────────
function goBack() {
  auth.logout();
}

// ── Lifecycle ───────────────────────────────────────────
onMounted(async () => {
  await auth.restore();

  if (!auth.state.user) {
    router.push("/");
    return;
  }

  await loadHunt();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>
