/**
 * What a meeting is called, in the one place both apps read it from.
 *
 * These labels lived in three: the admin app's api.ts, the site's meeting page,
 * and the agenda template settings. They had already drifted -- the site's
 * upcoming list said "Board of directors meeting" while its own meeting page
 * said "Board meeting", so a resident saw two names for one thing depending on
 * which link they followed.
 */
export const MEETING_TYPES = [
  "board",
  "annual",
  "special",
  "pool-rec",
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_LABEL: Record<MeetingType, string> = {
  board: "Board meeting",
  annual: "Annual meeting",
  special: "Special meeting",
  "pool-rec": "Pool & Recreation Committee meeting",
};
