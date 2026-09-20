import { useState } from "preact/hooks";
import { param } from "../lib/api.ts";
import { ErrorNotice } from "./Notice.tsx";

export default function SignIn() {
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const raw = param("next");
  const next = /^\/(?![\/\\])/.test(raw) ? raw : "/";
  const local =
    typeof location !== "undefined" && location.protocol === "http:";
  const failed = param("error");

  async function google() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        callbackURL: next,
        errorCallbackURL: "/sign-in/",
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) return location.assign(data.url);
    setBusy(false);
    setError(data?.message ?? "Google sign-in is not available right now.");
  }

  async function developer(event: Event) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/dev/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return location.assign(next);
    const data = await res.json().catch(() => null);
    setError(
      res.status === 404 && !data?.message
        ? "Developer sign-in is not turned on for this server."
        : (data?.message ?? "Sign-in failed."),
    );
  }

  return (
    <div class="sign-in">
      <h1>Board administration</h1>
      <p>
        Sign in with the Google account for the email address you were invited
        with.
      </p>
      {failed && (
        <p class="callout callout--warning" role="alert">
          {failed === "signup_disabled"
            ? "That Google account has not been invited. Ask an administrator to invite the email address you signed in with."
            : "Sign-in did not complete. Try again."}
        </p>
      )}
      <ErrorNotice message={error} />
      <p>
        <button class="button" type="button" onClick={google} disabled={busy}>
          Sign in with Google
        </button>
      </p>
      {local && (
        <form class="panel" onSubmit={developer}>
          <h2>Developer sign-in</h2>
          <p class="meta">Only works on a local development server.</p>
          <div class="field">
            <label for="dev-email">Invited email</label>
            <input
              id="dev-email"
              type="email"
              required
              value={email}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>
          <button class="button button--quiet" type="submit">
            Sign in without Google
          </button>
        </form>
      )}
    </div>
  );
}
