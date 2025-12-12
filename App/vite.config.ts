import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/Spoology/" : "/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
  },
}));
