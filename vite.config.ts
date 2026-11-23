import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/dadari/",
  plugins: [react(), tailwindcss()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
