import { useEffect, useState } from "preact/hooks";
import { api, messageFrom, type Me, when } from "../lib/api.ts";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";

type Profile = Me & {
  provider: string | null;
  sessions: {
    id: string;
    created_at: string;
    user_agent: string | null;
    ip: string | null;
  }[];
};

const device = (ua: string | null) => {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone or iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown device";
  const browser = /Firefox/.test(ua)
    ? "Firefox"
    : /Edg/.test(ua)
      ? "Edge"
      : /Chrome/.test(ua)
        ? "Chrome"
        : /Safari/.test(ua)
          ? "Safari"
          : "browser";
  return `${browser} on ${os}`;
};

export function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const load = () =>
    api<Profile>("GET", "/me").then(
      (x) => (setP(x), setName(x.name)),
      (e: unknown) => setError(messageFrom(e)),
    );
  useEffect(() => void load(), []);
  if (!p) return error ? <ErrorNotice message={error} /> : <Loading />;
  return (
    <>
      <PageHead title="Your profile" />
      <ErrorNotice message={error} />
      <Saved message={saved} />
      <form
        class="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void api("PATCH", "/me", { name }).then(
            () => (load(), setSaved("Name saved.")),
            (err: unknown) => setError(messageFrom(err)),
          );
        }}
      >
        <h2>Your name</h2>
        <div class="field">
          <label for="name">Name as it appears to others</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <span class="hint">
            Used on comments, versions and the audit trail.
          </span>
        </div>
        <button class="button" type="submit" disabled={name.trim() === p.name}>
          Save name
        </button>
      </form>
      <section class="panel">
        <h2>Sign-in</h2>
        <dl>
          <dt>Email</dt>
          <dd>{p.email}</dd>
          <dt>Signs in with</dt>
          <dd>
            {p.provider === "google"
              ? "Google"
              : (p.provider ?? "Not linked yet")}
          </dd>
          <dt>Your roles</dt>
          <dd>{p.grants.map((g) => g.role).join(", ")}</dd>
        </dl>
        <p class="meta">
          To change your email or password, change them with Google; this app
          never stores a password.
        </p>
      </section>
      <section class="panel">
        <h2>Where you are signed in</h2>
        <ul>
          {p.sessions.map((s) => (
            <li key={s.id}>
              {device(s.user_agent)}, since {when(s.created_at)}
            </li>
          ))}
        </ul>
        {p.sessions.length > 1 && (
          <button
            class="button button--quiet"
            type="button"
            onClick={() =>
              void api("POST", "/me/sign-out-others").then(
                () => (load(), setSaved("Signed out everywhere else.")),
                (e: unknown) => setError(messageFrom(e)),
              )
            }
          >
            Sign out everywhere else
          </button>
        )}
      </section>
    </>
  );
}
