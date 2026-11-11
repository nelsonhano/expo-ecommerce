import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // tailwind v4 runs through the vite plugin; an inline (empty) postcss config stops vite
  // from picking up a stray postcss.config.js from a parent directory
  css: { postcss: {} },
});
