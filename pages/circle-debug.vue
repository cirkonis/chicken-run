<template>
  <div class="max-w-7xl mx-auto p-4">
    <header class="mb-4">
      <NuxtLink to="/" class="text-[13px] text-accent no-underline font-semibold hover:underline">← Back</NuxtLink>
      <h1 class="mt-1 mb-0 text-2xl text-accent-dark">🔬 Circle Debug</h1>
      <p class="text-text-muted text-sm mt-1">Visualise the multi-circle search geometry. Temporary test page.</p>
    </header>

    <!-- Controls -->
    <section class="bg-surface border-2 border-border rounded-[18px] p-5 mb-4">
      <div class="flex flex-col gap-3">
        <button
          class="px-5 py-3 border-2 border-accent rounded-xl cursor-pointer bg-transparent text-accent font-semibold text-sm transition-all hover:bg-accent hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="geolocating"
          @click="useMyLocation"
        >
          {{ geolocating ? "Locating..." : "📍 Use my location" }}
        </button>

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

        <button
          class="px-6 py-3 border-0 rounded-xl cursor-pointer bg-accent text-white font-bold text-[15px] transition-colors hover:bg-accent-dark"
          @click="drawCircles"
        >
          🔍 Draw Circles
        </button>
      </div>
    </section>

    <!-- Info -->
    <div v-if="circleInfo" class="bg-surface border-2 border-border rounded-xl p-4 mb-4 text-sm">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <span class="block text-2xl font-bold text-accent-dark">{{ circleInfo.count }}</span>
          <span class="text-[11px] text-text-muted uppercase">Circles</span>
        </div>
        <div>
          <span class="block text-2xl font-bold text-accent-dark">{{ circleInfo.tier }}</span>
          <span class="text-[11px] text-text-muted uppercase">Tier</span>
        </div>
        <div>
          <span class="block text-2xl font-bold text-accent-dark">{{ circleInfo.subRadius }}m</span>
          <span class="text-[11px] text-text-muted uppercase">Sub-radius</span>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="circleInfo" class="flex flex-wrap gap-4 mb-4 px-3 py-2 bg-surface rounded-[10px] border border-border text-xs">
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full border-2" style="border-color: #e67e22; background: rgba(243, 156, 18, 0.15)"></span>
        Search radius
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full border-2" style="border-color: #3498db; background: rgba(52, 152, 219, 0.15)"></span>
        Center
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full border-2" style="border-color: #27ae60; background: rgba(39, 174, 96, 0.15)"></span>
        Ring 1 (6)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full border-2" style="border-color: #9b59b6; background: rgba(155, 89, 182, 0.15)"></span>
        Ring 2 (12)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full border-2" style="border-color: #e74c3c; background: rgba(231, 76, 60, 0.15)"></span>
        Ring 3 (18)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full border-2" style="border-color: #f39c12; background: rgba(243, 156, 18, 0.15)"></span>
        Ring 4 (24)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full border-2" style="border-color: #1abc9c; background: rgba(26, 188, 156, 0.15)"></span>
        Ring 5 (30)
      </span>
    </div>

    <!-- Map -->
    <div ref="mapEl" class="h-[600px] w-full rounded-2xl overflow-hidden border-2 border-border"></div>
  </div>
</template>

<script setup lang="ts">
const { $L } = useNuxtApp();

let map: L.Map | null = null;
let layerGroup: L.LayerGroup | null = null;

const mapEl = ref<HTMLDivElement | null>(null);
const inputLat = ref("55.678831");
const inputLng = ref("12.579570");
const inputRadius = ref("1500");
const geolocating = ref(false);

const circleInfo = ref<{ count: number; tier: string; subRadius: number } | null>(null);

// ── Geometry (mirrored from server/utils/places.ts) ──────
type Circle = { latitude: number; longitude: number; radius: number; ring: "center" | "ring1" | "ring2" | "ring3" | "ring4" | "ring5" };

