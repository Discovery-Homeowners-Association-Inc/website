/**
 * Asks GitHub to rebuild the public site by sending a repository_dispatch
 * event, authenticated as a GitHub App installation. Everything is optional:
 * with no App configured, the daily scheduled build picks changes up instead.
 *
 * The App needs only "Contents: read and write" on this one repository
 * (repository_dispatch requires it). Secrets: GITHUB_APP_ID,
 * GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY (PKCS#8 PEM), and the
 * `wrangler.jsonc` var GITHUB_REPO ("owner/name").
 */
type GithubEnv = Partial<
  Record<
    | "GITHUB_APP_ID"
    | "GITHUB_APP_INSTALLATION_ID"
    | "GITHUB_APP_PRIVATE_KEY"
    | "GITHUB_REPO",
    string
  >
> &
  object;

const b64url = (data: ArrayBuffer | string) => {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

async function appJwt(appId: string, pem: string): Promise<string> {
  const der = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----|\s/g, "")),
    (ch) => ch.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }),
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64url(sig)}`;
}

export function githubConfigured(env: GithubEnv): boolean {
  return !!(
    env.GITHUB_APP_ID &&
    env.GITHUB_APP_INSTALLATION_ID &&
    env.GITHUB_APP_PRIVATE_KEY &&
    env.GITHUB_REPO
  );
}

export async function dispatchRebuild(
  env: GithubEnv,
  reason: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (!githubConfigured(env)) return false;
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "dhoa-admin",
    "x-github-api-version": "2022-11-28",
  };
  const jwt = await appJwt(env.GITHUB_APP_ID!, env.GITHUB_APP_PRIVATE_KEY!);
  const tokenRes = await fetchFn(
    `https://api.github.com/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: { ...headers, authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        repositories: [env.GITHUB_REPO!.split("/")[1]],
        permissions: { contents: "write" },
      }),
    },
  );
  if (!tokenRes.ok)
    throw new Error(`GitHub App token failed: ${tokenRes.status}`);
  const { token } = (await tokenRes.json()) as { token: string };
  const res = await fetchFn(
    `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
    {
      method: "POST",
      headers: { ...headers, authorization: `Bearer ${token}` },
      body: JSON.stringify({
        event_type: "site-content-changed",
        client_payload: { reason },
      }),
    },
  );
  if (res.status !== 204)
    throw new Error(`GitHub dispatch failed: ${res.status}`);
  return true;
}
