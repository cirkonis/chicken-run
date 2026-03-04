<template>
  <div class="dash">
    <div v-if="!auth.isHost.value" class="no-access">
      <p>🐔 Hosts only! <NuxtLink to="/">Go back</NuxtLink></p>
    </div>

    <template v-else>
      <header class="dash-header">
        <div>
          <NuxtLink to="/" class="back-link">← Home</NuxtLink>
          <h1>Host Dashboard</h1>
          <p class="greeting">Hey {{ auth.state.user?.displayName }}! Your hunts, your rules.</p>
        </div>
        <button class="btn-sm" @click="auth.logout()">Logout</button>
      </header>

      <!-- Create Hunt -->
      <div class="create-card">
        <h2>Create a New Hunt</h2>
        <form @submit.prevent="createHunt" class="create-form">
          <input
            v-model="newHuntName"
            type="text"
            placeholder="Hunt name (e.g. Copenhagen Bar Crawl)"
            class="form-input"
            required
          />
          <div class="coord-row">
            <label>
              <span class="label-text">Lat</span>
              <input v-model="newLat" inputmode="decimal" class="form-input" required />
            </label>
            <label>
              <span class="label-text">Lng</span>
              <input v-model="newLng" inputmode="decimal" class="form-input" required />
            </label>
            <label>
              <span class="label-text">Radius (m)</span>
              <input v-model="newRadius" inputmode="numeric" class="form-input" />
            </label>
          </div>
          <div v-if="createError" class="form-error">{{ createError }}</div>
          <button type="submit" class="btn-primary" :disabled="creating">
            {{ creating ? "Creating..." : "🐔 Create Hunt" }}
          </button>
        </form>
      </div>

      <!-- My Hunts -->
      <div class="hunts-section">
        <h2>My Hunts</h2>

        <div v-if="huntsLoading" class="loading-inline">Loading hunts...</div>

        <div v-else-if="hunts.length === 0" class="empty-hunts">
          <p>🐔 No hunts yet. Create your first one above!</p>
        </div>

        <div v-else class="hunt-list">
          <div v-for="h in hunts" :key="h.id" class="hunt-card">
            <div class="hunt-top">
              <div class="hunt-name">{{ h.name }}</div>
              <span class="hunt-status" :class="'status-' + h.status">{{ h.status }}</span>
            </div>

            <div class="hunt-codes">
              <div class="code-box">
                <span class="code-label">Hunter Code</span>
                <span class="code-value">{{ h.hunterCode }}</span>
                <button class="copy-btn" @click="copyCode(h.hunterCode)" title="Copy">Copy</button>
              </div>
              <div class="code-box code-chicken">
                <span class="code-label">Chicken Code</span>
                <span class="code-value">{{ h.chickenCode }}</span>
                <button class="copy-btn" @click="copyCode(h.chickenCode)" title="Copy">Copy</button>
              </div>
            </div>

            <div class="hunt-meta">
              <span>{{ h.centerLat.toFixed(4) }}, {{ h.centerLng.toFixed(4) }}</span>
              <span>{{ h.radiusMeters }}m radius</span>
              <span>{{ formatDate(h.createdAt) }}</span>
            </div>

            <NuxtLink :to="`/hunt/${h.id}`" class="btn-enter">
              Enter Hunt →
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>

    <!-- Copied toast -->
    <Teleport to="body">
      <div v-if="showCopied" class="toast">Copied!</div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth();
const router = useRouter();

type Hunt = {
  id: string;
  name: string;
  hunterCode: string;
  chickenCode: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  status: string;
  role: string;
  createdAt: string;
};

const hunts = ref<Hunt[]>([]);
const huntsLoading = ref(true);

// Create hunt form
const newHuntName = ref("");
const newLat = ref("55.678831");
const newLng = ref("12.579570");
const newRadius = ref("1500");
const createError = ref("");
const creating = ref(false);

const showCopied = ref(false);

onMounted(() => {
  auth.restore();
  if (auth.isHost.value) {
    loadHunts();
  }
});

