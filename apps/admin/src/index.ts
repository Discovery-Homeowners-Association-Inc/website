import { createApp } from "./app.ts";
import { type Auth, createAuth } from "./auth.ts";

// One Better Auth instance per isolate: building it is not free, and the
// Workers Free plan allows 10 ms of CPU per request.
let auth: Auth | undefined;
const getAuth = (env: Env) => (auth ??= createAuth(env));

export default createApp({
  getAuth,
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
});
