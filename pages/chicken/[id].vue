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
            <div class="flex gap-2 mb-3">
              <input
                v-model="newHint"
                type="text"
                placeholder="Drop a hint for the hunters..."
                class="flex-1 px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-bg focus:outline-none focus:border-accent"
                @keyup.enter="addHint()"
              />
              <button
                type="button"
                class="px-4 py-2.5 border-0 rounded-xl bg-accent text-white font-semibold text-sm cursor-pointer transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="!newHint.trim()"
                @click="addHint()"
              >Send</button>
            </div>

            <!-- Hints list -->
            <ul v-if="hints.length" class="list-none p-0 m-0 flex flex-col gap-1.5">
              <li
                v-for="h in hints"
                :key="h.id"
                class="flex items-baseline gap-2 px-3 py-2 bg-[#fff8e1] border border-chicken-yellow/30 rounded-lg text-sm"
              >
                <span class="flex-1">{{ h.text }}</span>
                <span class="text-[11px] text-text-muted opacity-70 whitespace-nowrap">
                  {{ h.authorName }} · {{ formatTime(h.createdAt) }}
                </span>
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
                class="flex items-center gap-2 px-3 py-2.5 bg-bg border-2 border-border rounded-xl"
              >
                <span class="w-7 h-7 rounded-full bg-accent/10 text-accent font-bold text-xs flex items-center justify-center">
                  {{ ordinal(idx + 1) }}
                </span>
                <span class="flex-1 font-semibold text-sm">{{ a.teamName }}</span>
                <span class="text-[11px] text-text-muted">{{ formatTime(a.arrivedAt) }}</span>
                <button
                  type="button"
                  class="px-1.5 py-0.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red"
                  title="Undo"
                  @click="deleteArrival(a.id)"
                >✕</button>
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

              <!-- Team picker -->
              <div v-else class="flex flex-col gap-2 p-3 bg-bg border-2 border-border rounded-xl">
                <div class="text-xs font-semibold text-text-muted mb-1">Which team found you?</div>
                <button
                  v-for="t in unarrivedTeams"
                  :key="t.id"
                  type="button"
                  class="px-4 py-2.5 border-2 border-border rounded-xl bg-surface text-sm font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent text-left"
                  @click="recordArrival(t.id)"
                >
                  {{ t.name }}
                </button>
                <button
                  type="button"
                  class="self-start px-3 py-1.5 border-2 border-border rounded-lg bg-surface text-xs font-semibold text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
                  @click="showArrivalPicker = false"
                >Cancel</button>
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
  newHint,
  isCreator,
  budgetTotal, budgetSpent, budgetRemaining, budgetPercent,
  unarrivedTeams,
  loadHunt, addHint, addExpense, deleteExpense, addArrival, deleteArrival,
  formatTime,
  startPolling, stopPolling,
} = useChicken(huntId);

// ── Section toggles ─────────────────────────────────────
const budgetOpen = ref(true);
const hintsOpen = ref(true);
const arrivalsOpen = ref(true);

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

async function recordArrival(teamId: string) {
  await addArrival(teamId);
  showArrivalPicker.value = false;
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
