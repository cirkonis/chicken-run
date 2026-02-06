<template>
  <div class="wrap">
    <header class="top">
      <div class="title-row">
        <h1>🐔 Chicken Run</h1>
        <span class="tagline">Find the chickens. Try not to get wrecked.</span>
      </div>

      <div class="controls">
        <label>
          <span class="label-text">Lat</span>
          <input v-model="latStr" inputmode="decimal" />
        </label>

        <label>
          <span class="label-text">Lng</span>
          <input v-model="lngStr" inputmode="decimal" />
        </label>

        <label>
          <span class="label-text">Radius (m)</span>
          <input v-model="radiusStr" inputmode="numeric" />
        </label>

        <button class="btn-search" :disabled="loading" @click="handleHuntBars">
          {{ loading ? "Searching the coop..." : "🔍 Hunt bars" }}
        </button>

        <span class="meta" v-if="resultMeta">
          🍺 <b>{{ resultMeta.count }}</b> bars in the zone
        </span>
      </div>
    </header>

    <main>
      <section class="map-section">
        <button class="map-toggle" @click="mapOpen = !mapOpen">
          {{ mapOpen ? "🗺️ Hide map" : "🗺️ Show map" }}
        </button>
        <div v-show="mapOpen" class="map-collapsible">
          <ClientOnly>
            <div ref="mapEl" class="mapEl"></div>
          </ClientOnly>
          <div class="map-legend">
            <span class="legend-item"><span class="dot dot-unchecked"></span> Not visited</span>
            <span class="legend-item"><span class="dot dot-checked"></span> Visited</span>
            <span class="legend-item"><span class="dot dot-skip"></span> Skipping</span>
          </div>
        </div>
      </section>

      <section class="list">
        <div class="hints-box" v-if="hints.length">
          <div class="hints-header">
            <span>🐓 Chicken hints</span>
            <button class="btn-sm" @click="showHintInput = !showHintInput">+ Add hint</button>
          </div>
          <ul class="hints-list">
            <li v-for="(h, i) in hints" :key="i">{{ h }}</li>
          </ul>
        </div>
        <div class="hints-box" v-else-if="bars.length">
          <div class="hints-header">
            <span>🐓 Chicken hints</span>
            <button class="btn-sm" @click="showHintInput = !showHintInput">+ Add hint</button>
          </div>
          <p class="no-hints">No hints yet. The chickens are silent...</p>
        </div>

        <div v-if="showHintInput" class="hint-input-row">
          <input
            v-model="newHint"
            placeholder="What did the chickens say?"
            @keyup.enter="addHint"
          />
          <button class="btn-sm" @click="addHint">Add</button>
        </div>

        <div class="toolbar" v-if="bars.length">
          <input v-model="filter" placeholder="Filter bars..." />
          <select v-model="statusFilter">
            <option value="all">All</option>
            <option value="unchecked">Unchecked</option>
            <option value="checked">Visited</option>
            <option value="not_checking">Skipping</option>
          </select>
          <button class="btn-sm btn-danger" @click="openResetModal">Reset all</button>
        </div>

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
            <span class="stat-num">🍺 {{ statusCounts.checked }}</span>
            <span class="stat-label">Drinks deep</span>
          </div>
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <div v-if="!bars.length && !loading" class="empty">
          <p>🐔 The chickens are hiding somewhere...</p>
          <p>Set coordinates and radius, then hit "Hunt bars" to reveal the battlefield.</p>
        </div>

        <ul v-else class="items">
          <li
            v-for="b in filteredBars"
            :key="b.placeId"
            class="item"
            :class="{
              'item-checked': statuses[b.placeId] === STATE.CHECKED,
              'item-skip': statuses[b.placeId] === STATE.NOT_CHECKING,
            }"
          >
            <div class="left">
              <div class="bar-name">
                <b>{{ b.name }}</b>
              </div>
              <div class="bar-addr" v-if="b.address">{{ b.address }}</div>
              <div class="bar-meta">
                <span v-if="b.rating != null"
                  >{{ "⭐".repeat(Math.min(5, Math.round(b.rating))) }}
                  {{ b.rating }}
                  <span v-if="b.ratingsTotal" class="ratings-count"
                    >({{ b.ratingsTotal }})</span
                  >
                </span>
                <span v-if="b.priceLevel != null">
                  · {{ "💸".repeat(Math.max(1, Math.min(4, b.priceLevel + 1))) }}
                </span>
              </div>
            </div>

            <div class="right">
              <div class="status-btns">
                <button
                  class="sbtn sbtn-checked"
                  :class="{
                    active: statuses[b.placeId] === STATE.CHECKED,
                    disabled: statuses[b.placeId] === STATE.NOT_CHECKING,
                  }"
                  @click="toggleStatus(b.placeId, STATE.CHECKED)"
                  title="Visited — no chickens here"
                >
                  ✅
                </button>
                <button
                  class="sbtn sbtn-skip"
                  :class="{
                    active: statuses[b.placeId] === STATE.NOT_CHECKING,
                    disabled: statuses[b.placeId] === STATE.CHECKED,
                  }"
                  @click="toggleStatus(b.placeId, STATE.NOT_CHECKING)"
                  title="Skip this one"
                >
                  ⛔
                </button>
              </div>

              <a class="maps-link" :href="b.mapsUrl" target="_blank" rel="noreferrer">
                Open in Maps ↗
              </a>
            </div>
          </li>
        </ul>
      </section>
    </main>

    <footer class="footer">
      <p>🐔 Don't be a chicken — check every bar. Or at least the ones that look fun.</p>
    </footer>

    <!-- Reset password modal -->
    <Teleport to="body">
      <div v-if="showResetModal" class="modal-overlay" @click.self="closeResetModal">
        <div class="modal">
          <div class="modal-title">🔒 Are you allowed to do this?</div>
          <input
            ref="resetPasswordInput"
            v-model="resetPassword"
            type="password"
            placeholder="Prove it..."
            class="modal-input"
            @keyup.enter="attemptReset"
          />
          <div v-if="resetError" class="modal-error">{{ resetError }}</div>
          <div class="modal-actions">
            <button class="btn-sm" @click="closeResetModal">Nevermind</button>
            <button class="btn-sm btn-danger" @click="attemptReset">Reset</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from "vue";

