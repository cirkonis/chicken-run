<!--
  MediaImage — renders a private hunt photo from its storage path.

  Why a component: our images live in a private bucket and are served by the
  /api/media proxy, which needs the user's access token. But <img> can't send an
  Authorization header, so we pass the token as a query param. This component
  builds that URL from a bare `path`, and — crucially — if the token has expired
  (image 401s), it refreshes once and retries. That closes the "broken photo"
  gap on long hunts.

  Usage: <MediaImage :path="checkIn.imagePath" class="..." @click="..." />
  Everything except `path` (class, style, loading, @click) falls through to <img>.
-->
<template>
  <img v-if="src" :src="src" @error="onError" />
</template>

<script setup lang="ts">
const props = defineProps<{ path?: string | null }>();

const auth = useAuth();
const triedRefresh = ref(false);
const cacheBust = ref(""); // appended to force <img> to refetch after a token refresh

const src = computed(() => {
  if (!props.path) return null;
  const token = auth.state.accessToken || "";
  return `/api/media/${props.path}?token=${encodeURIComponent(token)}${cacheBust.value}`;
});

async function onError() {
  // Refresh the token once and retry — handles the case where the JWT expired
  // while the page sat open (the old "photos vanish after a few hours" symptom).
  if (triedRefresh.value) return;
  triedRefresh.value = true;
  try {
    await auth.refreshAccessToken();
  } catch {
    /* nothing more we can do; the broken-image icon will show */
  }
  cacheBust.value = `&_r=${Date.now()}`;
}
</script>
