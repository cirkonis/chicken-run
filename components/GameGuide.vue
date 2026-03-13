<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] backdrop-blur-sm p-4"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="bg-surface rounded-[20px] w-full max-w-[440px] max-h-[85vh] shadow-[0_16px_48px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 class="m-0 text-lg font-bold text-accent-dark">🐔 How to Play</h2>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full border-2 border-border bg-bg text-text-muted text-sm font-bold cursor-pointer transition-all hover:border-red hover:text-red"
            @click="$emit('update:modelValue', false)"
          >✕</button>
        </div>

        <!-- Section tabs -->
        <div class="flex gap-1.5 px-5 pb-3 overflow-x-auto">
          <button
            v-for="(section, si) in sections"
            :key="section.id"
            type="button"
            class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap border-2"
            :class="activeSection === si
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-bg text-text-muted hover:border-accent hover:text-accent'"
            @click="selectSection(si)"
          >{{ section.label }}</button>
        </div>

        <!-- Page content area -->
        <div
          class="flex-1 overflow-y-auto px-5 pb-3 min-h-0"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div class="py-4 text-center">
            <!-- Page title -->
            <h3 class="m-0 mb-3 text-base font-bold text-accent-dark">{{ currentPage.title }}</h3>
            <!-- Page body -->
            <p
              v-for="(para, pi) in currentPage.body.split('\n')"
              :key="pi"
              class="text-sm text-text-muted leading-relaxed"
              :class="pi === 0 ? 'm-0' : 'mt-3 mb-0'"
            >{{ para }}</p>
          </div>
        </div>

        <!-- Navigation footer -->
        <div class="flex items-center justify-between px-5 py-3 border-t-2 border-border">
          <!-- Prev -->
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full border-2 cursor-pointer transition-all text-sm font-bold"
            :class="activePage > 0
              ? 'border-accent text-accent hover:bg-accent hover:text-white'
              : 'border-border text-border cursor-not-allowed'"
            :disabled="activePage === 0"
            @click="prevPage"
          >←</button>

          <!-- Dots -->
          <div class="flex gap-1.5">
            <button
              v-for="(_, pi) in currentPages"
              :key="pi"
              type="button"
              class="w-2 h-2 rounded-full border-0 cursor-pointer transition-all p-0"
              :class="activePage === pi ? 'bg-accent scale-125' : 'bg-border hover:bg-accent/50'"
              @click="activePage = pi"
            />
          </div>

          <!-- Next -->
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full border-2 cursor-pointer transition-all text-sm font-bold"
            :class="activePage < currentPages.length - 1
              ? 'border-accent text-accent hover:bg-accent hover:text-white'
              : 'border-border text-border cursor-not-allowed'"
            :disabled="activePage >= currentPages.length - 1"
            @click="nextPage"
          >→</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface GuidePage {
  title: string;
  body: string;
}

interface GuideSection {
  id: string;
  label: string;
  pages: GuidePage[];
}

defineProps<{ modelValue: boolean }>();
defineEmits<{ "update:modelValue": [value: boolean] }>();

const activeSection = ref(0);
const activePage = ref(0);

const sections: GuideSection[] = [
  {
    id: "rules",
    label: "The Rules",
    pages: [
      {
        title: "What is Chicken Hunt?",
        body: "Chicken Hunt is a bar crawl hunting game. A group of \"chickens\" pick a secret bar to hide at while teams of hunters race through the neighborhood trying to find them.\nThe chickens get a budget to spend on drinks while they wait. First team to find the chickens wins!",
      },
      {
        title: "How It Works",
        body: "The host picks a location and sets up teams. The app finds nearby bars automatically.\nChickens choose a secret bar — their \"coop\" — and spend the hunt budget on drinks. Hunters visit bars, check them off, and follow hints to track the chickens down.",
      },
      {
        title: "Fair Play",
        body: "Don't share the chickens' location with other teams. Don't mess with other teams' bar marks.\nThe chickens' coop is secret until the hunt ends. Play fair and have fun!",
      },
    ],
  },
  {
    id: "host",
    label: "I'm a Host",
    pages: [
      {
        title: "Setting Up",
        body: "Sign in and create a hunt from your dashboard. Pick a location and we'll find nearby bars automatically.\nSet up your teams, add player names, choose how many chickens you want, and set a budget for them to spend while hiding.",
      },
      {
        title: "Share the Codes",
        body: "Each team gets a unique join code. Flash the codes to your players or copy them to share. The chicken team gets their own code too.",
      },
      {
        title: "Running the Hunt",
        body: "Hit \"Start Hunt\" when everyone's ready. You can track progress from the manage page — see which bars have been checked, how the budget is doing, and when teams are getting close.\nWhen all the teams have found the chickens, hit \"End Hunt\" and everyone gets to see the full results and story of the hunt.",
      },
      {
        title: "Can I Play Too?",
        body: "Yes! The host can be a chicken or a hunter — just don't abuse your code knowledge powers.\nOnce the hunt is started, the hunt set up is locked. But for good measure, stay out of the manage page until the game ends.",
      },
    ],
  },
  {
    id: "chicken",
    label: "I'm a Chicken",
    pages: [
      {
        title: "Your Mission",
        body: "You're hiding! Join with your chicken code and you'll be asked to pick a bar as your secret coop.\nOnce the hunt starts, sit tight, order drinks on the budget, and watch the hunters scramble to find you. You must send a hint at whatever interval your group agrees on — keep the hunters on their toes!",
      },
      {
        title: "Dress Your Part",
        body: "You're a chicken — dress like one. Put on a chicken costume before the hunt starts.\nThe hunters need to be able to spot you when they walk into the bar!",
      },
    ],
  },
  {
    id: "hunter",
    label: "I'm a Hunter",
    pages: [
      {
        title: "Your Mission",
        body: "Find the chickens! Join with your team code, then hit the streets.\nVisit bars one by one — check them off when you've been, skip the ones you know are duds. Follow the hints the chickens send and use your instincts to track them down.",
      },
      {
        title: "Checking Bars",
        body: "When you visit a bar and the chickens aren't there, you must have a drink before you leave. Take a photo, check the bar off, and move on.\nUse the skip button for bars you know the chickens wouldn't hide in — no need to visit those.",
      },
      {
        title: "Team Battles",
        body: "If you run into another team on the streets, both teams must enter the nearest bar on the list together and have a shot.\nBoth teams check in together at that bar before going their separate ways. No exceptions!",
      },
      {
        title: "Found Them!",
        body: "When you find the chickens, celebrate — but do NOT check in at the bar. The chickens will add you as an arrival through their part of the app.\nOnce you're with the chickens, stop touching the bar check-in and skip buttons. The hunt is over for you — sit back and enjoy the drinks.",
      },
    ],
  },
];

const currentPages = computed(() => sections[activeSection.value].pages);
const currentPage = computed(() => currentPages.value[activePage.value]);

function selectSection(index: number) {
  activeSection.value = index;
  activePage.value = 0;
}

function prevPage() {
  if (activePage.value > 0) activePage.value--;
}

function nextPage() {
  if (activePage.value < currentPages.value.length - 1) activePage.value++;
}

// ── Swipe support ───────────────────────────────────────
let swipeStartX = 0;
let swipeStartY = 0;
let swiping = false;

function onPointerDown(e: PointerEvent) {
  swipeStartX = e.clientX;
  swipeStartY = e.clientY;
  swiping = true;
}

function onPointerMove(e: PointerEvent) {
  // prevent scroll while swiping horizontally
  if (!swiping) return;
  const dx = Math.abs(e.clientX - swipeStartX);
  const dy = Math.abs(e.clientY - swipeStartY);
  if (dx > dy && dx > 10) {
    e.preventDefault();
  }
}

function onPointerUp(e: PointerEvent) {
  if (!swiping) return;
  swiping = false;
  const dx = e.clientX - swipeStartX;
  const dy = Math.abs(e.clientY - swipeStartY);
  // Only register horizontal swipes (not vertical scrolls)
  if (Math.abs(dx) > 50 && Math.abs(dx) > dy) {
    if (dx < 0) nextPage();
    else prevPage();
  }
}
</script>
