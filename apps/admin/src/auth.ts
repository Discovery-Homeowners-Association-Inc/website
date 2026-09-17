import { betterAuth } from "better-auth";
import { authOptions } from "./auth-options.ts";
import { devSignIn, devSignInEnabled } from "./dev-sign-in.ts";

export function createAuth(env: Env) {
  return betterAuth({
    ...authOptions({
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    plugins: devSignInEnabled(env) ? [devSignIn()] : [],
  });
}
export type Auth = ReturnType<typeof createAuth>;
