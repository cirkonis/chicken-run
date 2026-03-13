<template>
  <button
    type="button"
    class="info-btn w-9 h-9 flex items-center justify-center rounded-full border-2 border-accent bg-surface text-accent font-bold text-sm cursor-pointer shadow-sm transition-all hover:bg-accent hover:text-white"
    :class="{ 'info-btn--shake': shouldShake }"
    title="How to play"
    @click="handleClick"
  >?</button>
</template>

<script setup lang="ts">
const STORAGE_KEY = "chickenrun_guide_seen";

const emit = defineEmits<{ click: [] }>();
const shouldShake = ref(false);

onMounted(() => {
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      shouldShake.value = true;
    }
  } catch {
    // localStorage unavailable
  }
});

function handleClick() {
  shouldShake.value = false;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
  emit("click");
}
</script>

<style scoped>
@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(12deg); }
  30% { transform: rotate(-10deg); }
  45% { transform: rotate(8deg); }
  60% { transform: rotate(-6deg); }
  75% { transform: rotate(3deg); }
}

.info-btn--shake {
  animation: shake 0.8s ease-in-out 0.5s 3;
}
</style>
