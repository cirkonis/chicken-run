<template>
  <div class="flex flex-col gap-4">
    <!-- ═══ Mode Picker ═══════════════════════════════════ -->
    <div v-if="mode === 'picker'" class="flex flex-col gap-3">
      <p class="text-sm text-text-muted m-0">How would you like to set up teams?</p>
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="flex flex-col items-center gap-2 p-5 border-2 border-border rounded-xl bg-bg cursor-pointer transition-all hover:border-accent hover:shadow-sm"
          @click="mode = 'quick'"
        >
          <span class="font-semibold text-sm text-accent-dark">Quick Setup</span>
          <span class="text-xs text-text-muted text-center">Add members, pick a team size, and we'll randomize teams for you.</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center gap-2 p-5 border-2 border-border rounded-xl bg-bg cursor-pointer transition-all hover:border-accent hover:shadow-sm"
          @click="mode = 'full'"
        >
          <span class="font-semibold text-sm text-accent-dark">Full Control</span>
          <span class="text-xs text-text-muted text-center">Manually create teams and assign members yourself.</span>
        </button>
      </div>
    </div>

    <!-- ═══ Quick Setup Mode ══════════════════════════════ -->
    <div v-else-if="mode === 'quick'" class="flex flex-col gap-4">
      <button
        type="button"
        class="self-end text-xs text-text-muted underline cursor-pointer hover:text-accent bg-transparent border-none p-0"
        @click="switchToFullControl"
      >Switch to Full Control</button>

      <!-- Member roster -->
      <div>
        <h3 class="text-sm font-semibold m-0 mb-2">Members</h3>
        <div class="flex flex-col gap-2">
          <div
            v-for="(member, i) in rosterMembers"
            :key="i"
            class="flex gap-2 items-center"
          >
            <input
              v-model="member.name"
              type="text"
              placeholder="Name"
              class="flex-1 px-2.5 py-2 border-2 border-border rounded-lg text-sm bg-bg focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              class="px-2 py-1.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="rosterMembers.length <= 1"
              @click="rosterMembers.splice(i, 1)"
            >✕</button>
          </div>
          <button
            type="button"
            class="self-start px-3 py-1.5 border-2 border-dashed border-border rounded-lg bg-transparent text-xs text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
            @click="rosterMembers.push({ name: '' })"
          >+ Add member</button>
        </div>
      </div>

      <!-- Team size + chicken count row -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Team size selector -->
        <div>
          <h3 class="text-sm font-semibold m-0 mb-2">Team Size</h3>
          <div class="flex gap-2">
            <button
              v-for="size in sizes"
              :key="size"
              type="button"
              class="px-4 py-2 border-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              :class="teamSize === size
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-bg text-text-muted hover:border-accent hover:text-accent'"
              @click="teamSize = size"
            >{{ size === 2 ? 'Pairs (2)' : `Teams of ${size}` }}</button>
          </div>
        </div>

        <!-- Chicken count selector -->
        <div>
          <h3 class="text-sm font-semibold m-0 mb-2">🐔 Chickens</h3>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center border-2 border-chicken-yellow rounded-lg bg-white text-sm font-bold cursor-pointer transition-all hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="chickenCount <= 0"
              @click="chickenCount--"
            >−</button>
            <span class="text-sm font-semibold min-w-[24px] text-center">{{ chickenCount }}</span>
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center border-2 border-chicken-yellow rounded-lg bg-white text-sm font-bold cursor-pointer transition-all hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="chickenCount >= maxChickenCount"
              @click="chickenCount++"
            >+</button>
          </div>
          <p class="text-[11px] text-text-muted m-0 mt-1">Randomly picked from the roster</p>
        </div>
      </div>

      <!-- Generate button -->
      <button
        type="button"
        class="px-5 py-2.5 border-2 border-accent rounded-xl bg-transparent text-accent font-semibold text-sm cursor-pointer transition-all hover:bg-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="validMemberCount < 2"
        @click="generateTeams"
      >{{ hasGenerated ? 'Remake Teams' : 'Generate Teams' }}</button>

      <p v-if="validMemberCount < 2 && rosterMembers.length > 0" class="text-xs text-red m-0">
        Add at least 2 members with a name to generate teams.
      </p>

      <p v-if="chickenCount > 0 && chickenCount >= validMemberCount" class="text-xs text-red m-0">
        You need more members than chickens — hunters need teams too!
      </p>

      <!-- Generated teams -->
      <div v-if="hasGenerated && generatedTeams.length > 0" class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold m-0">Generated Teams</h3>
        <div
          v-for="(team, ti) in generatedTeams"
          :key="ti"
          class="border-2 rounded-xl p-4"
          :class="team.isChicken
            ? 'border-chicken-yellow bg-[#fffde7]'
            : 'border-border bg-bg'"
        >
          <div class="font-semibold text-sm mb-2" :class="team.isChicken ? 'text-[#d4a017]' : 'text-accent-dark'">
            {{ team.isChicken ? '🐔 ' : '' }}{{ team.name }}
          </div>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="(member, mi) in team.members"
              :key="mi"
              class="flex gap-2 items-center"
            >
              <span class="flex-1 text-sm truncate">{{ member.name }}</span>
              <select
                class="px-2 py-1 border-2 border-border rounded-lg bg-surface text-xs cursor-pointer focus:outline-none focus:border-accent"
                @change="moveMember(ti, mi, Number(($event.target as HTMLSelectElement).value)); ($event.target as HTMLSelectElement).selectedIndex = 0"
              >
                <option value="" selected disabled>Move...</option>
                <option
                  v-for="(otherTeam, oti) in generatedTeams"
                  :key="oti"
                  :value="oti"
                  :disabled="oti === ti"
                >{{ otherTeam.name }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Full Control Mode ═════════════════════════════ -->
    <div v-else-if="mode === 'full'" class="flex flex-col gap-4">
      <div class="flex justify-between items-center">
        <button
          type="button"
          class="text-xs text-text-muted underline cursor-pointer hover:text-accent bg-transparent border-none p-0"
          @click="switchToQuickSetup"
        >Switch to Quick Setup</button>
        <div class="flex gap-2">
          <button
            v-if="!hasChickenTeam"
            type="button"
            class="px-3 py-1.5 border-2 border-dashed border-chicken-yellow rounded-lg bg-[#fffde7] text-xs text-[#d4a017] font-semibold cursor-pointer transition-all hover:border-accent hover:text-accent"
            @click="addChickenTeam"
          >+ Add chicken team</button>
          <button
            type="button"
            class="px-3 py-1.5 border-2 border-dashed border-border rounded-lg bg-transparent text-xs text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
            @click="addTeam"
          >+ Add team</button>
        </div>
      </div>

      <p v-if="localTeams.length === 0" class="text-text-muted text-sm m-0">
        No teams configured. Add a team to get started.
      </p>

      <div
        v-for="(team, ti) in localTeams"
        :key="ti"
        class="border-2 rounded-xl p-4"
        :class="team.isChicken
          ? 'border-chicken-yellow bg-[#fffde7]'
          : 'border-border bg-bg'"
      >
        <div class="flex items-center gap-2 mb-3">
          <span v-if="team.isChicken" class="text-base">🐔</span>
          <input
            v-model="team.name"
            type="text"
            class="flex-1 px-3 py-2 border-2 rounded-lg text-sm font-semibold focus:outline-none focus:border-accent"
            :class="team.isChicken
              ? 'border-chicken-yellow bg-white'
              : 'border-border bg-surface'"
            :placeholder="team.isChicken ? 'Chickens' : `Team ${ti + 1}`"
          />
          <button
            v-if="!team.isChicken"
            type="button"
            class="px-2 py-1 border-2 border-chicken-yellow/50 rounded-lg bg-[#fffde7] text-[10px] text-[#d4a017] font-semibold cursor-pointer transition-all hover:border-chicken-yellow"
            title="Convert to chicken team"
            @click="toggleChickenTeam(ti)"
          >🐔</button>
          <button
            v-if="team.isChicken"
            type="button"
            class="px-2 py-1 border-2 border-border rounded-lg bg-surface text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent"
            title="Convert to regular team"
            @click="toggleChickenTeam(ti)"
          >→ Team</button>
          <button
            type="button"
            class="px-2.5 py-1.5 border-2 border-border rounded-lg bg-surface text-xs text-text-muted cursor-pointer transition-all hover:border-red hover:text-red"
            @click="localTeams.splice(ti, 1)"
            title="Remove team"
          >✕</button>
        </div>

        <div class="flex flex-col gap-2">
          <div
            v-for="(member, mi) in team.members"
            :key="mi"
            class="flex gap-2 items-center"
          >
            <input
              v-model="member.name"
              type="text"
              placeholder="Name"
              class="flex-1 px-2.5 py-2 border-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              :class="team.isChicken
                ? 'border-chicken-yellow/50 bg-white'
                : 'border-border bg-surface'"
            />
            <button
              type="button"
              class="px-2 py-1.5 border-none bg-transparent text-text-muted text-xs cursor-pointer hover:text-red"
              @click="team.members.splice(mi, 1)"
              title="Remove member"
            >✕</button>
          </div>
          <button
            type="button"
            class="self-start px-3 py-1.5 border-2 border-dashed rounded-lg bg-transparent text-xs text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
            :class="team.isChicken ? 'border-chicken-yellow/50' : 'border-border'"
            @click="team.members.push({ name: '' })"
          >+ Add member</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamMemberInput } from "~/types";

