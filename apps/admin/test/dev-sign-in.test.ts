import { describe, expect, it } from "vitest";
import { devSignInEnabled } from "../src/dev-sign-in.ts";

const env = (url: string, flag?: string) =>
  ({ BETTER_AUTH_URL: url, DEV_SIGN_IN: flag }) as unknown as Env;

describe("developer sign-in", () => {
  it("is off unless explicitly enabled", () => {
    expect(devSignInEnabled(env("http://localhost:8787"))).toBe(false);
  });
  it("is on for local http when enabled", () => {
    expect(devSignInEnabled(env("http://desktop:8787", "true"))).toBe(true);
  });
  it("can never be enabled over https", () => {
    expect(
      devSignInEnabled(
        env(
          "https://dhoa-admin.discoveryhomeownersassociation.workers.dev",
          "true",
        ),
      ),
    ).toBe(false);
  });
});
