<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] backdrop-blur-sm"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="bg-surface rounded-[20px] p-7 w-[340px] max-w-[90vw] shadow-[0_16px_48px_rgba(0,0,0,0.2)] text-center">
        <div class="text-lg font-bold mb-2">{{ title }}</div>
        <p class="text-sm text-text-muted mb-5 leading-relaxed" v-html="message"></p>
        <div class="flex gap-2.5 justify-center">
          <button
            class="px-5 py-2.5 border-2 border-border rounded-xl cursor-pointer bg-surface text-text-muted font-semibold text-sm transition-all hover:border-accent hover:text-accent"
            @click="$emit('update:modelValue', false)"
          >Cancel</button>
          <button
            class="px-5 py-2.5 border-0 rounded-xl cursor-pointer font-semibold text-sm text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            :class="variant === 'danger' ? 'bg-red hover:bg-red/90' : 'bg-accent hover:bg-accent-dark'"
            :disabled="loading"
            @click="$emit('confirm')"
          >{{ loading ? 'Please wait...' : confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "danger" | "default";
    loading?: boolean;
  }>(),
  {
    confirmLabel: "Confirm",
    variant: "default",
    loading: false,
  }
);
defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
}>();
</script>
