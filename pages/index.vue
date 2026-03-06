<template>
  <div class="max-w-[560px] mx-auto px-4 py-5 min-h-screen">
    <!-- Loading -->
    <LoadingSpinner v-if="auth.state.loading" message="Warming up the coop..." />

    <template v-else>
      <!-- ─── Hero: Join a Hunt ─────────────────────────── -->
      <div class="text-center pt-8 pb-2">
        <h1 class="m-0 text-4xl text-accent-dark">🐔 Chicken Run</h1>
        <p class="text-text-muted text-[15px] mt-1.5">The chickens are hiding. Find them before the money runs out.</p>
      </div>

      <div class="bg-surface border-[3px] border-accent rounded-[20px] p-7 mt-6 text-center">
        <h2 class="m-0 mb-1 text-[22px] text-accent-dark">Join a Hunt</h2>
        <p class="text-text-muted text-sm m-0 mb-5">Got a hunt code from your host? Jump straight in.</p>

        <!-- Step 1: Enter code -->
        <div v-if="joinStep === 'code'" class="flex flex-col gap-3">
          <input
            v-model="joinCode"
            type="text"
            placeholder="HUNT CODE"
            class="px-5 py-4 border-[3px] border-border rounded-[14px] text-[28px] font-extrabold tracking-[8px] text-center uppercase bg-bg text-accent-dark focus:outline-none focus:border-accent placeholder:text-lg placeholder:tracking-[4px] placeholder:font-semibold placeholder:text-text-muted placeholder:opacity-50"
            maxlength="6"
            @keyup.enter="validateCode"
          />
          <div v-if="joinError" class="px-3 py-2 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ joinError }}</div>
          <button class="px-6 py-3.5 border-0 rounded-[14px] cursor-pointer bg-accent text-white font-bold text-base transition-colors text-center no-underline block hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed" :disabled="joinLoading" @click="validateCode">
            {{ joinLoading ? "Checking..." : "Next →" }}
          </button>
        </div>

        <!-- Step 2: Enter email -->
        <div v-if="joinStep === 'email'" class="flex flex-col gap-3">
          <div class="flex items-center justify-center gap-2 p-2.5 bg-[#f0faf4] border-2 border-green rounded-[10px] text-sm">
            <span class="text-text-muted">Joining:</span>
            <span class="font-bold text-green">{{ foundHuntName || 'Hunt' }}</span>
          </div>
          <p class="text-text-muted text-[13px] m-0">Enter the email your host registered you with.</p>
          <input
            ref="emailInput"
            v-model="joinEmail"
            type="email"
            placeholder="your@email.com"
            class="px-5 py-3.5 border-[3px] border-border rounded-[14px] text-lg font-semibold text-center bg-bg focus:outline-none focus:border-accent"
            @keyup.enter="joinAsGuest"
          />
          <div v-if="joinError" class="px-3 py-2 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ joinError }}</div>
          <div class="flex gap-2.5">
            <button class="px-5 py-3.5 border-2 border-border rounded-[14px] cursor-pointer bg-surface font-semibold text-sm text-text-muted transition-all hover:border-accent hover:text-accent" @click="joinStep = 'code'">← Back</button>
            <button class="flex-1 px-6 py-3.5 border-0 rounded-[14px] cursor-pointer bg-accent text-white font-bold text-base transition-colors text-center no-underline block hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed" :disabled="joinLoading" @click="joinAsGuest">
              {{ joinLoading ? "Joining..." : "Let's Hunt!" }}
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Host section ──────────────────────────────── -->
      <div>
        <div class="flex items-center gap-4 my-8">
          <span class="flex-1 h-px bg-border"></span>
          <span class="text-text-muted text-[13px] font-semibold uppercase tracking-wider">or</span>
          <span class="flex-1 h-px bg-border"></span>
        </div>

        <!-- Not logged in: show Google sign-in -->
        <div v-if="!auth.isLoggedIn.value" class="bg-surface border-2 border-border rounded-[20px] p-6 text-center">
          <h3 class="m-0 mb-1 text-lg">Host a Hunt</h3>
          <p class="text-text-muted text-[13px] m-0 mb-4">Create hunts, get codes, run the show.</p>

          <div v-if="authError" class="px-3 py-2 mb-3 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ authError }}</div>

          <button
            class="w-full flex items-center justify-center gap-3 px-5 py-3 border-2 border-border rounded-xl cursor-pointer bg-white font-semibold text-[15px] text-text transition-all hover:border-accent hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="authLoading"
            @click="handleGoogleSignIn"
          >
            <!-- Google "G" logo -->
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {{ authLoading ? 'Redirecting...' : 'Sign in with Google' }}
          </button>
        </div>

        <!-- Logged in as host: show dashboard link -->
        <div v-else class="bg-surface border-2 border-border rounded-[20px] p-6 text-center flex flex-col gap-3">
          <div class="flex justify-between items-center font-semibold text-[15px]">
            <div class="flex items-center gap-2.5">
              <img
                v-if="auth.state.user?.avatarUrl"
                :src="auth.state.user.avatarUrl"
                class="w-8 h-8 rounded-full border-2 border-border"
                referrerpolicy="no-referrer"
              />
              <span>Hey {{ auth.state.user?.displayName }}!</span>
            </div>
            <button class="bg-transparent border-none text-text-muted text-[13px] cursor-pointer underline" @click="auth.logout()">Logout</button>
          </div>
          <NuxtLink to="/dashboard" class="px-6 py-3.5 border-0 rounded-[14px] cursor-pointer bg-accent text-white font-bold text-base transition-colors text-center no-underline block hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed w-full">
            Go to Host Dashboard
          </NuxtLink>
        </div>
      </div>

      <!-- ─── Bar Finder section ────────────────────────── -->
      <div>
        <div class="flex items-center gap-4 my-8">
          <span class="flex-1 h-px bg-border"></span>
          <span class="text-text-muted text-[13px] font-semibold uppercase tracking-wider">or</span>
          <span class="flex-1 h-px bg-border"></span>
        </div>

        <div class="bg-surface border-2 border-border rounded-[20px] p-6 text-center">
          <h3 class="m-0 mb-1 text-lg">Just Find a Bar</h3>
          <p class="text-text-muted text-[13px] m-0 mb-4">No hunt, no team — just find somewhere to drink near you.</p>
          <NuxtLink
            to="/bar-finder"
            class="px-6 py-3.5 border-0 rounded-[14px] cursor-pointer bg-accent text-white font-bold text-base transition-colors text-center no-underline block hover:bg-accent-dark"
          >
            Find Bars Nearby
          </NuxtLink>
        </div>
      </div>

      <footer class="text-center pt-7 pb-3 text-[13px] text-text-muted">
        <p class="m-0">🐔 Don't be a chicken — check every bar.</p>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth();