type TeamData = { name: string; members: TeamMemberInput[]; isChicken?: boolean };

const props = defineProps<{
  modelValue: TeamData[];
}>();

const emit = defineEmits<{
  "update:modelValue": [teams: TeamData[]];
}>();

// ── Mode ──────────────────────────────────────────────────
type Mode = "picker" | "quick" | "full";
const mode = ref<Mode>(props.modelValue.length > 0 ? "full" : "picker");

// ── Quick Setup state ─────────────────────────────────────
const rosterMembers = ref<TeamMemberInput[]>([{ name: "" }]);
const sizes = [2, 3, 4] as const;
const teamSize = ref<2 | 3 | 4>(2);
const chickenCount = ref(2);
const generatedTeams = ref<TeamData[]>([]);
const hasGenerated = ref(false);

const validMemberCount = computed(() =>
  rosterMembers.value.filter((m) => m.name.trim()).length
);

const maxChickenCount = computed(() =>
  Math.max(0, validMemberCount.value - 2)
);

// Clamp chicken count when member count shrinks
watch(maxChickenCount, (max) => {
  if (chickenCount.value > max) {
    chickenCount.value = max;
  }
});

// ── Full Control state ────────────────────────────────────
const localTeams = ref<TeamData[]>(
  JSON.parse(JSON.stringify(props.modelValue))
);

