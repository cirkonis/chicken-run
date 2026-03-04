<template>
  <div class="wrap">
    <!-- Loading -->
    <div v-if="pageLoading" class="loading-screen">
      <div class="loading-chicken">🐔</div>
      <p>Loading hunt...</p>
    </div>

    <template v-else-if="hunt">
      <header class="top">
        <div class="title-row">
          <div class="title-group">
            <button class="back-btn" @click="goBack" title="Back">← Back</button>
            <h1>🐔 {{ hunt.name }}</h1>
            <span class="tagline">
              Playing as <strong>{{ auth.state.user?.displayName || 'Unknown' }}</strong>
              <template v-if="participants.length > 1"> · {{ participants.length }} hunters</template>
            </span>
          </div>
          <div class="header-right">
            <div class="hunt-codes" v-if="isCreator">
              <div class="code-chip">
                <span class="code-chip-label">Hunter Code</span>
                <span class="code-chip-value">{{ hunt.hunterCode }}</span>
              </div>
            </div>
            <button class="info-btn" @click="showWelcomeModal = true" title="Show instructions">i</button>
          </div>
        </div>

        <div class="controls">
          <button
            class="btn-search"
            :disabled="searching"
            @click="searchBars"
          >
            {{ searching ? "Searching the coop..." : bars.length ? "Re-search bars" : "Hunt bars" }}
          </button>

          <span class="meta" v-if="bars.length">
            <b>{{ bars.length }}</b> bars in the zone
          </span>

          <span class="meta participants" v-if="participants.length > 1">
            {{ participants.length }} hunters
          </span>
        </div>
      </header>

      <main>
        <!-- Map -->
        <section class="map-section">
          <div class="map-toolbar">
            <button class="map-toggle" @click="mapOpen = !mapOpen">
              {{ mapOpen ? "Hide map" : "Show map" }}
            </button>
          </div>
          <div v-show="mapOpen" class="map-collapsible">
            <div ref="mapEl" class="mapEl"></div>
            <div class="map-legend">
              <span class="legend-item"><span class="dot dot-unchecked"></span> Not visited</span>
              <span class="legend-item"><span class="dot dot-checked"></span> Visited</span>
              <span class="legend-item"><span class="dot dot-skip"></span> Skipping</span>
            </div>
          </div>
        </section>

        <section class="list">
          <!-- Hints -->
          <div class="hints-box" v-if="hints.length || bars.length">
            <div class="hints-header">
              <span>Chicken hints</span>
              <button class="btn-sm" @click="showHintInput = !showHintInput">+ Add hint</button>
            </div>
            <ul class="hints-list" v-if="hints.length">
              <li v-for="h in hints" :key="h.id">
                <span>{{ h.text }}</span>
                <span class="hint-time">
                  {{ h.authorName }} · {{ formatTime(h.createdAt) }}
                </span>
              </li>
            </ul>
            <p v-else class="no-hints">No hints yet. The chickens are silent...</p>
          </div>

          <div v-if="showHintInput" class="hint-input-row">
            <input
              v-model="newHint"
              placeholder="What did the chickens say?"
              @keyup.enter="addHint"
            />
            <button class="btn-sm" @click="addHint">Add</button>
          </div>

          <!-- Toolbar -->
          <div class="toolbar" v-if="bars.length">
            <input v-model="filter" placeholder="Filter bars..." />
            <select v-model="statusFilter">
              <option value="all">All</option>
              <option value="unchecked">Unchecked</option>
              <option value="checked">Visited</option>
              <option value="not_checking">Skipping</option>
            </select>
            <button class="btn-sm" @click="refreshHunt" :disabled="syncing">
              {{ syncing ? "Refreshing..." : "Refresh" }}
            </button>
          </div>

          <!-- Stats -->
          <div class="stats" v-if="bars.length">
            <div class="stat">
              <span class="stat-num">{{ statusCounts.unchecked }}</span>
              <span class="stat-label">To check</span>
            </div>
            <div class="stat stat-good">
              <span class="stat-num">{{ statusCounts.checked }}</span>
              <span class="stat-label">Visited</span>
            </div>
            <div class="stat stat-skip">
              <span class="stat-num">{{ statusCounts.not_checking }}</span>
              <span class="stat-label">Skipping</span>
            </div>
            <div class="stat stat-drinks">
              <span class="stat-num">{{ statusCounts.checked }}</span>
              <span class="stat-label">Drinks deep</span>
            </div>
          </div>

          <div v-if="error" class="error">{{ error }}</div>

          <!-- Empty state -->
          <div v-if="!bars.length && !searching" class="empty">
            <p>🐔 The chickens are hiding somewhere...</p>
            <p>Hit "Hunt bars" to search for bars around this hunt's location.</p>
          </div>

          <!-- Bar list -->
          <ul v-else-if="bars.length" class="items">
            <li
              v-for="b in filteredBars"
              :key="b.id"
              class="item"
              :class="{
                'item-checked': b.checkStatus === 'checked',
                'item-skip': b.checkStatus === 'not_checking',
              }"
            >
              <div>
                <div class="bar-name">{{ b.name }}</div>
                <div class="bar-addr">{{ b.address }}</div>
                <div class="bar-meta">
                  <span v-if="b.rating">{{ b.rating }}</span>
                  <span v-if="b.ratingsTotal" class="ratings-count">({{ b.ratingsTotal }})</span>
                  <span v-if="b.priceLevel">{{ '$'.repeat(b.priceLevel) }}</span>
                </div>
              </div>
              <div class="right">
                <div class="status-btns">
                  <button
                    class="sbtn sbtn-checked"
                    :class="{ active: b.checkStatus === 'checked' }"
                    @click="toggleStatus(b, 'checked')"
                    title="Mark as visited"
                  >&#10003;</button>
                  <button
                    class="sbtn sbtn-skip"
                    :class="{ active: b.checkStatus === 'not_checking' }"
                    @click="toggleStatus(b, 'not_checking')"
                    title="Skip this one"
                  >&#10005;</button>
                </div>
                <a :href="b.mapsUrl" target="_blank" rel="noreferrer" class="maps-link">Maps</a>
              </div>
            </li>
          </ul>
        </section>
      </main>

      <footer class="footer">
        <p>🐔 Don't be a chicken — check every bar. Or at least the ones that look fun.</p>
      </footer>
    </template>

    <!-- Welcome modal -->
    <Teleport to="body">
      <div v-if="showWelcomeModal" class="modal-overlay" @click.self="showWelcomeModal = false">
        <div class="modal welcome-modal">
          <div class="modal-title">🐔 Welcome to the Chicken Run!</div>
          <div class="welcome-content">
            <p>The hunt is on! Two sneaky chickens are hiding in a bar. Your mission: find them before the money is gone.</p>
            <div class="rule-box">
              <div class="rule-icon">&#10003;</div>
              <div><strong>Checked a bar?</strong><br>Hit the green checkmark if you visited and the chickens weren't there.</div>
            </div>
            <div class="rule-box">
              <div class="rule-icon">&#10005;</div>
              <div><strong>Skip the duds</strong><br>Hit the red X for bars you <em>know</em> the chickens wouldn't hide in.</div>
            </div>
            <div class="rule-box chicken-found">
              <div class="rule-icon">🐔</div>
              <div><strong>Found a chicken?!</strong><br>DON'T touch any buttons! Just celebrate quietly and let others keep hunting.</div>
            </div>
            <p class="warning-text">Be a champ -- don't sabotage other hunters by messing with their marks.</p>
          </div>
          <div class="modal-actions">
            <button class="btn-primary" @click="showWelcomeModal = false">Let's hunt!</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// Vue composables are auto-imported by Nuxt

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const huntId = route.params.id as string;

