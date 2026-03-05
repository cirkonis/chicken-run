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

        <!-- Not logged in: show sign in -->
        <div v-if="!auth.isLoggedIn.value" class="bg-surface border-2 border-border rounded-[20px] p-6 text-center">
          <h3 class="m-0 mb-1 text-lg">Host a Hunt</h3>
          <p class="text-text-muted text-[13px] m-0 mb-4">Create hunts, get codes, run the show.</p>

          <div class="flex gap-1 bg-bg rounded-xl p-1 mb-4">
            <button :class="['flex-1 py-2 border-none rounded-[10px] cursor-pointer font-semibold text-[13px] transition-all', authMode === 'login' ? 'bg-surface text-accent-dark shadow-sm' : 'bg-transparent text-text-muted']" @click="authMode = 'login'">Sign In</button>
            <button :class="['flex-1 py-2 border-none rounded-[10px] cursor-pointer font-semibold text-[13px] transition-all', authMode === 'signup' ? 'bg-surface text-accent-dark shadow-sm' : 'bg-transparent text-text-muted']" @click="authMode = 'signup'">Sign Up</button>
          </div>

          <form @submit.prevent="handleAuth" class="flex flex-col gap-2.5">
            <input
              v-if="authMode === 'signup'"
              v-model="displayName"
              type="text"
              placeholder="Display name"
              class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent"
            />
            <input v-model="email" type="email" placeholder="Email" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" required />
            <input v-model="password" type="password" placeholder="Password" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" required />
            <div v-if="authError" class="px-3 py-2 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">{{ authError }}</div>
            <button type="submit" class="px-5 py-2.5 border-2 border-accent rounded-xl cursor-pointer bg-transparent text-accent font-semibold text-sm transition-all hover:bg-accent hover:text-white disabled:opacity-60 disabled:cursor-not-allowed" :disabled="authLoading">
              {{ authLoading ? "Working..." : authMode === "login" ? "Sign In" : "Create Account" }}
            </button>
          </form>
        </div>

        <!-- Logged in as host: show dashboard link -->
        <div v-else class="bg-surface border-2 border-border rounded-[20px] p-6 text-center flex flex-col gap-3">
          <div class="flex justify-between items-center font-semibold text-[15px]">
            <span>Hey {{ auth.state.user?.displayName }}!</span>
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
          <h3 class="m-0 mb-1 text-lg">🍺 Just Find a Bar</h3>
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

// ── Join flow ─────────────────────────────────────────────
const joinStep = ref<"code" | "email">("code");
const joinCode = ref("");
const joinEmail = ref("");
const joinError = ref("");
const joinLoading = ref(false);
const foundHuntName = ref("");
const emailInput = ref<HTMLInputElement | null>(null);

// If user is already a guest with an active session, redirect to hunt
onMounted(() => {
  auth.restore();
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

// ── Host auth ─────────────────────────────────────────────
const authMode = ref<"login" | "signup">("login");
const email = ref("");
const password = ref("");
const displayName = ref("");
const authError = ref("");
const authLoading = ref(false);

async function handleAuth() {
  authError.value = "";
  authLoading.value = true;
  try {
    if (authMode.value === "signup") {
      await auth.signup(email.value, password.value, displayName.value || undefined);
    } else {
      await auth.login(email.value, password.value);
    }
    // After login, stay on page (they'll see the dashboard link)
  } catch (e: any) {
    authError.value = e?.data?.message || e?.message || "Authentication failed";
  } finally {
    authLoading.value = false;
  }
}
</script>
