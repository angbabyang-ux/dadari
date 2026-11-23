import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  use: { baseURL: "http://localhost:4174/dadari/", locale: "ko-KR" },
  webServer: {
    command: "npx vite build && npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174/dadari/",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, browserName: "chromium" } },
  ],
});
