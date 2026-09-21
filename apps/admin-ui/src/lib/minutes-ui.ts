import type { MinutesBody } from "@dhoa/shared";

export type MinutesItem = MinutesBody["items"][number];

export const blankItem = (id: string, title = ""): MinutesItem => ({
  id,
  title,
  discussion: "",
  motions: [],
  outcome: "closed",
  follow_up_owner: "",
  follow_up_note: "",
});

/** A non-negative whole number from a text field; anything else is zero. */
export const tally = (s: string) => Math.max(0, Number.parseInt(s, 10) || 0);

export const TALLY_LABELS = {
  yes: "In favor",
  no: "Against",
  abstain: "Abstaining",
} as const;
