import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // The tests share one database and follow one meeting through its whole life, so run them in order.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:8788" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "./tests/serve.sh",
    url: "http://127.0.0.1:8788/sign-in/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