function generateSearchCircles(lat: number, lng: number, radius: number): Circle[] {
  const earthRadius = 6371000;

  function addRing(circles: Circle[], count: number, offsetDist: number, subRadius: number, ring: Circle["ring"]) {
    for (let i = 0; i < count; i++) {
      const angle = (i * (360 / count) * Math.PI) / 180;
      const dLat = (offsetDist * Math.cos(angle)) / earthRadius;
      const dLng = (offsetDist * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
      circles.push({
        latitude: lat + (dLat * 180) / Math.PI,
        longitude: lng + (dLng * 180) / Math.PI,
        radius: subRadius,
        ring,
      });
    }
  }

  // Tier 1 — Tiny (≤300m): center + 6 = 7 circles
  if (radius <= 300) {
    const subRadius = radius * 0.55;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius, ring: "center" }];
    addRing(circles, 6, radius * 0.5, subRadius, "ring1");
    return circles;
  }

  // Tier 2 — Small (≤600m): center + 6 + 12 = 19 circles
  if (radius <= 600) {
    const subRadius = radius * 0.4;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius, ring: "center" }];
    addRing(circles, 6, radius * 0.38, subRadius, "ring1");
    addRing(circles, 12, radius * 0.75, subRadius, "ring2");
    return circles;
  }

  // Tier 3 — Medium (≤1000m): center + 6 + 12 + 18 = 37 circles
  if (radius <= 1000) {
    const subRadius = radius * 0.3;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius, ring: "center" }];
    addRing(circles, 6, radius * 0.28, subRadius, "ring1");
    addRing(circles, 12, radius * 0.55, subRadius, "ring2");
    addRing(circles, 18, radius * 0.82, subRadius, "ring3");
    return circles;
  }

  // Tier 4 — Large (≤1500m): center + 6 + 12 + 18 + 24 = 61 circles
  if (radius <= 1500) {
    const subRadius = radius * 0.24;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius, ring: "center" }];
    addRing(circles, 6, radius * 0.20, subRadius, "ring1");
    addRing(circles, 12, radius * 0.40, subRadius, "ring2");
    addRing(circles, 18, radius * 0.60, subRadius, "ring3");
    addRing(circles, 24, radius * 0.80, subRadius, "ring4");
    return circles;
  }

  // Tier 5 — Full game (≤2000m): center + 6 + 12 + 18 + 24 + 30 = 91 circles
  const subRadius = radius * 0.2;
  const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius, ring: "center" }];
  addRing(circles, 6, radius * 0.17, subRadius, "ring1");
  addRing(circles, 12, radius * 0.34, subRadius, "ring2");
  addRing(circles, 18, radius * 0.51, subRadius, "ring3");
  addRing(circles, 24, radius * 0.68, subRadius, "ring4");
  addRing(circles, 30, radius * 0.85, subRadius, "ring5");
  return circles;
}

// ── Actions ──────────────────────────────────────────────
function useMyLocation() {
  if (!navigator.geolocation) return;
  geolocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      inputLat.value = pos.coords.latitude.toFixed(6);
      inputLng.value = pos.coords.longitude.toFixed(6);
      geolocating.value = false;
    },
    () => { geolocating.value = false; },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function drawCircles() {
  const lat = parseFloat(inputLat.value);
  const lng = parseFloat(inputLng.value);
  const radius = parseInt(inputRadius.value) || 1500;
  if (isNaN(lat) || isNaN(lng) || !$L || !mapEl.value) return;

  // Init map if needed
  if (!map) {
    map = $L.map(mapEl.value).setView([lat, lng], 15);
    $L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    layerGroup = $L.layerGroup().addTo(map);
  } else {
    layerGroup!.clearLayers();
  }

  // Draw the overall search radius (dashed orange)
  const outerCircle = $L.circle([lat, lng], {
    radius,
    color: "#e67e22",
    fillColor: "#f39c12",
    fillOpacity: 0.08,
    weight: 3,
    dashArray: "10 6",
  }).addTo(layerGroup!);

  // Center marker
  const chickenIcon = $L.divIcon({
    html: '<div style="font-size:28px;text-align:center;">🐔</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "chicken-icon",
  });
  $L.marker([lat, lng], { icon: chickenIcon }).addTo(layerGroup!);

  // Generate and draw sub-circles
  const circles = generateSearchCircles(lat, lng, radius);

  const colors: Record<string, { color: string }> = {
    center: { color: "#3498db" },
    ring1:  { color: "#27ae60" },
    ring2:  { color: "#9b59b6" },
    ring3:  { color: "#e74c3c" },
    ring4:  { color: "#f39c12" },
    ring5:  { color: "#1abc9c" },
  };

  circles.forEach((c, i) => {
    const style = colors[c.ring];
    $L.circle([c.latitude, c.longitude], {
      radius: c.radius,
      color: style.color,
      fillColor: style.color,
      fillOpacity: 0.12,
      weight: 2,
    }).addTo(layerGroup!);

    // Small dot at each circle center
    const dotIcon = $L.divIcon({
      html: `<div style="width:8px;height:8px;background:${style.color};border-radius:50%;border:1px solid white;"></div>`,
      iconSize: [8, 8],
      iconAnchor: [4, 4],
      className: "dot-icon",
    });
    $L.marker([c.latitude, c.longitude], { icon: dotIcon })
      .addTo(layerGroup!)
      .bindPopup(`Circle #${i + 1}<br/>Ring: ${c.ring}<br/>Radius: ${Math.round(c.radius)}m`);
  });

  // Update info
  const tierNames: Record<number, string> = {
    7: "Tiny (7)",
    19: "Small (19)",
    37: "Medium (37)",
    61: "Large (61)",
    91: "Full (91)",
  };
  const subRadius = circles[0].radius;
  circleInfo.value = {
    count: circles.length,
    tier: tierNames[circles.length] || `Custom (${circles.length})`,
    subRadius: Math.round(subRadius),
  };

  // Fit bounds to outer circle
  map!.fitBounds(outerCircle.getBounds(), { padding: [30, 30] });
}

onUnmounted(() => {
  if (map) { map.remove(); map = null; }
});
</script>
