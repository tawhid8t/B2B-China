import { defineConfig } from "@playwright/test";

const viewports = [
  { name: "mobile-430", width: 430, height: 932 },
  { name: "small-phone-320", width: 320, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 }
];

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: ".playwright-results",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: "disabled" } },
  use: {
    baseURL: "http://127.0.0.1:3107",
    colorScheme: "light",
    locale: "en-BD",
    timezoneId: "Asia/Shanghai",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: viewports.map(({ name, width, height }) => ({ name, use: { viewport: { width, height } } })),
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 -p 3107",
    url: "http://127.0.0.1:3107/design-system/client/pages/dashboard",
    reuseExistingServer: true,
    timeout: 120000
  }
});
