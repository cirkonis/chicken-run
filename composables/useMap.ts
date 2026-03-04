/**
 * Composable: Leaflet map setup, marker painting, and cleanup.
 * Keeps all map logic out of the page component.
 */
import type { HuntBar } from "~/types";

export function useMap() {
  const { $L } = useNuxtApp();

  let map: L.Map | null = null;
  let centerMarker: L.Marker | null = null;
  let circleOverlay: L.Circle | null = null;
  let markersLayer: L.LayerGroup | null = null;

  /** Create (or re-center) the map inside `el`. */
  function initMap(
    el: HTMLElement,
    center: { lat: number; lng: number },
    radius: number
  ) {
    if (!$L) return;

    if (!map) {
      map = $L.map(el).setView([center.lat, center.lng], 15);
      $L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      markersLayer = $L.layerGroup().addTo(map);
    } else {
      map.setView([center.lat, center.lng], 15);
      markersLayer!.clearLayers();
    }

    // Center chicken marker
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

    // Search radius circle
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

  /** Repaint bar markers on the map. */
  function paintMarkers(bars: HuntBar[]) {
    if (!markersLayer || !$L) return;
    markersLayer.clearLayers();

    for (const b of bars) {
      const symbol =
        b.checkStatus === "checked"
          ? "&#10003;"
          : b.checkStatus === "not_checking"
            ? "&#10005;"
            : "?";
      const color =
        b.checkStatus === "checked"
          ? "#27ae60"
          : b.checkStatus === "not_checking"
            ? "#95a5a6"
            : "#e74c3c";

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

  /** Call after show/hide toggle so Leaflet recalculates tile positions. */
  function invalidateSize() {
    map?.invalidateSize();
  }

  /** Tear down the map instance (call in onUnmounted). */
  function cleanup() {
    if (map) {
      map.remove();
      map = null;
    }
  }

  return { initMap, paintMarkers, invalidateSize, cleanup };
}

// ── Helpers ────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  );
}