const router = useRouter();
const { signInWithGoogle } = useSupabaseClient();

// ── Join flow ─────────────────────────────────────────────
const joinStep = ref<"code" | "email">("code");
const joinCode = ref("");
const joinEmail = ref("");
const joinError = ref("");
const joinLoading = ref(false);
const foundHuntName = ref("");
const emailInput = ref<HTMLInputElement | null>(null);

// ── Host auth (Google OAuth) ──────────────────────────────
const authError = ref("");
const authLoading = ref(false);

onMounted(async () => {
  await auth.restore();
});

async function validateCode() {
  const code = joinCode.value.trim().toUpperCase();
  if (!code || code.length < 4) {
    joinError.value = "Enter a valid hunt code";
    return;
  }

  joinError.value = "";
  joinLoading.value = true;

  try {
    // Move to email step (full validation happens on join)
    foundHuntName.value = "";
    joinStep.value = "email";
    nextTick(() => emailInput.value?.focus());
  } finally {
    joinLoading.value = false;
  }
}

async function joinAsGuest() {
  const code = joinCode.value.trim();
  const emailVal = joinEmail.value.trim();

  if (!emailVal) {
    joinError.value = "Enter your email address";
    return;
  }

  joinError.value = "";
  joinLoading.value = true;

  try {
    const res = await $fetch<any>("/api/hunts/join-guest", {
      method: "POST",
      body: { code, email: emailVal },
    });

    // Store the session
    auth.setSession(
      {
        id: res.user.id,
        displayName: res.user.displayName,
        isGuest: true,
      },
      res.session
    );

    // Navigate to the hunt
    router.push(`/hunt/${res.huntId}`);
  } catch (e: any) {
    joinError.value = e?.data?.message || e?.message || "Failed to join hunt";
    // If code was bad, go back to code step
    if (joinError.value.toLowerCase().includes("invalid hunt code")) {
      joinStep.value = "code";
    }
  } finally {
    joinLoading.value = false;
  }
}

async function handleGoogleSignIn() {
  authError.value = "";
  authLoading.value = true;
  try {
    await signInWithGoogle();
    // Browser will redirect to Google, then back with tokens in URL hash
  } catch (e: any) {
    authError.value = e?.message || "Failed to start Google sign-in";
    authLoading.value = false;
  }
}
</script>
