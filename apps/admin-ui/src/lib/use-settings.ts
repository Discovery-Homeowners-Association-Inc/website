import type { Organization } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import { api, messageFrom } from "./api.ts";

/**
 * The association's public settings, fetched once. Four screens each wrote
 * their own version of this fetch with their own ad-hoc response type and a
 * swallowed rejection; this is the one copy, typed with the real schema, so
 * a failure is visible instead of silent.
 */
export function useOrganization() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Organization>("GET", "/settings/organization").then(
      setOrganization,
      (e: unknown) => setError(messageFrom(e)),
    );
  }, []);
  return { organization, error };
}
