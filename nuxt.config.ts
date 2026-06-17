// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],

  // Expose Supabase URL + anon key to the client (safe — anon key is public)
  runtimeConfig: {
    // Server-only (never sent to client)
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "",

    // Client-accessible (exposed via useRuntimeConfig())
    public: {
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    },
  },

  app: {
    head: {
      title: "Chicken Hunt",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "Find the chickens before you get too sloshed",
        },
        // ── PWA / "install to home screen" support (issue #1 deeper fix) ──
        // Installing the app runs it in standalone mode (no browser chrome),
        // where the Back gesture stays inside the app instead of exiting it —
        // which is the root cause of players getting bounced to re-enter codes.
        { name: "theme-color", content: "#e67e22" },
        // iOS: launch full-screen from the home-screen icon.
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "Chicken Hunt" },
        // Android/Chrome equivalent.
        { name: "mobile-web-app-capable", content: "yes" },
      ],
      link: [
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐔</text></svg>",
        },
        // Web app manifest — makes the app installable (see public/manifest.webmanifest).
        { rel: "manifest", href: "/manifest.webmanifest" },
      ],
    },
  },
});