async function loadHunts() {
  huntsLoading.value = true;
  try {
    const res = await auth.authFetch<{ hunts: Hunt[] }>("/api/hunts");
    hunts.value = res.hunts;
  } catch {
    // silent
  } finally {
    huntsLoading.value = false;
  }
}

async function createHunt() {
  createError.value = "";
  creating.value = true;
  try {
    const res = await auth.authFetch<{ hunt: Hunt }>("/api/hunts", {
      method: "POST",
      body: {
        name: newHuntName.value.trim(),
        centerLat: Number(newLat.value),
        centerLng: Number(newLng.value),
        radiusMeters: Number(newRadius.value) || 1500,
      },
    });

    // Add to list
    hunts.value.unshift({
      ...res.hunt,
      role: "creator",
    });

    // Clear form
    newHuntName.value = "";
  } catch (e: any) {
    createError.value = e?.data?.message || e?.message || "Failed to create hunt";
  } finally {
    creating.value = false;
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    showCopied.value = true;
    setTimeout(() => (showCopied.value = false), 1500);
  } catch {
    // fallback
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return "";
  }
}
</script>

<style scoped>
.dash {
  max-width: 700px;
  margin: 0 auto;
  padding: 20px 16px;
}

.no-access {
  text-align: center;
  padding: 60px 0;
  color: var(--text-muted);
}

.no-access a { color: var(--accent); }

/* Header */
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.back-link {
  font-size: 13px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}

.back-link:hover { text-decoration: underline; }

.dash-header h1 {
  margin: 4px 0 0;
  font-size: 24px;
  color: var(--accent-dark);
}

.greeting {
  color: var(--text-muted);
  font-size: 14px;
  margin: 4px 0 0;
}

/* Create */
.create-card {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 18px;
  padding: 24px;
  margin-bottom: 28px;
}

.create-card h2 {
  margin: 0 0 14px;
  font-size: 18px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.coord-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.coord-row label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.form-input {
  padding: 10px 14px;
  border: 2px solid var(--border);
  border-radius: 12px;
  font-size: 14px;
  background: var(--bg);
  width: 100%;
}

.form-input:focus { outline: none; border-color: var(--accent); }

.form-error {
  padding: 8px 12px;
  background: #fef0ef;
  border: 2px solid var(--red);
  border-radius: 10px;
  font-size: 13px;
  color: var(--red);
  text-align: center;
}

.btn-primary {
  padding: 12px 24px;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  background: var(--accent);
  color: white;
  font-weight: 700;
  font-size: 15px;
  transition: background 0.15s;
}

.btn-primary:hover { background: var(--accent-dark); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-sm {
  padding: 6px 14px;
  border: 2px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  background: var(--surface);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}

.btn-sm:hover { border-color: var(--accent); color: var(--accent); }

/* Hunts list */
.hunts-section h2 {
  margin: 0 0 14px;
  font-size: 18px;
}

.loading-inline {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
}

.empty-hunts {
  text-align: center;
  padding: 28px;
  border: 2px dashed var(--border);
  border-radius: 16px;
  color: var(--text-muted);
}

.empty-hunts p { margin: 0; }

.hunt-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hunt-card {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 16px;
  padding: 18px;
}

.hunt-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.hunt-name {
  font-weight: 700;
  font-size: 16px;
}

.hunt-status {
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-active { background: #e8f5e9; color: var(--green); }
.status-completed { background: #f5f5f5; color: var(--gray); }
.status-archived { background: #f5f5f5; color: var(--gray); }

.hunt-codes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.code-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg);
  border: 2px solid var(--border);
  border-radius: 10px;
}

.code-chicken {
  border-color: var(--chicken-yellow);
  background: #fff8e1;
}

.code-label {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}

.code-value {
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--accent-dark);
  flex: 1;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.copy-btn:hover { opacity: 1; }

.hunt-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.btn-enter {
  display: block;
  text-align: center;
  padding: 10px;
  border: 2px solid var(--accent);
  border-radius: 12px;
  color: var(--accent);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-enter:hover {
  background: var(--accent);
  color: white;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background: var(--text);
  color: white;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  z-index: 9999;
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from { transform: translateX(-50%) translateY(10px); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}
</style>
