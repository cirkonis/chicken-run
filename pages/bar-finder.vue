<template>
  <div class="max-w-7xl mx-auto p-4">
    <!-- Header -->
    <header class="mb-4">
      <NuxtLink to="/" class="text-[13px] text-accent no-underline font-semibold hover:underline">← Back</NuxtLink>
      <h1 class="mt-1 mb-0 text-2xl text-accent-dark">🍺 Bar Finder</h1>
      <p class="text-text-muted text-sm mt-1">Just looking for a place to drink? Click the map or enter coordinates.</p>
    </header>

    <!-- Search form -->
    <section class="bg-surface border-2 border-border rounded-[18px] p-5 mb-4">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-3 gap-2">
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lat</span>
            <input v-model="inputLat" inputmode="decimal" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lng</span>
            <input v-model="inputLng" inputmode="decimal" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Radius (m)</span>
            <input v-model="inputRadius" inputmode="numeric" class="px-3.5 py-2.5 border-2 border-border rounded-xl text-sm bg-bg w-full focus:outline-none focus:border-accent" />
          </label>
        </div>

        <div v-if="geoError" class="px-3 py-2 bg-[#fef0ef] border-2 border-red rounded-[10px] text-[13px] text-red text-center">
          {{ geoError }}
        </div>

        <div class="flex gap-2">
          <button
            class="flex-1 px-5 py-3 border-2 border-accent rounded-xl cursor-pointer bg-transparent text-accent font-semibold text-sm transition-all hover:bg-accent hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="geolocating"
            @click="useMyLocation"
          >
            {{ geolocating ? "Locating..." : "📍 Use my location" }}
          </button>
          <button
            class="flex-[2] px-6 py-3 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-[15px] transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="searching || !inputLat || !inputLng"
            @click="doSearch"
          >
            {{ searching ? "Searching..." : "🔍 Find Bars" }}
          </button>
        </div>
      </div>
    </section>

    <!-- Map (always visible) -->
    <section class="mb-4">
      <div class="flex gap-2 mb-2.5 items-center">
        <button
          class="flex items-center gap-1.5 px-4 py-2 border-2 border-border rounded-xl cursor-pointer bg-surface text-sm font-semibold transition-all hover:border-accent hover:text-accent"
          @click="mapOpen = !mapOpen"
        >
          {{ mapOpen ? "Hide map" : "Show map" }}
        </button>
        <span class="text-xs text-text-muted italic">Click the map to set your location</span>
      </div>
      <div v-show="mapOpen" class="max-w-[800px]">
        <div ref="mapEl" class="h-[420px] w-full rounded-2xl overflow-hidden border-2 border-border max-[900px]:h-[300px]"></div>
        <div v-if="hasSearched" class="flex gap-4 mt-2 px-3 py-2 bg-surface rounded-[10px] border border-border text-xs">
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red"></span> Unchecked</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-green"></span> Maybe</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-gray"></span> No thanks</span>
        </div>
      </div>
    </section>

    <!-- Results (only shown after first search) -->
    <template v-if="hasSearched">
      <section>
        <!-- Toolbar -->
        <div class="flex gap-2 items-center mb-2.5" v-if="bars.length">
          <input v-model="filter" placeholder="Search bars..." class="flex-1 px-2.5 py-2 border-2 border-border rounded-[10px] text-sm bg-surface focus:outline-none focus:border-accent" />
          <select v-model="statusFilter" class="px-2.5 py-2 border-2 border-border rounded-[10px] bg-surface text-[13px]">
            <option value="all">All</option>
            <option value="unchecked">Unchecked</option>
            <option value="checked">Maybe</option>
            <option value="not_checking">No thanks</option>
          </select>
        </div>

        <!-- Stats -->
        <StatsGrid
          :counts="statusCounts"
          :labels="{ unchecked: 'Unchecked', checked: 'Maybe', not_checking: 'No thanks' }"
        />

        <div v-if="error" class="p-3 border-2 border-red bg-[#fef0ef] rounded-xl text-sm mb-3">{{ error }}</div>

        <!-- Empty state after search -->
        <div v-if="!bars.length && !error" class="py-8 px-5 border-2 border-dashed border-border rounded-2xl text-center text-text-muted">
          <p class="my-1 text-lg">🍺 No bars found in this area.</p>
          <p class="my-1">Try a larger radius or a different location.</p>
        </div>

        <!-- Bar list -->
        <ul v-else-if="bars.length" class="list-none p-0 m-0 grid gap-2">
          <BarListItem
            v-for="b in filteredBars"
            :key="b.id"
            :bar="b"
            :labels="{ checked: 'Maybe!', not_checking: 'No thanks' }"
            @toggle="toggleStatus"
          />
        </ul>
      </section>
    </template>

    <footer class="text-center py-5 text-[13px] text-text-muted border-t border-border mt-6">
      <p class="m-0">🍺 No chickens here — just good bars.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
