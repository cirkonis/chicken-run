<template>
  <div class="flex flex-col gap-4">
    <!-- Where were the chickens hiding? -->
    <section class="bg-[#fff8e1] border-2 border-chicken-yellow rounded-[18px] p-5">
      <h3 class="m-0 mb-2 text-base">Where were the chickens hiding?</h3>
      <div v-if="coopBar" class="flex items-center gap-3 px-3 py-2.5 bg-white/60 rounded-xl border border-chicken-yellow/40">
        <span class="text-2xl">🐔</span>
        <div>
          <div class="font-bold text-sm">{{ coopBar.name }}</div>
          <div class="text-xs text-text-muted">{{ coopBar.address }}</div>
        </div>
      </div>
      <p v-else class="text-sm text-text-muted m-0 italic">The chickens never picked a coop!</p>
    </section>

    <!-- When they were found -->
    <section v-if="arrivals.length > 0" class="bg-surface border-2 border-border rounded-[18px] p-5">
      <h3 class="m-0 mb-3 text-base">When they were found</h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="(a, idx) in sortedArrivals"
          :key="a.id"
          class="flex items-center gap-3 px-3 py-2 bg-white/60 rounded-xl border border-chicken-yellow/30"
        >
          <span class="w-8 h-8 rounded-full bg-accent/10 text-accent font-bold text-xs flex items-center justify-center shrink-0">
            {{ ordinal(idx + 1) }}
          </span>
          <div class="flex-1 min-w-0">
            <span class="font-semibold text-sm">{{ a.teamName }}</span>
          </div>
          <div class="text-right shrink-0">
            <div class="text-xs text-text-muted">{{ formatTime(a.arrivedAt) }}</div>
            <div class="text-[11px] text-accent font-semibold">{{ minutesInto(a.arrivedAt) }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick stats grid -->
    <div class="grid grid-cols-2 gap-3">
      <!-- Chicken budget -->
      <div v-if="budgetTotal != null" class="bg-surface border-2 border-border rounded-[18px] p-4 text-center">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Chicken budget</div>
        <div class="text-2xl font-bold text-accent-dark">{{ budgetSpent }}</div>
        <div class="text-xs text-text-muted">of {{ budgetTotal }} spent</div>
        <div
          class="w-12 h-12 rounded-full border-4 flex items-center justify-center mx-auto mt-2"
          :class="budgetPercent < 75 ? 'border-chicken-yellow' : 'border-red'"
        >
          <span class="text-[10px] font-bold" :class="budgetPercent < 75 ? 'text-accent-dark' : 'text-red'">{{ budgetPercent }}%</span>
        </div>
        <!-- Expense details -->
        <div v-if="expenses.length > 0" class="mt-2 pt-2 border-t border-border">
          <button
            type="button"
            class="text-[11px] font-semibold text-text-muted cursor-pointer bg-transparent border-0 p-0 hover:text-accent transition-colors"
            @click="expensesOpen = !expensesOpen"
          >{{ expensesOpen ? 'Hide' : 'Show' }} details</button>
          <ul v-show="expensesOpen" class="list-none p-0 m-0 mt-1.5 flex flex-col gap-1 text-left">
            <li
              v-for="e in expenses"
              :key="e.id"
              class="flex items-center gap-2 px-2 py-1 bg-white/60 rounded-lg text-xs"
            >
              <span class="font-bold text-accent-dark">{{ e.amount }}</span>
              <span class="flex-1 text-text-muted truncate">{{ e.note || '—' }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bars & Drinks -->
      <div class="bg-surface border-2 border-border rounded-[18px] p-4 text-center">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Bars checked</div>
        <div class="text-2xl font-bold text-accent-dark">{{ barsChecked }}</div>
        <div class="text-xs text-text-muted mb-2">of {{ bars.length }} bars</div>
        <div class="border-t border-border pt-2">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Hunter drinks consumed</div>
          <div class="text-lg font-bold text-accent-dark">~{{ totalDrinks }}</div>
          <div class="text-xs text-text-muted">estimated</div>
        </div>
      </div>
    </div>

    <!-- The Chickens -->
    <section class="bg-surface border-2 border-border rounded-[18px] p-5">
      <h3 class="m-0 mb-3 text-base">The Chickens</h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="member in chickenMembers"
          :key="member.id"
          class="px-3 py-1.5 bg-chicken-yellow/20 border border-chicken-yellow/40 rounded-lg text-sm font-semibold"
        >{{ member.name }}</span>
        <span v-if="chickenMembers.length === 0" class="text-sm text-text-muted italic">No chicken team members</span>
      </div>
    </section>

    <!-- The Teams -->
    <section class="bg-surface border-2 border-border rounded-[18px] p-5">
      <h3 class="m-0 mb-3 text-base">The Teams</h3>
      <div class="flex flex-col gap-3">
        <div
          v-for="team in hunterTeams"
          :key="team.id"
          class="px-3 py-2.5 bg-white/60 rounded-xl border border-border"
        >
          <div class="font-semibold text-sm mb-1">{{ team.name }}</div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="m in (team.members || [])"
              :key="m.id"
              class="px-2 py-0.5 bg-accent/10 rounded text-xs text-accent-dark"
            >{{ m.name }}</span>
            <span v-if="!team.members?.length" class="text-xs text-text-muted italic">No members</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Map -->
    <section class="bg-surface border-2 border-border rounded-[18px] p-5">
      <h3 class="m-0 mb-3 text-base">The Hunting Grounds</h3>
      <div ref="mapEl" class="w-full h-[300px] rounded-xl overflow-hidden border border-border" />
    </section>

    <!-- Bar list (collapsed by default) -->
    <section class="bg-surface border-2 border-border rounded-[18px] p-5">
      <div class="flex justify-between items-center">
        <h3 class="m-0 text-base">Bars Visited</h3>
        <button
          type="button"
          class="px-2.5 py-1 border-2 border-border rounded-lg bg-white/60 text-xs font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
          @click="barsOpen = !barsOpen"
        >{{ barsOpen ? 'Hide' : `Show all (${barsChecked})` }}</button>
      </div>
      <div v-show="barsOpen" class="mt-3 flex flex-col gap-2">
        <!-- Coop bar (if not already in visited bars) -->
        <div
          v-if="coopBar && coopBar.checkStatus !== 'checked'"
          class="px-3 py-2.5 rounded-xl border border-chicken-yellow/40 bg-[#fff8e1]"
        >
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm flex-1 truncate">🐔 {{ coopBar.name }}</span>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-amber-700 bg-chicken-yellow/20">The Coop</span>
          </div>
          <div class="text-xs text-text-muted mt-1">{{ coopBar.address }}</div>
        </div>
        <div
          v-for="bar in visitedBars"
          :key="bar.id"
          class="px-3 py-2.5 rounded-xl border border-green/40 bg-[#f0faf4]"
        >
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm flex-1 truncate">{{ coopBar?.id === bar.id ? '🐔 ' : '' }}{{ bar.name }}</span>
            <span v-if="coopBar?.id === bar.id" class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-amber-700 bg-chicken-yellow/20">The Coop</span>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-green bg-green/10">Visited</span>
          </div>
          <!-- Who checked in here -->
          <div v-if="barCheckIns(bar.id).length > 0" class="mt-1.5 flex flex-col gap-1">
            <div
              v-for="ci in barCheckIns(bar.id)"
              :key="ci.id"
              class="text-xs text-text-muted flex items-center gap-1.5"
            >
              <span class="font-semibold text-accent-dark">{{ getTeamName(ci.teamId) }}</span>
              <span>checked in</span>
              <span class="ml-auto text-[11px]">{{ formatTime(ci.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Hunt, HuntBar, HuntCheckIn, HuntArrival, HuntExpense, Team } from "~/types";

const props = defineProps<{
  hunt: Hunt;
  bars: HuntBar[];
  checkIns: HuntCheckIn[];
  arrivals: HuntArrival[];
  expenses: HuntExpense[];
  teams: Team[];
}>();

const expensesOpen = ref(false);
const barsOpen = ref(false);
const mapEl = ref<HTMLElement | null>(null);

const { initMap, paintMarkers, cleanup } = useMap();

// ── Computed ──────────────────────────────────────────

const sortedArrivals = computed(() =>
  [...props.arrivals].sort(
    (a, b) => new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime()
  )
);

const chickenTeam = computed(() => props.teams.find((t) => t.isChicken));
const coopBar = computed(() => {
  const barId = chickenTeam.value?.selectedBarId;
  if (!barId) return null;
  return props.bars.find((b) => b.id === barId) ?? null;
});
const chickenMembers = computed(() => chickenTeam.value?.members || []);
const hunterTeams = computed(() => props.teams.filter((t) => !t.isChicken));

const visitedBars = computed(() => props.bars.filter((b) => b.checkStatus === "checked"));
const barsChecked = computed(() => visitedBars.value.length);

const budgetTotal = computed(() => props.hunt.budget);
const budgetSpent = computed(() => props.expenses.reduce((s, e) => s + e.amount, 0));
const budgetPercent = computed(() => {
  if (!budgetTotal.value) return 0;
  return Math.round((budgetSpent.value / budgetTotal.value) * 100);
});

const totalDrinks = computed(() => {
  const teamSizeMap = new Map<string, number>();
  for (const t of props.teams) {
    teamSizeMap.set(t.id, t.members?.length ?? 1);
  }
  // If we have check-in records, use them for accuracy
  if (props.checkIns.length > 0) {
    return props.checkIns.reduce((sum, ci) => {
      const teamCount = ci.teamId ? (teamSizeMap.get(ci.teamId) ?? 1) : 1;
      const withCount = (ci.withTeams ?? []).reduce((s, t) => s + (teamSizeMap.get(t.id) ?? 0), 0);
      return sum + teamCount + withCount;
    }, 0);
  }
  // Fallback: estimate from visited bars × hunter count
  const hunterCount = props.teams
    .filter((t) => !t.isChicken)
    .reduce((sum, t) => sum + (t.members?.length ?? 1), 0);
  return barsChecked.value * Math.max(hunterCount, 1);
});

// ── Lookup helpers ────────────────────────────────────

const teamMap = computed(() => {
  const m = new Map<string, string>();
  for (const t of props.teams) m.set(t.id, t.name);
  return m;
});

function getTeamName(teamId: string | null): string {
  if (!teamId) return "Unknown";
  return teamMap.value.get(teamId) || "Unknown team";
}

const checkInsByBar = computed(() => {
  const m = new Map<string, HuntCheckIn[]>();
  for (const ci of props.checkIns) {
    if (!m.has(ci.barId)) m.set(ci.barId, []);
    m.get(ci.barId)!.push(ci);
  }
  // Sort each group by time
  for (const arr of m.values()) {
    arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return m;
});

function barCheckIns(barId: string): HuntCheckIn[] {
  return checkInsByBar.value.get(barId) || [];
}

// ── Time formatting ───────────────────────────────────

const startTime = computed(() =>
  props.hunt.startedAt ? new Date(props.hunt.startedAt).getTime() : 0
);

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function minutesInto(iso: string): string {
  if (!startTime.value) return "";
  const diff = new Date(iso).getTime() - startTime.value;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "right at the start";
  if (mins < 60) return `${mins}m into the hunt`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m into the hunt`;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

// ── Map ───────────────────────────────────────────────

onMounted(() => {
  nextTick(() => {
    if (mapEl.value && props.hunt) {
      const coop = coopBar.value;
      initMap(
        mapEl.value,
        { lat: props.hunt.centerLat, lng: props.hunt.centerLng },
        props.hunt.radiusMeters,
        coop ? { lat: coop.lat, lng: coop.lng } : null
      );
      // Show only visited bars on the results map
      paintMarkers(visitedBars.value);
    }
  });
});

onUnmounted(() => {
  cleanup();
});
</script>
