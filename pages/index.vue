<template>
  <div class="landing">
    <!-- Loading -->
    <div v-if="auth.state.loading" class="loading-screen">
      <div class="loading-chicken">🐔</div>
      <p>Warming up the coop...</p>
    </div>

    <template v-else>
      <!-- ─── Hero: Join a Hunt ─────────────────────────── -->
      <div class="hero">
        <h1>🐔 Chicken Run</h1>
        <p class="hero-sub">The chickens are hiding. Find them before the money runs out.</p>
      </div>

      <div class="join-card">
        <h2>Join a Hunt</h2>
        <p class="join-desc">Got a hunt code from your host? Jump straight in.</p>

        <!-- Step 1: Enter code -->
        <div v-if="joinStep === 'code'" class="join-form">
          <input
            v-model="joinCode"
            type="text"
            placeholder="HUNT CODE"
            class="code-input"
            maxlength="6"
            @keyup.enter="validateCode"
          />
          <div v-if="joinError" class="form-error">{{ joinError }}</div>
          <button class="btn-big" :disabled="joinLoading" @click="validateCode">
            {{ joinLoading ? "Checking..." : "Next →" }}
          </button>
        </div>

        <!-- Step 2: Enter nickname -->
        <div v-if="joinStep === 'nickname'" class="join-form">
          <div class="found-hunt">
            <span class="found-label">Joining:</span>
            <span class="found-name">{{ foundHuntName }}</span>
          </div>
          <input
            ref="nicknameInput"
            v-model="nickname"
            type="text"
            placeholder="Your nickname"
            class="nickname-input"
            maxlength="24"
            @keyup.enter="joinAsGuest"
          />
          <div v-if="joinError" class="form-error">{{ joinError }}</div>
          <div class="join-btns">
            <button class="btn-back" @click="joinStep = 'code'">← Back</button>
            <button class="btn-big" :disabled="joinLoading" @click="joinAsGuest">
              {{ joinLoading ? "Joining..." : "Let's Hunt!" }}
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Host section ──────────────────────────────── -->
      <div class="host-section">
        <div class="divider">
          <span>or</span>
        </div>

        <!-- Not logged in: show sign in -->
        <div v-if="!auth.isLoggedIn.value" class="host-card">
          <h3>Host a Hunt</h3>
          <p class="host-desc">Create hunts, get codes, run the show.</p>

          <div class="tab-row">
            <button :class="['tab', { active: authMode === 'login' }]" @click="authMode = 'login'">Sign In</button>
            <button :class="['tab', { active: authMode === 'signup' }]" @click="authMode = 'signup'">Sign Up</button>
          </div>

          <form @submit.prevent="handleAuth" class="auth-form">
            <input
              v-if="authMode === 'signup'"
              v-model="displayName"
              type="text"
              placeholder="Display name"
              class="form-input"
            />
            <input v-model="email" type="email" placeholder="Email" class="form-input" required />
            <input v-model="password" type="password" placeholder="Password" class="form-input" required />
            <div v-if="authError" class="form-error">{{ authError }}</div>
            <button type="submit" class="btn-host" :disabled="authLoading">
              {{ authLoading ? "Working..." : authMode === "login" ? "Sign In" : "Create Account" }}
            </button>
          </form>
        </div>

        <!-- Logged in as host: show dashboard link -->
        <div v-else class="host-card host-logged-in">
          <div class="host-user">
            <span>Hey {{ auth.state.user?.displayName }}!</span>
            <button class="btn-text" @click="auth.logout()">Logout</button>
          </div>
          <NuxtLink to="/dashboard" class="btn-big dashboard-link">
            Go to Host Dashboard
          </NuxtLink>
        </div>
      </div>

      <footer class="landing-footer">
        <p>🐔 Don't be a chicken — check every bar.</p>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth();
const router = useRouter();

// ── Join flow ─────────────────────────────────────────────
const joinStep = ref<"code" | "nickname">("code");
const joinCode = ref("");
const nickname = ref("");
const joinError = ref("");
const joinLoading = ref(false);
const foundHuntName = ref("");
const nicknameInput = ref<HTMLInputElement | null>(null);

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
    // Quick check — try to find the hunt name via a lightweight endpoint
    // We'll use the full join-guest endpoint but that creates a user...
    // Instead, let's just move to nickname step and validate on submit
    // For now, skip to nickname step (validation happens on join)
    foundHuntName.value = ""; // will be filled after join
    joinStep.value = "nickname";
    nextTick(() => nicknameInput.value?.focus());
  } finally {
    joinLoading.value = false;
  }
}

