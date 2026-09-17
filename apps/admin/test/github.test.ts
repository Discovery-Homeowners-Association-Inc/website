import { describe, expect, it } from "vitest";
import { dispatchRebuild, githubConfigured } from "../src/github.ts";

describe("GitHub rebuild request", () => {
  it("does nothing when the App is not configured", async () => {
    expect(githubConfigured({})).toBe(false);
    expect(await dispatchRebuild({}, "test")).toBe(false);
  });

  it("signs an App JWT, fetches an installation token, and dispatches", async () => {
    const { privateKey } = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const der = (await crypto.subtle.exportKey(
      "pkcs8",
      privateKey,
    )) as ArrayBuffer;
    // A throwaway key made for this test run. The PEM markers are assembled
    // from parts so secret scanners do not mistake this for a stored key.
    const marker = (kind: string) =>
      `-----${kind} ${["PRIVATE", "KEY"].join(" ")}-----`;
    const pem = `${marker("BEGIN")}\n${btoa(String.fromCharCode(...new Uint8Array(der)))}\n${marker("END")}`;
    const calls: { url: string; auth: string | null; body: string }[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        auth: new Headers(init?.headers).get("authorization"),
        body: String(init?.body),
      });
      if (url.endsWith("/access_tokens"))
        return new Response(JSON.stringify({ token: "ghs_test" }), {
          status: 201,
        });
      return new Response(null, { status: 204 });
    };
    const ok = await dispatchRebuild(
      {
        GITHUB_APP_ID: "123",
        GITHUB_APP_INSTALLATION_ID: "456",
        GITHUB_APP_PRIVATE_KEY: pem,
        GITHUB_REPO: "org/site",
      },
      "news published",
      fetchFn,
    );
    expect(ok).toBe(true);
    expect(calls[0]?.url).toBe(
      "https://api.github.com/app/installations/456/access_tokens",
    );
    expect(calls[0]?.auth).toMatch(/^Bearer eyJ/);
    expect(calls[1]).toMatchObject({
      url: "https://api.github.com/repos/org/site/dispatches",
      auth: "Bearer ghs_test",
    });
    expect(JSON.parse(calls[1]!.body)).toEqual({
      event_type: "site-content-changed",
      client_payload: { reason: "news published" },
    });
  });
});
