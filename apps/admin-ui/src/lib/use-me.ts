import { useEffect, useState } from "preact/hooks";
import { api, type Me, messageFrom } from "./api.ts";

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Me>("GET", "/me").then(setMe, (e: unknown) => setError(messageFrom(e)));
  }, []);
  return { me, error };
}