type Bar = {
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
};

const STATE = {
  UNCHECKED: "unchecked",
  CHECKED: "checked",
  NOT_CHECKING: "not_checking",
} as const;

type State = (typeof STATE)[keyof typeof STATE];

// Starting point for the game
const latStr = ref("55.678831");
const lngStr = ref("12.579570");
const radiusStr = ref("1500");

const loading = ref(false);
const error = ref<string | null>(null);
const mapOpen = ref(true);

// Leaflet needs a size invalidation when its container becomes visible again
watch(mapOpen, (open) => {
  if (open && map) {
    nextTick(() => {
      map.invalidateSize();
    });
  }
});

const bars = ref<Bar[]>([]);
const resultMeta = ref<{ count: number; radius: number } | null>(null);

const filter = ref("");
const statusFilter = ref("all");

// --- hints ---
const hints = ref<string[]>([]);
const showHintInput = ref(false);
const newHint = ref("");

const HINTS_KEY = "chicken-run-hints-v1";

function loadHints() {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    if (raw) hints.value = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}

function saveHints() {
  try {
    localStorage.setItem(HINTS_KEY, JSON.stringify(hints.value));
  } catch {
    /* ignore */
  }
}

function addHint() {
  const text = newHint.value.trim();
  if (!text) return;
  hints.value.push(text);
  newHint.value = "";
  showHintInput.value = false;
  saveHints();
}

// --- status persistence (localStorage) ---
const LS_KEY = "chicken-run-statuses-v1";
const statuses = ref<Record<string, State>>({});

function loadStatuses() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") statuses.value = obj;
  } catch {
    /* ignore */
  }
}

function saveStatuses() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(statuses.value));
  } catch {
    /* ignore */
  }
}

