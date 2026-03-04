<template>
  <div class="text-center py-16 text-text-muted">
    <div class="text-5xl animate-bounce-chicken">🐔</div>
    <p>{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), {
  message: "Loading...",
});
</script>