// ── Composables ──────────────────────────────────────────
const {
  searching, error, bars, center, searchRadius,
  filter, statusFilter, statusCounts, filteredBars,
  searchBars, toggleStatus, setOnMarkersChanged,
} = useBarFinder();

const { initPicker, placePin, updateRadius, invalidatePickerSize, getMap, cleanupPicker, setOnLocationPicked } = useLocationPicker();

// We use useMap only for painting bar markers onto the picker map
const { $L } = useNuxtApp();
let markersLayer: L.LayerGroup | null = null;

function paintBarMarkers() {
  const map = getMap();
  if (!map || !$L) return;

  if (!markersLayer) {
    markersLayer = $L.layerGroup().addTo(map);
  }
  markersLayer.clearLayers();

  for (const b of filteredBars.value) {
    const symbol =
      b.checkStatus === "checked" ? "&#10003;"
        : b.checkStatus === "not_checking" ? "&#10005;"
          : "?";
    const color =
      b.checkStatus === "checked" ? "#27ae60"
        : b.checkStatus === "not_checking" ? "#95a5a6"
          : "#e74c3c";

    const icon = $L.divIcon({
      html: `<div style="font-size:14px;text-align:center;background:${color};color:white;border-radius:50%;width:28px;height:28px;line-height:28px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);">${symbol}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: "bar-icon",
    });

    const m = $L.marker([b.lat, b.lng], { icon }).addTo(markersLayer);
    m.bindPopup(`<b>${b.name}</b><br/>${b.address}<br/><a href="${b.mapsUrl}" target="_blank" rel="noreferrer">Open in Maps</a>`);
  }
}

// Wire composable callbacks
setOnMarkersChanged(() => paintBarMarkers());

// ── Map ──────────────────────────────────────────────────
const mapEl = ref<HTMLDivElement | null>(null);
const mapOpen = ref(true);

watch(mapOpen, (open) => {
  if (open) nextTick(() => invalidatePickerSize());
});

// Repaint markers when filters change
watch(filteredBars, () => paintBarMarkers());

// ── Search form ──────────────────────────────────────────
const DEFAULT_LAT = "55.678831";
const DEFAULT_LNG = "12.579570";

const inputLat = ref(DEFAULT_LAT);
const inputLng = ref(DEFAULT_LNG);
const inputRadius = ref("1500");
const geolocating = ref(false);
const geoError = ref("");
const hasSearched = ref(false);

// When map is clicked, update the form inputs
setOnLocationPicked((lat, lng) => {
  inputLat.value = lat.toFixed(6);
  inputLng.value = lng.toFixed(6);
  updateRadius(parseInt(inputRadius.value) || 1500);
});

// When radius input changes, update the circle preview
watch(inputRadius, (val) => {
  const r = parseInt(val) || 1500;
  updateRadius(r);
});

function useMyLocation() {
  if (!navigator.geolocation) {
    geoError.value = "Geolocation is not supported by your browser";
    return;
  }
  geolocating.value = true;
  geoError.value = "";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      inputLat.value = pos.coords.latitude.toFixed(6);
      inputLng.value = pos.coords.longitude.toFixed(6);
      geolocating.value = false;
      // Move the pin + recenter map
      placePin(pos.coords.latitude, pos.coords.longitude);
      updateRadius(parseInt(inputRadius.value) || 1500);
      getMap()?.setView([pos.coords.latitude, pos.coords.longitude], 14);
    },
    () => {
      geoError.value = "Could not get your location. Click the map instead!";
      geolocating.value = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function doSearch() {
  const lat = parseFloat(inputLat.value);
  const lng = parseFloat(inputLng.value);
  const rad = parseInt(inputRadius.value) || 1500;

  if (isNaN(lat) || isNaN(lng)) {
    geoError.value = "Please set a location on the map first";
    return;
  }

  geoError.value = "";
  hasSearched.value = true;
  await searchBars(lat, lng, rad);

  // Re-center map and update radius overlay
  placePin(lat, lng);
  updateRadius(rad);
  getMap()?.setView([lat, lng], 14);
}

// ── Lifecycle ────────────────────────────────────────────
onMounted(() => {
  nextTick(() => {
    if (mapEl.value) {
      const lat = parseFloat(inputLat.value) || 55.678831;
      const lng = parseFloat(inputLng.value) || 12.579570;
      initPicker(mapEl.value, { lat, lng }, parseInt(inputRadius.value) || 1500);
    }
  });
});

onUnmounted(() => {
  cleanupPicker();
});
</script>
