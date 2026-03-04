import type { Config } from "tailwindcss";

export default {
  content: [
    "./components/**/*.{vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./composables/**/*.ts",
    "./plugins/**/*.ts",
    "./app.vue",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#fef9ef",
        surface: "#ffffff",
        border: "#f0e6d3",
        text: "#3d2c1e",
        "text-muted": "#8b7355",
        accent: "#e67e22",
        "accent-dark": "#d35400",
        green: "#27ae60",
        red: "#e74c3c",
        gray: "#95a5a6",
        "chicken-yellow": "#f9ca24",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
