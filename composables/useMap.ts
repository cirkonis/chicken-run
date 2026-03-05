/**
 * Composable: Leaflet map setup, marker painting, highlight, geolocation.
 * Keeps all map logic out of the page component.
 */
import type { HuntBar } from "~/types";

export function useMap() {
  const { $L } = useNuxtApp();

  let map: L.Map | null = null;
  let centerMarker: L.Marker | null = null;
  let circleOverlay: L.Circle | null = null;
  let markersLayer: L.LayerGroup | null = null;

  // ── Marker tracking ────────────────────────────────────
  let markerMap = new Map<string, L.Marker>();
  let onMarkerClickCb: ((barId: string) => void) | null = null;
  let highlightedId: string | null = null;

  // ── User location ──────────────────────────────────────
  let userMarker: L.Marker | null = null;
  let watchId: number | null = null;

  /** Register a callback for when a map marker is clicked. */
  function setOnMarkerClick(cb: (barId: string) => void) {
    onMarkerClickCb = cb;
  }

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

      // Click map background to clear highlight
      map.on("click", () => {
        clearHighlight();
      });
    } else {
      map.setView([center.lat, center.lng], 15);
      markersLayer!.clearLayers();
      markerMap.clear();
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
    markerMap.clear();
    highlightedId = null;

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

      // Click marker → fire callback
      m.on("click", (e: any) => {
        // Stop map click from also firing (which would clearHighlight)
        $L.DomEvent.stopPropagation(e);
        onMarkerClickCb?.(b.id);
      });

      markerMap.set(b.id, m);
    }
  }

  /** Highlight a single bar marker — dim all others, pan to it, open popup. */
  function highlightBar(barId: string) {
    if (!map) return;

    // Toggle off if already highlighted
    if (highlightedId === barId) {
      clearHighlight();
      return;
    }

    highlightedId = barId;
    for (const [id, marker] of markerMap) {
      if (id === barId) {
        marker.setOpacity(1);
        marker.openPopup();
        map.panTo(marker.getLatLng(), { animate: true });
      } else {
        marker.setOpacity(0.3);
      }
    }
  }

  /** Restore all markers to full opacity. */
  function clearHighlight() {
    highlightedId = null;
    for (const marker of markerMap.values()) {
      marker.setOpacity(1);
      marker.closePopup();
    }
  }

  /** Get the currently highlighted bar id (if any). */
  function getHighlightedId(): string | null {
    return highlightedId;
  }

  // ── User geolocation ──────────────────────────────────

  /** Start watching user's GPS position; show blue dot on map. */
  function startUserLocation(): boolean {
    if (!map || !$L) return false;
    if (!navigator.geolocation) return false;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];

        if (userMarker) {
          userMarker.setLatLng(latlng);
        } else {
          const icon = $L.divIcon({
            html: `<div class="user-location-dot">
              <div class="user-location-pulse"></div>
              <div class="user-location-core"></div>
            </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            className: "user-location-icon",
          });
          userMarker = $L.marker(latlng, { icon, zIndexOffset: 1000 })
            .addTo(map!)
            .bindPopup("You are here");
        }
      },
      (_err) => {
        // silently fail — user denied or unavailable
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return true;
  }

  /** Stop watching user position and remove marker. */
  function stopUserLocation() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (userMarker) {
      userMarker.remove();
      userMarker = null;
    }
  }

  /** Call after show/hide toggle so Leaflet recalculates tile positions. */
  function invalidateSize() {
    map?.invalidateSize();
  }

  /** Tear down the map instance (call in onUnmounted). */
  function cleanup() {
    stopUserLocation();
    if (map) {
      map.remove();
      map = null;
    }
  }

  return {
    initMap,
    paintMarkers,
    highlightBar,
    clearHighlight,
    getHighlightedId,
    setOnMarkerClick,
    startUserLocation,
    stopUserLocation,
    invalidateSize,
    cleanup,
  };
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
