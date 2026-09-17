import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

/**
 * Local development only: sign in as an invited user by email, without Google.
 *
 * It is added to Better Auth only when DEV_SIGN_IN is "true" AND the app runs
 * over plain http. Production is served over https, so this endpoint cannot
 * exist there even if the variable were set by mistake.
 */
export function devSignInEnabled(env: Env): boolean {
  return (
    (env as { DEV_SIGN_IN?: string }).DEV_SIGN_IN === "true" &&
    new URL(env.BETTER_AUTH_URL).protocol === "http:"
  );
}

export const devSignIn = () =>
  ({
    id: "dev-sign-in",
    endpoints: {
      devSignIn: createAuthEndpoint(
        "/dev/sign-in",
        { method: "POST", body: z.object({ email: z.email() }) },
        async (ctx) => {
          const found = await ctx.context.internalAdapter.findUserByEmail(
            ctx.body.email.toLowerCase(),
          );
          if (!found)
            throw new APIError("NOT_FOUND", {
              message: "No invited user has that email.",
            });
          const session = await ctx.context.internalAdapter.createSession(
            found.user.id,
          );
          await setSessionCookie(ctx, { session, user: found.user });
          return ctx.json({ user: found.user });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