function goBack() {
  if (auth.isHost.value) {
    router.push("/dashboard");
  } else {
    // Guest — logout and go home
    auth.logout();
  }
}

// ── Types ─────────────────────────────────────────────────
type HuntBar = {
  id: string;
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingsTotal: number | null;
  priceLevel: number | null;
  status: string | null;
  mapsUrl: string;
  category: string;
  checkStatus: string;
  checkedBy: string | null;
  checkedAt: string | null;
};

type Hint = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

type Participant = {
  userId: string;
  role: string;
  displayName: string;
};

// ── State ─────────────────────────────────────────────────
const pageLoading = ref(true);
const searching = ref(false);
const syncing = ref(false);
const error = ref<string | null>(null);
const mapOpen = ref(true);

const hunt = ref<{
  id: string;
  name: string;
  hunterCode: string;
  chickenCode: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  status: string;
  creatorId: string;
} | null>(null);

const bars = ref<HuntBar[]>([]);
const hints = ref<Hint[]>([]);
const participants = ref<Participant[]>([]);

const filter = ref("");
const statusFilter = ref("all");
const showHintInput = ref(false);
const newHint = ref("");
const showWelcomeModal = ref(false);

// ── Computed ──────────────────────────────────────────────
const isCreator = computed(() => hunt.value?.creatorId === auth.state.user?.id);

