import type { Committee, Person } from "@dhoa/shared";
import { isServing } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import { api, messageFrom } from "./api.ts";

export type RosterPerson = Person & { id: string; updated_at: string };

export function useRoster() {
  const [people, setPeople] = useState<RosterPerson[] | null>(null);
  const [committees, setCommittees] = useState<Committee[] | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    Promise.all([
      api<RosterPerson[]>("GET", "/roster/people"),
      api<Committee[]>("GET", "/roster/committees"),
    ]).then(
      ([p, c]) => (setPeople(p), setCommittees(c)),
      (e: unknown) => setError(messageFrom(e)),
    );
  useEffect(() => void load(), []);
  const today = new Date().toISOString().slice(0, 10);
  const serving = (people ?? []).filter((p) => isServing(p, today));
  return {
    people,
    committees,
    serving,
    directors: serving.filter((p) => p.office),
    error,
    reload: load,
  };
}
