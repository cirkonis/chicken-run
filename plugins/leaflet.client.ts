// .client.ts suffix = Nuxt only runs this in the browser. No SSR.
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default defineNuxtPlugin(() => {
  return { provide: { L } };
});
