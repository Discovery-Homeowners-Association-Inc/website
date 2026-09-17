/** Minutes lifecycle. The API enforces these transitions; the UI only reflects them. */
export const MINUTES_STATES = [
  "draft",
  "in_review",
  "ready_for_vote",
  "approved",
  "published",
] as const;
export type MinutesState = (typeof MINUTES_STATES)[number];

export const ROLES = [
  "admin",
  "secretary",
  "board",
  "editor",
  "reviewer",
] as const;
export type Role = (typeof ROLES)[number];

type Transition = {
  from: MinutesState;
  to: MinutesState;
  roles: readonly Role[];
};

export const MINUTES_TRANSITIONS: readonly Transition[] = [
  { from: "draft", to: "in_review", roles: ["secretary", "admin"] },
  { from: "in_review", to: "draft", roles: ["secretary", "admin"] },
  { from: "in_review", to: "ready_for_vote", roles: ["secretary", "admin"] },
  { from: "ready_for_vote", to: "in_review", roles: ["secretary", "admin"] },
  {
    from: "ready_for_vote",
    to: "approved",
    roles: ["secretary", "board", "admin"],
  },
  { from: "approved", to: "published", roles: ["secretary", "admin"] },
];

export function canTransition(
  from: MinutesState,
  to: MinutesState,
  roles: readonly Role[],
): boolean {
  return MINUTES_TRANSITIONS.some(
    (t) =>
      t.from === from && t.to === to && t.roles.some((r) => roles.includes(r)),
  );
}
