<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
    :class="endedAt
      ? 'bg-text-muted/10 border border-text-muted/30 text-text-muted'
      : 'bg-green/10 border border-green/30 text-green'"
  >
    <span v-if="!endedAt" class="w-1.5 h-1.5 rounded-full bg-green animate-pulse"></span>
    {{ elapsed }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  startedAt: string;
  endedAt?: string | null;
}>();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

const elapsed = computed(() => {
  const start = new Date(props.startedAt).getTime();
  const end = props.endedAt ? new Date(props.endedAt).getTime() : now.value;
  const diff = Math.max(0, end - start);

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
  // Only tick if the hunt is still running
  if (!props.endedAt) {
    timer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }
});

watch(() => props.endedAt, (val) => {
  if (val && timer) {
    clearInterval(timer);
    timer = null;
  }
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
</script>
