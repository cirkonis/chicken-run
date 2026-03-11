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

      <!-- Generated teams -->
      <div v-if="hasGenerated && generatedTeams.length > 0" class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold m-0">Generated Teams</h3>
        <div
          v-for="(team, ti) in generatedTeams"
          :key="ti"
          class="border-2 border-border rounded-xl p-4 bg-bg"
        >
          <div class="font-semibold text-sm mb-2 text-accent-dark">{{ team.name }}</div>
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
        <button
          type="button"
          class="px-3 py-1.5 border-2 border-dashed border-border rounded-lg bg-transparent text-xs text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
          @click="addTeam"
        >+ Add team</button>
      </div>

      <p v-if="localTeams.length === 0" class="text-text-muted text-sm m-0">
        No teams configured. Add a team to get started.
      </p>

      <div
        v-for="(team, ti) in localTeams"
        :key="ti"
        class="border-2 border-border rounded-xl p-4 bg-bg"
      >
        <div class="flex items-center gap-2 mb-3">
          <input
            v-model="team.name"
            type="text"
            class="flex-1 px-3 py-2 border-2 border-border rounded-lg text-sm bg-surface font-semibold focus:outline-none focus:border-accent"
            :placeholder="`Team ${ti + 1}`"
          />
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
              class="flex-1 px-2.5 py-2 border-2 border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-accent"
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
            class="self-start px-3 py-1.5 border-2 border-dashed border-border rounded-lg bg-transparent text-xs text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent"
            @click="team.members.push({ name: '' })"
          >+ Add member</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamMemberInput } from "~/types";

type TeamData = { name: string; members: TeamMemberInput[] };

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
const generatedTeams = ref<TeamData[]>([]);
const hasGenerated = ref(false);

const validMemberCount = computed(() =>
  rosterMembers.value.filter((m) => m.name.trim()).length
);

// ── Full Control state ────────────────────────────────────
const localTeams = ref<TeamData[]>(
  JSON.parse(JSON.stringify(props.modelValue))
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

  // Chunk into teams
  const size = teamSize.value;
  const teams: TeamData[] = [];
  for (let i = 0; i < shuffled.length; i += size) {
    teams.push({
      name: `Team ${teams.length + 1}`,
      members: shuffled.slice(i, i + size),
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

  // Remove empty teams
  generatedTeams.value = generatedTeams.value.filter((t) => t.members.length > 0);

  // Re-number auto-named teams
  generatedTeams.value.forEach((t, i) => {
    if (/^Team \d+$/.test(t.name)) {
      t.name = `Team ${i + 1}`;
    }
  });
}

// ── Full Control helpers ──────────────────────────────────
function addTeam() {
  localTeams.value.push({
    name: `Team ${localTeams.value.length + 1}`,
    members: [{ name: "" }],
  });
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
  }
  hasGenerated.value = false;
  generatedTeams.value = [];
  mode.value = "quick";
}
</script>
