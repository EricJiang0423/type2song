import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

// Tailwind v4 is config-less (theme lives in src/index.css), so there is no
// tailwind.config.js. The PostCSS pipeline is inlined here instead of a
// separate postcss.config.js to keep the project root tidy.
export default defineConfig({
  // Relative base so the build works whether it is served from the domain root
  // or from a GitHub Pages project subpath (https://user.github.io/repo/).
  base: "./",
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
});
