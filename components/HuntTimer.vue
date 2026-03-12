<template>
  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green/10 border border-green/30 rounded-lg text-xs font-semibold text-green">
    <span class="w-1.5 h-1.5 rounded-full bg-green animate-pulse"></span>
    {{ elapsed }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  startedAt: string;
}>();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

const elapsed = computed(() => {
  const start = new Date(props.startedAt).getTime();
  const diff = Math.max(0, now.value - start);

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
});

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
</script>
