/**
 * Minutes lifecycle. The API enforces these transitions; the UI only reflects them.
 *
 * Approved minutes are kept in PayHOA's resident portal, not on the public
 * website. The last step is therefore "filed": the secretary exports the
 * approved version as a PDF, uploads it to PayHOA by hand, and records that
 * the upload happened.
 */
export const MINUTES_STATES = [
  "draft",
  "in_review",
  "ready_for_vote",
  "approved",
  "filed",
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
  { from: "approved", to: "filed", roles: ["secretary", "admin"] },
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

/** Only approved minutes may be exported for PayHOA. Drafts never leave the admin app. */
export const canExport = (state: MinutesState) =>
  state === "approved" || state === "filed";
