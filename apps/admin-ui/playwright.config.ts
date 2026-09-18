import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // The tests share one database and follow one meeting through its whole life, so run them in order.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:8788" },
  /*
   * WebKit is not supported on the Fedora development base, so it is not tested.
   *
   * Firefox runs the specs whose subject is layout -- the header ladder and the
   * form controls -- because those are what differ between engines, and the
   * admin's header is the more crowded of the two apps at eight links.
   *
   * It does not run the workflow specs. They are serial and share one database,
   * following a single meeting from draft through vote to filing, so a second
   * pass replays a story whose ending has already happened: the meeting exists,
   * the invitation is refused, the minutes are already approved. Making them
   * safe means giving every fixture they touch a name of its own; six were done
   * and more kept appearing, each one a test that says less than it did before.
   * Worth doing behind a database per project, which needs a server per project
   * that this config cannot express -- not worth doing one fixture at a time.
   */
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /(header|forms)\.spec\.ts/,
    },
  ],
  webServer: {
    command: "./tests/serve.sh",
    url: "http://127.0.0.1:8788/sign-in/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
