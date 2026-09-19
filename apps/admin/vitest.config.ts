import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    new URL("./migrations", import.meta.url).pathname,
  );
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            BETTER_AUTH_URL: "http://test.invalid",
            BETTER_AUTH_SECRET:
              "test-secret-that-is-at-least-32-characters-long",
            GOOGLE_CLIENT_ID: "test",
            GOOGLE_CLIENT_SECRET: "test",
            DEV_SIGN_IN: "false",
            BOOTSTRAP_TOKEN: "",
            GITHUB_APP_ID: "",
            GITHUB_APP_INSTALLATION_ID: "",
            GITHUB_APP_PRIVATE_KEY: "",
          },
        },
      }),
    ],
    test: { setupFiles: ["./test/apply-migrations.ts"] },
  };
});
