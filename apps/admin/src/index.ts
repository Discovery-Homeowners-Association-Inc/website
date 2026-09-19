import { createApp, siteChangeNotifier } from "./app.ts";
import { type Auth, createAuth } from "./auth.ts";
import { dispatchRebuild } from "./github.ts";
import { runScheduled } from "./scheduled.ts";

// One Better Auth instance per isolate: building it is not free, and the
// Workers Free plan allows 10 ms of CPU per request.
let auth: Auth | undefined;
const getAuth = (env: Env) => (auth ??= createAuth(env));

const siteChanged = async (env: Env, reason: string) => {
  try {
    await dispatchRebuild(env, reason);
  } catch (e) {
    // The daily scheduled build is the fallback; a failed nudge is not fatal.
    console.warn(
      "site rebuild request failed:",
      e instanceof Error ? e.message : e,
    );
  }
};

const app = createApp({
  getAuth,
  siteChanged,
  resolveUser: async (request, env) => {
    const session = await getAuth(env).api.getSession({
      headers: request.headers,
    });
    return session
      ? {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        }
      : null;
  },
  currentSessionId: async (request, env) =>
    (await getAuth(env).api.getSession({ headers: request.headers }))?.session
      .id ?? null,
});

export default {
  fetch: app.fetch,
  scheduled: async (_controller, env, ctx) => {
    ctx.waitUntil(
      runScheduled(env, { siteChanged: siteChangeNotifier(siteChanged) }),
    );
  },
} satisfies ExportedHandler<Env>;
