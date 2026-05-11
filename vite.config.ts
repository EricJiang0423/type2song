import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the build works whether it is served from the domain root
  // or from a GitHub Pages project subpath (https://user.github.io/repo/).
  base: "./",
  plugins: [react()],
  optimizeDeps: {
    exclude: ["tone"],
  },
});