const hasChickenTeam = computed(() =>
  localTeams.value.some((t) => t.isChicken)
);

// ── Sync to parent ────────────────────────────────────────
watch(localTeams, (val) => {
  emit("update:modelValue", JSON.parse(JSON.stringify(val)));
}, { deep: true });

watch(generatedTeams, (val) => {
  if (hasGenerated.value) {
    emit("update:modelValue", JSON.parse(JSON.stringify(val)));
  }
}, { deep: true });

// ── Team generation ───────────────────────────────────────
function generateTeams() {
  const valid = rosterMembers.value
    .filter((m) => m.name.trim())
    .map((m) => ({ name: m.name.trim() }));

  if (valid.length < 2) return;

  // Fisher-Yates shuffle
  const shuffled = [...valid];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const teams: TeamData[] = [];

  // 1. Pick chickens from the shuffled pool
  const numChickens = Math.min(chickenCount.value, shuffled.length - 2);
  if (numChickens > 0) {
    const chickenMembers = shuffled.splice(0, numChickens);
    teams.push({
      name: "Chickens",
      members: chickenMembers,
      isChicken: true,
    });
  }

  // 2. Chunk remaining into hunter teams
  const size = teamSize.value;
  let teamNum = 1;
  for (let i = 0; i < shuffled.length; i += size) {
    teams.push({
      name: `Team ${teamNum++}`,
      members: shuffled.slice(i, i + size),
      isChicken: false,
    });
  }

  generatedTeams.value = teams;
  hasGenerated.value = true;
}

// ── Move member between teams ─────────────────────────────
function moveMember(fromTeam: number, memberIdx: number, toTeam: number) {
  if (fromTeam === toTeam) return;
  const member = generatedTeams.value[fromTeam].members.splice(memberIdx, 1)[0];
  generatedTeams.value[toTeam].members.push(member);

  // Remove empty teams (but not the chicken team)
  generatedTeams.value = generatedTeams.value.filter((t) => t.members.length > 0);

  // Re-number auto-named hunter teams
  let teamNum = 1;
  generatedTeams.value.forEach((t) => {
    if (!t.isChicken && /^Team \d+$/.test(t.name)) {
      t.name = `Team ${teamNum++}`;
    }
  });
}

// ── Full Control helpers ──────────────────────────────────
function addTeam() {
  const hunterTeams = localTeams.value.filter((t) => !t.isChicken);
  localTeams.value.push({
    name: `Team ${hunterTeams.length + 1}`,
    members: [{ name: "" }],
    isChicken: false,
  });
}

function addChickenTeam() {
  // Insert chicken team at the beginning
  localTeams.value.unshift({
    name: "Chickens",
    members: [{ name: "" }],
    isChicken: true,
  });
}

function toggleChickenTeam(index: number) {
  const team = localTeams.value[index];
  if (team.isChicken) {
    // Convert chicken → regular team
    team.isChicken = false;
  } else {
    // Convert regular → chicken (remove existing chicken team first)
    localTeams.value.forEach((t) => { t.isChicken = false; });
    team.isChicken = true;
  }
}

// ── Mode switching ────────────────────────────────────────
function switchToFullControl() {
  if (hasGenerated.value && generatedTeams.value.length > 0) {
    localTeams.value = JSON.parse(JSON.stringify(generatedTeams.value));
  }
  mode.value = "full";
}

function switchToQuickSetup() {
  // Flatten existing teams into the roster
  if (localTeams.value.length > 0) {
    const allMembers = localTeams.value
      .flatMap((t) => t.members)
      .filter((m) => m.name.trim());
    if (allMembers.length > 0) {
      rosterMembers.value = JSON.parse(JSON.stringify(allMembers));
    }
    // Restore chicken count from existing chicken team
    const existingChicken = localTeams.value.find((t) => t.isChicken);
    if (existingChicken) {
      chickenCount.value = existingChicken.members.filter((m) => m.name.trim()).length;
    }
  }
  hasGenerated.value = false;
  generatedTeams.value = [];
  mode.value = "quick";
}
</script>