// --- password modal ---
const showResetModal = ref(false);
const resetPassword = ref("");
const resetError = ref("");
const resetPasswordInput = ref<HTMLInputElement | null>(null);
// Track what the modal should do on success
let pendingAction: (() => void) | null = null;

function openPasswordModal(onSuccess: () => void) {
  resetPassword.value = "";
  resetError.value = "";
  pendingAction = onSuccess;
  showResetModal.value = true;
  nextTick(() => resetPasswordInput.value?.focus());
}

function openResetModal() {
  openPasswordModal(() => {
    statuses.value = {};
    hints.value = [];
    saveStatuses();
    saveHints();
    for (const b of bars.value) {
      statuses.value[b.placeId] = STATE.UNCHECKED;
    }
  });
}

function handleHuntBars() {
  openPasswordModal(() => {
    loadBars();
  });
}

function closeResetModal() {
  showResetModal.value = false;
  resetPassword.value = "";
  resetError.value = "";
  pendingAction = null;
}

function attemptReset() {
  if (resetPassword.value.toLowerCase() === "yesimmike") {
    pendingAction?.();
    closeResetModal();
  } else {
    resetError.value = "🐔 GET OUT OF HERE";
    resetPassword.value = "";
  }
}

function toggleStatus(placeId: string, target: State) {
  // If already set to this state, toggle back to unchecked
  // Otherwise set to the target state
  statuses.value[placeId] =
    statuses.value[placeId] === target ? STATE.UNCHECKED : target;
}

watch(
  statuses,
  () => {
    saveStatuses();
    paintMarkers(bars.value);
  },
  { deep: true }
);

// --- stats ---
const statusCounts = computed(() => {
  let unchecked = 0;
  let checked = 0;
  let not_checking = 0;
  for (const b of bars.value) {
    const s = statuses.value[b.placeId] || STATE.UNCHECKED;
    if (s === STATE.CHECKED) checked++;
    else if (s === STATE.NOT_CHECKING) not_checking++;
    else unchecked++;
  }
  return { unchecked, checked, not_checking };
});

// --- Leaflet map ---
const mapEl = ref<HTMLDivElement | null>(null);

let L: any;
let map: any;
let centerMarker: any;
let circle: any;
let markersLayer: any;

async function ensureLeaflet() {
  if (L) return;
  const leaflet = await import("leaflet");
  L = leaflet;
}

function parseInputs() {
  const lat = Number(latStr.value);
  const lng = Number(lngStr.value);
  const radius = Number(radiusStr.value);

  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    throw new Error("Lat/Lng must be valid numbers.");
  if (!Number.isFinite(radius) || radius <= 0)
    throw new Error("Radius must be a positive number.");
  return { lat, lng, radius };
}