async function joinAsGuest() {
  const code = joinCode.value.trim();
  const nick = nickname.value.trim();

  if (!nick) {
    joinError.value = "Pick a nickname!";
    return;
  }

  joinError.value = "";
  joinLoading.value = true;

  try {
    const res = await $fetch<any>("/api/hunts/join-guest", {
      method: "POST",
      body: { code, nickname: nick },
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
    if (joinError.value.toLowerCase().includes("invalid")) {
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

<style scoped>
.landing {
  max-width: 560px;
  margin: 0 auto;
  padding: 20px 16px;
  min-height: 100vh;
}

.loading-screen {
  text-align: center;
  padding: 60px 0;
  color: var(--text-muted);
}

.loading-chicken {
  font-size: 48px;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

/* Hero */
.hero {
  text-align: center;
  padding: 32px 0 8px;
}

.hero h1 {
  margin: 0;
  font-size: 36px;
  color: var(--accent-dark);
}

.hero-sub {
  color: var(--text-muted);
  font-size: 15px;
  margin: 6px 0 0;
}

/* Join Card — the star of the show */
.join-card {
  background: var(--surface);
  border: 3px solid var(--accent);
  border-radius: 20px;
  padding: 28px;
  margin-top: 24px;
  text-align: center;
}

.join-card h2 {
  margin: 0 0 4px;
  font-size: 22px;
  color: var(--accent-dark);
}

.join-desc {
  color: var(--text-muted);
  font-size: 14px;
  margin: 0 0 20px;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.code-input {
  padding: 16px 20px;
  border: 3px solid var(--border);
  border-radius: 14px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 8px;
  text-align: center;
  text-transform: uppercase;
  background: var(--bg);
  color: var(--accent-dark);
}

.code-input:focus {
  outline: none;
  border-color: var(--accent);
}

.code-input::placeholder {
  font-size: 18px;
  letter-spacing: 4px;
  font-weight: 600;
  color: var(--text-muted);
  opacity: 0.5;
}

.nickname-input {
  padding: 14px 20px;
  border: 3px solid var(--border);
  border-radius: 14px;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  background: var(--bg);
}

.nickname-input:focus {
  outline: none;
  border-color: var(--accent);
}

.found-hunt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: #f0faf4;
  border: 2px solid var(--green);
  border-radius: 10px;
  font-size: 14px;
}

.found-label { color: var(--text-muted); }
.found-name { font-weight: 700; color: var(--green); }

.btn-big {
  padding: 14px 24px;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
  background: var(--accent);
  color: white;
  font-weight: 700;
  font-size: 16px;
  transition: background 0.15s;
  text-align: center;
  text-decoration: none;
  display: block;
}

.btn-big:hover { background: var(--accent-dark); }
.btn-big:disabled { opacity: 0.6; cursor: not-allowed; }

.join-btns {
  display: flex;
  gap: 10px;
}

.btn-back {
  padding: 14px 20px;
  border: 2px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
  background: var(--surface);
  font-weight: 600;
  font-size: 14px;
  color: var(--text-muted);
  transition: all 0.15s;
}

.btn-back:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.form-error {
  padding: 8px 12px;
  background: #fef0ef;
  border: 2px solid var(--red);
  border-radius: 10px;
  font-size: 13px;
  color: var(--red);
  text-align: center;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 32px 0;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.divider span {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Host section */
.host-card {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  text-align: center;
}

.host-card h3 {
  margin: 0 0 4px;
  font-size: 18px;
}

.host-desc {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px;
}

.tab-row {
  display: flex;
  gap: 4px;
  background: var(--bg);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
}

.tab {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-muted);
  transition: all 0.15s;
}

.tab.active {
  background: var(--surface);
  color: var(--accent-dark);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-input {
  padding: 10px 14px;
  border: 2px solid var(--border);
  border-radius: 12px;
  font-size: 14px;
  background: var(--bg);
  width: 100%;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-host {
  padding: 10px 20px;
  border: 2px solid var(--accent);
  border-radius: 12px;
  cursor: pointer;
  background: transparent;
  color: var(--accent);
  font-weight: 600;
  font-size: 14px;
  transition: all 0.15s;
}

.btn-host:hover {
  background: var(--accent);
  color: white;
}

.btn-host:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Logged in host */
.host-logged-in {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.host-user {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 15px;
}

.btn-text {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}

.dashboard-link {
  width: 100%;
}

/* Footer */
.landing-footer {
  text-align: center;
  padding: 28px 0 12px;
  font-size: 13px;
  color: var(--text-muted);
}

.landing-footer p { margin: 0; }
</style>
