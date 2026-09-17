import type { Role } from "@dhoa/shared";

export type Grant = { role: Role; scope: string };
export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  grants: Grant[];
};

/** Finds the signed-in user for a request, or null. Production uses Better Auth; tests substitute their own. */
export type ResolveUser = (
  request: Request,
  env: Env,
) => Promise<{ id: string; email: string; name: string } | null>;

export type AppEnv = { Bindings: Env; Variables: { user: CurrentUser } };
