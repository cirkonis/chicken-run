<template>
  <li
    class="grid grid-cols-[1fr_auto] gap-2.5 border-2 rounded-[14px] p-3 bg-surface transition-all cursor-pointer"
    :class="{
      'border-accent bg-[#fff8f0] scale-[1.01] shadow-md': selected,
      'border-green bg-[#f0faf4] opacity-75': !selected && bar.checkStatus === 'checked',
      'border-gray bg-[#f5f5f5] opacity-50': !selected && bar.checkStatus === 'not_checking',
      'border-border': !selected && bar.checkStatus === 'unchecked',
    }"
    :data-bar-id="bar.id"
    @click="$emit('select', bar)"
  >
    <!-- Bar info -->
    <div>
      <div class="text-[15px] leading-snug font-medium">{{ bar.name }}</div>
      <div class="text-[13px] text-text-muted mt-0.5">{{ bar.address }}</div>
      <a
        :href="bar.mapsUrl"
        target="_blank"
        rel="noreferrer"
        class="text-xs no-underline text-accent font-semibold hover:underline mt-1 inline-block"
        @click.stop
      >Open in Maps</a>
    </div>

    <!-- Status + action buttons (right side).
         One status, one way out — deliberately NO shortcut between maybe and
         skip. From either you go back to unchecked first, then pick again. Two
         taps, but it's always unambiguous which state you're leaving.

         NOTE: `toggle(bar, 'checked')` means different things per caller,
         because the handlers differ. In a hunt it opens the check-in modal; in
         the bar finder it just clears the status. That's why every label comes
         from `labels` rather than being hardcoded here. -->
    <div class="flex flex-col gap-1.5 items-end justify-center">
      <!-- Maybe (finder: un-maybe back to unchecked) / checked-in (hunt: log
           another team's check-in) -->
      <template v-if="bar.checkStatus === 'checked'">
        <span v-if="labels.checkedNote" class="text-xs font-semibold text-green whitespace-nowrap">{{ labels.checkedNote }}</span>
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all whitespace-nowrap min-w-[100px] text-center border-green bg-[#f0faf4] text-green hover:bg-green hover:text-white"
          @click.stop="$emit('toggle', bar, 'checked')"
        >{{ labels.checkedActive }}</button>
      </template>

      <!-- Skipped → back to unchecked -->
      <template v-else-if="bar.checkStatus === 'not_checking'">
        <span v-if="labels.notCheckingNote" class="text-xs font-semibold text-text-muted whitespace-nowrap">{{ labels.notCheckingNote }}</span>
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all whitespace-nowrap min-w-[100px] text-center border-gray bg-gray text-white hover:bg-gray/80"
          @click.stop="$emit('toggle', bar, 'not_checking')"
        >{{ labels.notCheckingActive }}</button>
      </template>

      <!-- Unchecked → the only state offering a choice -->
      <template v-else>
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all whitespace-nowrap min-w-[100px] text-center border-green/40 bg-[#f0faf4] text-green hover:border-green hover:bg-green/10"
          @click.stop="$emit('toggle', bar, 'checked')"
        >{{ labels.checked }}</button>
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all whitespace-nowrap min-w-[100px] text-center border-border bg-bg text-text-muted hover:border-gray hover:bg-gray/10"
          @click.stop="$emit('toggle', bar, 'not_checking')"
        >{{ labels.not_checking }}</button>
      </template>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { HuntBar } from "~/types";

withDefaults(
  defineProps<{
    bar: HuntBar;
    selected?: boolean;
    /**
     * Wording for the action buttons + the status note. `*Active` is the button
     * label while the bar is already in that status; `*Note` is the little text
     * above it (pass "" to render no note). Defaults are the HUNT wording — the
     * bar finder overrides them, since the same `toggle` event does something
     * different there (see the note in the template).
     */
    labels?: {
      checked: string;
      checkedActive: string;
      checkedNote: string;
      not_checking: string;
      notCheckingActive: string;
      notCheckingNote: string;
    };
  }>(),
  {
    selected: false,
    labels: () => ({
      checked: "Check In",
      checkedActive: "+ Check in",
      checkedNote: "Visited and checked",
      not_checking: "Maybe Skip",
      notCheckingActive: "Unskip",
      notCheckingNote: "",
    }),
  }
);
defineEmits<{
  toggle: [bar: HuntBar, target: string];
  select: [bar: HuntBar];
}>();
</script>
