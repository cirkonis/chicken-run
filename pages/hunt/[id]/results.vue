<template>
  <div class="max-w-[700px] mx-auto px-4 py-5">
    <!-- Loading -->
    <LoadingSpinner v-if="pageLoading" message="Loading results..." />

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
      <!-- Header -->
      <header class="mb-4">
        <div class="flex flex-col gap-1 mb-3">
          <button class="self-start bg-transparent border-none text-accent font-semibold text-[13px] cursor-pointer p-0 mb-1 hover:underline" @click="goBack">← Back</button>
          <div class="flex items-center gap-2.5 flex-wrap">
            <h1 class="m-0 text-2xl text-accent-dark">🐔 {{ hunt.name }}</h1>
            <span class="px-2.5 py-1 bg-green/10 text-green text-xs font-bold rounded-lg uppercase tracking-wide">Hunt Complete</span>
          </div>
          <span v-if="huntDuration" class="text-sm text-text-muted">
            The hunt lasted <strong>{{ huntDuration }}</strong>
          </span>
        </div>
      </header>

      <!-- Tab bar -->
      <div class="flex gap-1 p-1 bg-bg border-2 border-border rounded-xl mb-4 sticky top-0 z-10">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all border-0"
          :class="activeTab === 'stats'
            ? 'bg-accent text-white shadow-sm'
            : 'bg-transparent text-text-muted hover:text-accent'"
          @click="activeTab = 'stats'"
        >The Stats</button>
        <button
          type="button"
          class="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all border-0"
          :class="activeTab === 'story'
            ? 'bg-accent text-white shadow-sm'
            : 'bg-transparent text-text-muted hover:text-accent'"
          @click="activeTab = 'story'"
        >The Story</button>
      </div>

      <!-- Stats tab -->
      <div v-show="activeTab === 'stats'">
        <ResultsStats
          :hunt="hunt"
          :bars="bars"
          :check-ins="checkIns"
          :arrivals="arrivals"
          :expenses="expenses"
          :teams="teams"
        />
      </div>

      <!-- Story tab -->
      <div v-show="activeTab === 'story'">
        <ResultsStory
          :hunt="hunt"
          :bars="bars"
          :check-ins="checkIns"
          :arrivals="arrivals"
          :hints="hints"
          :teams="teams"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const huntId = route.params.id as string;

const {
  pageLoading, error,
  hunt, bars, hints, teams, expenses, arrivals, checkIns,
  loadHunt,
} = useHunt(huntId);

const activeTab = ref<"stats" | "story">("stats");

// ── Hunt duration ─────────────────────────────────────
const huntDuration = computed(() => {
  if (!hunt.value?.startedAt) return "";
  const start = new Date(hunt.value.startedAt).getTime();

  // Find the latest event timestamp as approximate end time
  let latest = start;
  for (const ci of checkIns.value) {
    const t = new Date(ci.createdAt).getTime();
    if (t > latest) latest = t;
  }
  for (const a of arrivals.value) {
    const t = new Date(a.arrivedAt).getTime();
    if (t > latest) latest = t;
  }
  for (const h of hints.value) {
    const t = new Date(h.createdAt).getTime();
    if (t > latest) latest = t;
  }

  const diff = latest - start;
  if (diff < 60000) return "less than a minute";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h}h ${m}m`;
});

// ── Navigation ────────────────────────────────────────
function goBack() {
  if (auth.isHost.value) {
    router.push("/dashboard");
  } else {
    auth.logout();
  }
}

// ── Lifecycle ─────────────────────────────────────────
onMounted(async () => {
  await auth.restore();

  if (!auth.state.user) {
    router.push("/");
    return;
  }

  await loadHunt();

  // If hunt isn't completed, redirect to the active page
  if (hunt.value && hunt.value.status !== "completed") {
    // Determine if user is chicken or hunter based on participant role
    const myRole = hunt.value.teams?.find((t) =>
      t.isChicken && t.members?.some((m) => m.name === auth.state.user?.displayName)
    )
      ? "chicken"
      : "hunter";

    if (myRole === "chicken") {
      navigateTo(`/chicken/${huntId}`);
    } else {
      navigateTo(`/hunt/${huntId}`);
    }
  }
});
</script>
