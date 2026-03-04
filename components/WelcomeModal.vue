<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] backdrop-blur-sm"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="bg-surface rounded-[20px] p-7 max-w-[520px] w-[340px] max-w-[90vw] shadow-[0_16px_48px_rgba(0,0,0,0.2)] text-left">
        <div class="text-lg font-bold mb-4">🐔 Welcome to the Chicken Run!</div>
        <div class="my-4">
          <p class="mb-4 text-sm leading-relaxed">The hunt is on! Two sneaky chickens are hiding in a bar. Your mission: find them before the money is gone.</p>
          <div class="flex gap-3 p-3 bg-bg rounded-xl mb-2.5 border-2 border-border">
            <div class="text-2xl shrink-0">&#10003;</div>
            <div class="text-[13px] leading-snug"><strong class="text-accent-dark">Checked a bar?</strong><br>Hit the green checkmark if you visited and the chickens weren't there.</div>
          </div>
          <div class="flex gap-3 p-3 bg-bg rounded-xl mb-2.5 border-2 border-border">
            <div class="text-2xl shrink-0">&#10005;</div>
            <div class="text-[13px] leading-snug"><strong class="text-accent-dark">Skip the duds</strong><br>Hit the red X for bars you <em>know</em> the chickens wouldn't hide in.</div>
          </div>
          <div class="flex gap-3 p-3 bg-[#fff8e1] rounded-xl mb-2.5 border-2 border-chicken-yellow">
            <div class="text-2xl shrink-0">🐔</div>
            <div class="text-[13px] leading-snug"><strong class="text-accent-dark">Found a chicken?!</strong><br>DON'T touch any buttons! Just celebrate quietly and let others keep hunting.</div>
          </div>
          <p class="text-[13px] text-text-muted italic mt-3 p-2.5 bg-[#fef0ef] rounded-lg border border-red">Be a champ -- don't sabotage other hunters by messing with their marks.</p>
        </div>
        <div class="flex gap-2.5 justify-center mt-4">
          <button
            class="px-6 py-2.5 border-0 rounded-xl cursor-pointer bg-accent text-white font-semibold text-sm transition-colors hover:bg-accent-dark"
            @click="$emit('update:modelValue', false)"
          >Let's hunt!</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean }>();
defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>
