import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
  },
}));
