/**
 * Composable: interactive Leaflet map for picking a location by clicking.
 * Used by bar-finder and dashboard to set lat/lng via map click.
 */
export function useLocationPicker() {
  const { $L } = useNuxtApp();

  let map: L.Map | null = null;
  let pin: L.Marker | null = null;
  let radiusCircle: L.Circle | null = null;

  /** Callback fired when user clicks the map. */
  let onLocationPicked: ((lat: number, lng: number) => void) | null = null;
  let pickingEnabled = true;

  function setOnLocationPicked(fn: (lat: number, lng: number) => void) {
    onLocationPicked = fn;
  }

  /** Enable or disable location picking on map click. */
  function setPickingEnabled(enabled: boolean) {
    pickingEnabled = enabled;
    // Toggle crosshair cursor on the map container so users know they're placing a pin
    const container = map?.getContainer();
    if (container) {
      container.style.cursor = enabled ? "crosshair" : "";
    }
  }

  /** Initialise the picker map inside `el`, centered on `center`. */
  function initPicker(el: HTMLElement, center: { lat: number; lng: number }, radius?: number) {
    if (!$L) return;

    if (!map) {
      map = $L.map(el).setView([center.lat, center.lng], 14);
      $L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      // Click to pick location (only when picking is enabled)
      map.on("click", (e: L.LeafletMouseEvent) => {
        if (!pickingEnabled) return;
        placePin(e.latlng.lat, e.latlng.lng);
        onLocationPicked?.(e.latlng.lat, e.latlng.lng);
      });
    } else {
      map.setView([center.lat, center.lng], 14);
    }

    // Place initial pin
    placePin(center.lat, center.lng);
    if (radius) updateRadius(radius);
  }

  /** Move the pin marker to a new position. */
  function placePin(lat: number, lng: number) {
    if (!$L || !map) return;

    if (pin) {
      pin.setLatLng([lat, lng]);
    } else {
      const icon = $L.divIcon({
        html: '<div style="font-size:28px;text-align:center;">📍</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        className: "picker-icon",
      });
      pin = $L.marker([lat, lng], { icon }).addTo(map);
    }

    // Update radius circle position too
    if (radiusCircle) {
      radiusCircle.setLatLng([lat, lng]);
    }
  }

  /** Show or update the radius preview circle. */
  function updateRadius(radius: number) {
    if (!$L || !map || !pin) return;
    const pos = pin.getLatLng();

    if (radiusCircle) {
      radiusCircle.setLatLng(pos);
      radiusCircle.setRadius(radius);
    } else {
      radiusCircle = $L.circle([pos.lat, pos.lng], {
        radius,
        color: "#e67e22",
        fillColor: "#f39c12",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "8 4",
      }).addTo(map);
    }
  }

  /** Recalculate tile positions (call after show/hide). */
  function invalidatePickerSize() {
    map?.invalidateSize();
  }

  /** Get the underlying Leaflet map instance (for advanced use like adding bar markers). */
  function getMap() {
    return map;
  }

  /** Tear down the map. */
  function cleanupPicker() {
    if (map) {
      map.remove();
      map = null;
      pin = null;
      radiusCircle = null;
    }
  }

  return {
    initPicker,
    placePin,
    updateRadius,
    invalidatePickerSize,
    getMap,
    cleanupPicker,
    setOnLocationPicked,
    setPickingEnabled,
  };
}