async function initMapIfNeeded(
  center: { lat: number; lng: number },
  radius: number
) {
  await ensureLeaflet();
  if (!mapEl.value) return;

  if (!map) {
    map = L.map(mapEl.value).setView([center.lat, center.lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
  } else {
    map.setView([center.lat, center.lng], 15);
    markersLayer.clearLayers();
  }

  if (centerMarker) centerMarker.remove();
  if (circle) circle.remove();

  // Center marker with chicken icon
  const chickenIcon = L.divIcon({
    html: '<div style="font-size:28px;text-align:center;">🐔</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "chicken-icon",
  });

  centerMarker = L.marker([center.lat, center.lng], { icon: chickenIcon })
    .addTo(map)
    .bindPopup("🐔 Starting point — The chickens fled from here!");

  circle = L.circle([center.lat, center.lng], {
    radius,
    color: "#e67e22",
    fillColor: "#f39c12",
    fillOpacity: 0.1,
    weight: 2,
    dashArray: "8 4",
  }).addTo(map);

  map.fitBounds(circle.getBounds(), { padding: [20, 20] });
}

function getMarkerColor(placeId: string): string {
  const s = statuses.value[placeId] || STATE.UNCHECKED;
  if (s === STATE.CHECKED) return "#27ae60";
  if (s === STATE.NOT_CHECKING) return "#95a5a6";
  return "#e74c3c";
}

function getMarkerEmoji(placeId: string): string {
  const s = statuses.value[placeId] || STATE.UNCHECKED;
  if (s === STATE.CHECKED) return "✅";
  if (s === STATE.NOT_CHECKING) return "⛔";
  return "🍺";
}

function paintMarkers(list: Bar[]) {
  if (!markersLayer || !L) return;
  markersLayer.clearLayers();

  for (const b of list) {
    const emoji = getMarkerEmoji(b.placeId);
    const color = getMarkerColor(b.placeId);
    const icon = L.divIcon({
      html: `<div style="font-size:18px;text-align:center;background:${color};border-radius:50%;width:28px;height:28px;line-height:28px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);">${emoji}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: "bar-icon",
    });

    const m = L.marker([b.lat, b.lng], { icon }).addTo(markersLayer);
    m.bindPopup(
      `<b>${escapeHtml(b.name)}</b><br/>${escapeHtml(b.address || "")}<br/>
       <a href="${b.mapsUrl}" target="_blank" rel="noreferrer">Open in Maps</a>`
    );
  }
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string
  );
}

// --- fetch bars ---
async function loadBars() {
  error.value = null;
  loading.value = true;

  try {
    const { lat, lng, radius } = parseInputs();
    await initMapIfNeeded({ lat, lng }, radius);

    const res = await $fetch<{
      center: { lat: number; lng: number };
      radius: number;
      count: number;
      bars: Bar[];
    }>("/api/bars", { query: { lat, lng, radius } });

    bars.value = res.bars;
    resultMeta.value = { count: res.count, radius: res.radius };

    for (const b of res.bars) {
      if (!statuses.value[b.placeId])
        statuses.value[b.placeId] = STATE.UNCHECKED;
    }

    paintMarkers(res.bars);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Something went wrong.";
  } finally {
    loading.value = false;
  }
}

const filteredBars = computed(() => {
  let result = bars.value;

  const f = filter.value.trim().toLowerCase();
  if (f) {
    result = result.filter((b) =>
      `${b.name} ${b.address}`.toLowerCase().includes(f)
    );
  }

  if (statusFilter.value !== "all") {
    result = result.filter((b) => {
      const s = statuses.value[b.placeId] || STATE.UNCHECKED;
      return s === statusFilter.value;
    });
  }

  return result;
});

onMounted(() => {
  loadStatuses();
  loadHints();
});
</script>

<style>
@import "leaflet/dist/leaflet.css";

:root {
  --bg: #fef9ef;
  --surface: #ffffff;
  --border: #f0e6d3;
  --text: #3d2c1e;
  --text-muted: #8b7355;
  --accent: #e67e22;
  --accent-dark: #d35400;
  --green: #27ae60;
  --red: #e74c3c;
  --gray: #95a5a6;
  --chicken-yellow: #f9ca24;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    Arial;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

.wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px;
}

/* Header */
.top {
  margin-bottom: 16px;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.title-row h1 {
  margin: 0;
  font-size: 24px;
  color: var(--accent-dark);
}

.tagline {
  font-size: 14px;
  color: var(--text-muted);
  font-style: italic;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
}

.controls label {
  display: grid;
  gap: 4px;
}

.label-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.controls input {
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 10px;
  width: 130px;
  background: var(--surface);
  font-size: 14px;
}

.controls input:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-search {
  padding: 9px 16px;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 14px;
  transition: background 0.15s;
}

.btn-search:hover {
  background: var(--accent-dark);
}

.btn-search:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.meta {
  font-size: 14px;
  color: var(--text-muted);
}

/* Map */
.map-section {
  margin-bottom: 16px;
}

.map-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  background: var(--surface);
  font-size: 14px;
  font-weight: 600;
  transition: all 0.15s;
  margin-bottom: 10px;
}

.map-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.map-collapsible {
  max-width: 800px;
}

.mapEl {
  height: 420px;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid var(--border);
}

@media (max-width: 900px) {
  .mapEl {
    height: 300px;
  }
}

.chicken-icon {
  background: none !important;
  border: none !important;
}

.bar-icon {
  background: none !important;
  border: none !important;
}

.map-legend {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border);
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-unchecked {
  background: var(--red);
}

.dot-checked {
  background: var(--green);
}

.dot-skip {
  background: var(--gray);
}

/* Hints */
.hints-box {
  background: #fff8e1;
  border: 2px dashed var(--chicken-yellow);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 12px;
}

.hints-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
}

.hints-list {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 14px;
}

.hints-list li {
  margin-bottom: 4px;
}

.no-hints {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

.hint-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.hint-input-row input {
  flex: 1;
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 10px;
  font-size: 14px;
}

.hint-input-row input:focus {
  outline: none;
  border-color: var(--chicken-yellow);
}

/* Toolbar */
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.toolbar input {
  flex: 1;
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 10px;
  font-size: 14px;
  background: var(--surface);
}

.toolbar input:focus {
  outline: none;
  border-color: var(--accent);
}

.toolbar select {
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  font-size: 13px;
}

.btn-sm {
  padding: 6px 12px;
  border: 2px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  background: var(--surface);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}

.btn-sm:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-danger {
  color: var(--red);
  border-color: var(--red);
}

.btn-danger:hover {
  background: var(--red);
  color: white;
}

/* Stats */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.stat {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 20px;
  font-weight: 700;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.stat-good {
  border-color: var(--green);
}

.stat-skip {
  border-color: var(--gray);
}

.stat-drinks {
  border-color: var(--accent);
}

/* Bar list */
.items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  border: 2px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  background: var(--surface);
  transition: all 0.15s;
}

.item-checked {
  border-color: var(--green);
  background: #f0faf4;
  opacity: 0.75;
}

.item-skip {
  border-color: var(--gray);
  background: #f5f5f5;
  opacity: 0.5;
}

.bar-name {
  font-size: 15px;
  line-height: 1.3;
}

.bar-addr {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}

.bar-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.ratings-count {
  opacity: 0.7;
}

.right {
  display: flex;
  flex-direction: column;
  align-items: end;
  gap: 8px;
}

.status-btns {
  display: flex;
  gap: 4px;
}

.sbtn {
  width: 34px;
  height: 34px;
  border: 2px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  background: var(--surface);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  opacity: 0.5;
}

.sbtn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.sbtn.active {
  opacity: 1;
  transform: scale(1.05);
}

.sbtn.disabled {
  opacity: 0.25;
  cursor: default;
  pointer-events: none;
}

.sbtn-checked.active {
  border-color: var(--green);
  background: #f0faf4;
}

.sbtn-skip.active {
  border-color: var(--gray);
  background: #f0f0f0;
}

.maps-link {
  font-size: 12px;
  text-decoration: none;
  color: var(--accent);
  font-weight: 600;
}

.maps-link:hover {
  text-decoration: underline;
}

/* Error/Empty */
.error {
  padding: 12px;
  border: 2px solid var(--red);
  background: #fef0ef;
  border-radius: 12px;
  font-size: 14px;
}

.empty {
  padding: 32px 20px;
  border: 2px dashed var(--border);
  border-radius: 16px;
  text-align: center;
  color: var(--text-muted);
}

.empty p {
  margin: 4px 0;
}

.empty p:first-child {
  font-size: 18px;
}

/* Footer */
.footer {
  text-align: center;
  padding: 20px 0;
  font-size: 13px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  margin-top: 24px;
}

.footer p {
  margin: 0;
}

/* Reset modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--surface);
  border-radius: 20px;
  padding: 28px;
  width: 340px;
  max-width: 90vw;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}

.modal-input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid var(--border);
  border-radius: 12px;
  font-size: 15px;
  text-align: center;
  background: var(--bg);
}

.modal-input:focus {
  outline: none;
  border-color: var(--accent);
}

.modal-error {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fef0ef;
  border: 2px solid var(--red);
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  color: var(--red);
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 16px;
}
</style>