const statusCounts = computed(() => {
  let unchecked = 0, checked = 0, not_checking = 0;
  for (const b of bars.value) {
    if (b.checkStatus === "checked") checked++;
    else if (b.checkStatus === "not_checking") not_checking++;
    else unchecked++;
  }
  return { unchecked, checked, not_checking };
});

const filteredBars = computed(() => {
  let result = bars.value;
  const f = filter.value.trim().toLowerCase();
  if (f) {
    result = result.filter((b) =>
      `${b.name} ${b.address}`.toLowerCase().includes(f)
    );
  }
  if (statusFilter.value !== "all") {
    result = result.filter((b) => b.checkStatus === statusFilter.value);
  }
  return result;
});

// ── Leaflet map ───────────────────────────────────────────
const { $L } = useNuxtApp();
const mapEl = ref<HTMLDivElement | null>(null);
let map: any = null;
let centerMarker: any = null;
let circleOverlay: any = null;
let markersLayer: any = null;

watch(mapOpen, (open) => {
  if (open && map) nextTick(() => map.invalidateSize());
});

function initMap(center: { lat: number; lng: number }, radius: number) {
  if (!mapEl.value || !$L) return;

  if (!map) {
    map = $L.map(mapEl.value).setView([center.lat, center.lng], 15);
    $L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    markersLayer = $L.layerGroup().addTo(map);
  } else {
    map.setView([center.lat, center.lng], 15);
    markersLayer.clearLayers();
  }

  if (centerMarker) centerMarker.remove();
  if (circleOverlay) circleOverlay.remove();

  const chickenIcon = $L.divIcon({
    html: '<div style="font-size:28px;text-align:center;">🐔</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "chicken-icon",
  });

  centerMarker = $L.marker([center.lat, center.lng], { icon: chickenIcon })
    .addTo(map)
    .bindPopup("Hunt center");

  circleOverlay = $L.circle([center.lat, center.lng], {
    radius,
    color: "#e67e22",
    fillColor: "#f39c12",
    fillOpacity: 0.1,
    weight: 2,
    dashArray: "8 4",
  }).addTo(map);

  map.fitBounds(circleOverlay.getBounds(), { padding: [20, 20] });
}

