import type { BetterAuthOptions } from "better-auth";

/**
 * Better Auth options shared by the Worker and the schema generator, so the
 * migration SQL always matches what the Worker expects.
 *
 * Sign-in is Google only, so nobody stores a password and nobody manages
 * one. Google handles two-factor authentication and account recovery.
 *
 * Nobody can sign up. An admin invites a person by email, which creates their
 * user row with emailVerified = true; their first Google sign-in with that
 * address links to it. A Google account with any other address is refused.
 */
export function authOptions(config: {
  googleClientId: string;
  googleClientSecret: string;
}) {
  return {
    appName: "Discovery HOA admin",
    basePath: "/api/auth",
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        disableSignUp: true,
        prompt: "select_account",
      },
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}