function paintMarkers() {
  if (!markersLayer || !$L) return;
  markersLayer.clearLayers();

  for (const b of bars.value) {
    const symbol = b.checkStatus === "checked" ? "&#10003;" : b.checkStatus === "not_checking" ? "&#10005;" : "?";
    const color = b.checkStatus === "checked" ? "#27ae60" : b.checkStatus === "not_checking" ? "#95a5a6" : "#e74c3c";

    const icon = $L.divIcon({
      html: `<div style="font-size:14px;text-align:center;background:${color};color:white;border-radius:50%;width:28px;height:28px;line-height:28px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);">${symbol}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: "bar-icon",
    });

    const m = $L.marker([b.lat, b.lng], { icon }).addTo(markersLayer);
    m.bindPopup(
      `<b>${escapeHtml(b.name)}</b><br/>${escapeHtml(b.address)}<br/><a href="${b.mapsUrl}" target="_blank" rel="noreferrer">Open in Maps</a>`
    );
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

// ── Data loading ──────────────────────────────────────────
async function loadHunt() {
  try {
    const res = await auth.authFetch<any>(`/api/hunts/${huntId}`);
    hunt.value = res.hunt;
    bars.value = res.bars;
    hints.value = res.hints;
    participants.value = res.participants;
    pageLoading.value = false;

    await nextTick();
    initMap(
      { lat: res.hunt.centerLat, lng: res.hunt.centerLng },
      res.hunt.radiusMeters
    );
    paintMarkers();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to load hunt";
    pageLoading.value = false;
  }
}

async function searchBars() {
  if (!hunt.value) return;
  searching.value = true;
  error.value = null;

  try {
    const res = await auth.authFetch<any>(`/api/hunts/${huntId}/bars/search`, {
      method: "POST",
    });
    bars.value = res.bars;
    paintMarkers();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Search failed";
  } finally {
    searching.value = false;
  }
}

async function toggleStatus(bar: HuntBar, target: string) {
  const newStatus = bar.checkStatus === target ? "unchecked" : target;
  const oldStatus = bar.checkStatus;

  // Optimistic
  bar.checkStatus = newStatus;
  paintMarkers();

  try {
    await auth.authFetch(`/api/hunts/${huntId}/bars/${bar.id}`, {
      method: "PATCH",
      body: { checkStatus: newStatus },
    });
  } catch (e: any) {
    // Revert
    bar.checkStatus = oldStatus;
    paintMarkers();
    error.value = e?.data?.message || e?.message || "Failed to update status";
  }
}

async function addHint() {
  const text = newHint.value.trim();
  if (!text) return;

  newHint.value = "";
  showHintInput.value = false;

  try {
    const res = await auth.authFetch<any>(`/api/hunts/${huntId}/hints`, {
      method: "POST",
      body: { text },
    });
    // Add to top of list
    hints.value.unshift({
      id: res.hint.id,
      text: res.hint.text,
      authorId: res.hint.author_id,
      authorName: auth.state.user?.displayName || "You",
      createdAt: res.hint.created_at,
    });
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to add hint";
  }
}

async function refreshHunt() {
  syncing.value = true;
  try {
    await loadHunt();
  } finally {
    syncing.value = false;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ── Polling (30s refresh) ─────────────────────────────────
const POLL_INTERVAL = 30_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  if (searching.value || syncing.value || !bars.value.length) return;
  try {
    const res = await auth.authFetch<any>(`/api/hunts/${huntId}`);
    // Update bars statuses
    const barMap = new Map(res.bars.map((b: any) => [b.id, b]));
    let changed = false;
    for (const b of bars.value) {
      const fresh = barMap.get(b.id) as HuntBar | undefined;
      if (fresh && fresh.checkStatus !== b.checkStatus) {
        b.checkStatus = fresh.checkStatus;
        b.checkedBy = fresh.checkedBy;
        b.checkedAt = fresh.checkedAt;
        changed = true;
      }
    }
    if (changed) paintMarkers();

    // Update hints
    if (res.hints.length !== hints.value.length) {
      hints.value = res.hints;
    }

    // Update participants
    participants.value = res.participants;
  } catch {
    // Silent
  }
}

// ── Lifecycle ─────────────────────────────────────────────
onMounted(async () => {
  auth.restore();

  if (!auth.state.user) {
    router.push("/");
    return;
  }

  // Show welcome modal on first visit
  const hasSeenWelcome = localStorage.getItem("chickenRunWelcomeSeen");
  if (!hasSeenWelcome) {
    showWelcomeModal.value = true;
    localStorage.setItem("chickenRunWelcomeSeen", "true");
  }

  await loadHunt();
  pollTimer = setInterval(poll, POLL_INTERVAL);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style>

.wrap { max-width: 1280px; margin: 0 auto; padding: 16px; }

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

/* Header */
.top { margin-bottom: 16px; }

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.title-group { display: flex; flex-direction: column; gap: 4px; }

.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 4px;
}

.back-btn:hover { text-decoration: underline; }

.title-row h1 { margin: 0; font-size: 24px; color: var(--accent-dark); }
.tagline { font-size: 14px; color: var(--text-muted); font-style: italic; }

.header-right { display: flex; align-items: flex-start; gap: 10px; }

.code-chip {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 10px;
  padding: 6px 12px;
  text-align: center;
}

.code-chip-label {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-chip-value {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--accent-dark);
}

.info-btn {
  width: 36px; height: 36px;
  border: 2px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  cursor: pointer;
  font-size: 18px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.info-btn:hover { border-color: var(--accent); transform: scale(1.05); }

.controls {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
}

.label-text {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-muted);
}

.btn-search {
  padding: 9px 16px; border: 0; border-radius: 12px;
  cursor: pointer; background: var(--accent); color: white;
  font-weight: 600; font-size: 14px; transition: background 0.15s;
}
.btn-search:hover { background: var(--accent-dark); }
.btn-search:disabled { opacity: 0.6; cursor: not-allowed; }

.meta { font-size: 14px; color: var(--text-muted); }
.participants { font-weight: 600; }

/* Map */
.map-section { margin-bottom: 16px; }
.map-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }

.map-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 2px solid var(--border); border-radius: 12px;
  cursor: pointer; background: var(--surface); font-size: 14px; font-weight: 600;
  transition: all 0.15s;
}
.map-toggle:hover { border-color: var(--accent); color: var(--accent); }

.map-collapsible { max-width: 800px; }

.mapEl {
  height: 420px; width: 100%; border-radius: 16px; overflow: hidden;
  border: 2px solid var(--border);
}

@media (max-width: 900px) { .mapEl { height: 300px; } }

.chicken-icon, .bar-icon { background: none !important; border: none !important; }

.map-legend {
  display: flex; gap: 16px; margin-top: 8px; padding: 8px 12px;
  background: var(--surface); border-radius: 10px;
  border: 1px solid var(--border); font-size: 12px;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot-unchecked { background: var(--red); }
.dot-checked { background: var(--green); }
.dot-skip { background: var(--gray); }

/* Hints */
.hints-box {
  background: #fff8e1; border: 2px dashed var(--chicken-yellow);
  border-radius: 14px; padding: 12px; margin-bottom: 12px;
}
.hints-header {
  display: flex; justify-content: space-between;
  align-items: center; font-weight: 600; font-size: 14px;
}
.hints-list { margin: 8px 0 0; padding-left: 20px; font-size: 14px; }
.hints-list li {
  margin-bottom: 4px; display: flex; justify-content: space-between;
  align-items: baseline; gap: 8px;
}
.hint-time { font-size: 11px; color: var(--text-muted); opacity: 0.7; white-space: nowrap; }
.no-hints { margin: 8px 0 0; font-size: 13px; color: var(--text-muted); font-style: italic; }

.hint-input-row { display: flex; gap: 8px; margin-bottom: 12px; }
.hint-input-row input {
  flex: 1; padding: 8px 10px; border: 2px solid var(--border);
  border-radius: 10px; font-size: 14px;
}
.hint-input-row input:focus { outline: none; border-color: var(--chicken-yellow); }

/* Toolbar */
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.toolbar input {
  flex: 1; padding: 8px 10px; border: 2px solid var(--border);
  border-radius: 10px; font-size: 14px; background: var(--surface);
}
.toolbar input:focus { outline: none; border-color: var(--accent); }
.toolbar select {
  padding: 8px 10px; border: 2px solid var(--border);
  border-radius: 10px; background: var(--surface); font-size: 13px;
}

.btn-sm {
  padding: 6px 12px; border: 2px solid var(--border); border-radius: 10px;
  cursor: pointer; background: var(--surface); font-size: 12px;
  font-weight: 600; transition: all 0.15s;
}
.btn-sm:hover { border-color: var(--accent); color: var(--accent); }

.btn-primary {
  padding: 10px 24px; border: 0; border-radius: 12px;
  cursor: pointer; background: var(--accent); color: white;
  font-weight: 600; font-size: 14px; transition: background 0.15s;
}
.btn-primary:hover { background: var(--accent-dark); }

/* Stats */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.stat {
  background: var(--surface); border: 2px solid var(--border);
  border-radius: 12px; padding: 10px; text-align: center;
}
.stat-num { display: block; font-size: 20px; font-weight: 700; }
.stat-label {
  display: block; font-size: 11px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;
}
.stat-good { border-color: var(--green); }
.stat-skip { border-color: var(--gray); }
.stat-drinks { border-color: var(--accent); }

/* Bar list */
.items { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }

.item {
  display: grid; grid-template-columns: 1fr auto; gap: 10px;
  border: 2px solid var(--border); border-radius: 14px;
  padding: 12px; background: var(--surface); transition: all 0.15s;
}
.item-checked { border-color: var(--green); background: #f0faf4; opacity: 0.75; }
.item-skip { border-color: var(--gray); background: #f5f5f5; opacity: 0.5; }

.bar-name { font-size: 15px; line-height: 1.3; }
.bar-addr { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.bar-meta { margin-top: 4px; font-size: 12px; color: var(--text-muted); }
.ratings-count { opacity: 0.7; }

.right { display: flex; flex-direction: column; align-items: end; gap: 8px; }
.status-btns { display: flex; gap: 4px; }

.sbtn {
  width: 34px; height: 34px; border: 2px solid var(--border);
  border-radius: 10px; cursor: pointer; background: var(--surface);
  font-size: 16px; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; opacity: 0.5;
}
.sbtn:hover { opacity: 1; transform: scale(1.1); }
.sbtn.active { opacity: 1; transform: scale(1.05); }
.sbtn-checked.active { border-color: var(--green); background: #f0faf4; }
.sbtn-skip.active { border-color: var(--gray); background: #f0f0f0; }

.maps-link {
  font-size: 12px; text-decoration: none; color: var(--accent); font-weight: 600;
}
.maps-link:hover { text-decoration: underline; }

/* Error / Empty */
.error {
  padding: 12px; border: 2px solid var(--red); background: #fef0ef;
  border-radius: 12px; font-size: 14px;
}
.empty {
  padding: 32px 20px; border: 2px dashed var(--border);
  border-radius: 16px; text-align: center; color: var(--text-muted);
}
.empty p { margin: 4px 0; }
.empty p:first-child { font-size: 18px; }

/* Footer */
.footer {
  text-align: center; padding: 20px 0; font-size: 13px;
  color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 24px;
}
.footer p { margin: 0; }

/* Modals */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; backdrop-filter: blur(4px);
}
.modal {
  background: var(--surface); border-radius: 20px; padding: 28px;
  width: 340px; max-width: 90vw;
  box-shadow: 0 16px 48px rgba(0,0,0,0.2); text-align: center;
}
.modal-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
.modal-actions { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }

.welcome-modal { max-width: 520px; text-align: left; }
.welcome-content { margin: 16px 0; }
.welcome-content > p { margin: 0 0 16px; font-size: 14px; line-height: 1.5; }

.rule-box {
  display: flex; gap: 12px; padding: 12px; background: var(--bg);
  border-radius: 12px; margin-bottom: 10px; border: 2px solid var(--border);
}
.rule-box.chicken-found { background: #fff8e1; border-color: var(--chicken-yellow); }
.rule-icon { font-size: 24px; flex-shrink: 0; }
.rule-box strong { color: var(--accent-dark); }
.rule-box div { font-size: 13px; line-height: 1.4; }

.warning-text {
  font-size: 13px; color: var(--text-muted); font-style: italic;
  margin-top: 12px !important; padding: 10px; background: #fef0ef;
  border-radius: 8px; border: 1px solid var(--red);
}
</style>
