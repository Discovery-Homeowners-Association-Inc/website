import type { AgendaBody, MinutesBody, MinutesState, Role } from "@dhoa/shared";

export type Grant = { role: Role; scope: string };
export type Me = { id: string; email: string; name: string; grants: Grant[] };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the admin API. A 401 sends the person to the sign-in page. */
export async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && !location.pathname.startsWith("/sign-in/")) {
    location.assign(
      `/sign-in/?next=${encodeURIComponent(location.pathname + location.search)}`,
    );
    throw new ApiError(401, "Sign in to continue.");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok)
    throw new ApiError(
      res.status,
      data?.error ?? `The server answered ${res.status}.`,
    );
  return data as T;
}

export const can = (me: Me | null, ...roles: Role[]) =>
  !!me?.grants.some((g) => g.scope === "" && roles.includes(g.role));

export type MeetingType = "board" | "annual" | "special" | "pool-rec";
export type Meeting = {
  id: string;
  type: MeetingType;
  date: string;
  time: string;
  location: string;
  status: "scheduled" | "cancelled" | "held";
};
export type MeetingListItem = Meeting & {
  agenda_status: "draft" | "published" | null;
  agenda_version: number | null;
  agenda_published_version: number | null;
  minutes_status: MinutesState | null;
};

export type AgendaResponse = {
  meeting: Meeting;
  agenda: {
    status: "draft" | "published";
    current_version: number;
    published_version: number | null;
    published_at: string | null;
  } | null;
  current: { version: number; body: AgendaBody; created_at: string } | null;
};

export type Comment = {
  id: string;
  version: number;
  anchor: string;
  body: string;
  author: string | null;
  author_id: string;
  created_at: string;
  resolved_at: string | null;
};
export type Vote = {
  version: number;
  sha256: string;
  voted_on: string;
  motion_by: string;
  seconded_by: string;
  yes: number;
  no: number;
  abstain: number;
};

export type MinutesResponse =
  | { meeting: Meeting; minutes: null }
  | {
      meeting: Meeting;
      minutes: {
        status: MinutesState;
        current_version: number;
        filed_at: string | null;
        filed_note: string | null;
      };
      current: {
        version: number;
        body: MinutesBody;
        sha256: string;
        created_at: string;
      };
      versions: {
        version: number;
        sha256: string;
        change_note: string | null;
        created_at: string;
        author: string | null;
      }[];
      comments: Comment[];
      reviewed_by: { user_id: string; name: string; reviewed_at: string }[];
      vote: Vote | null;
    };

export type ExportResponse = {
  meeting: Meeting;
  body: MinutesBody;
  version: number;
  sha256: string;
  vote: Vote;
};

export const typeLabel: Record<MeetingType, string> = {
  board: "Board meeting",
  annual: "Annual meeting",
  special: "Special meeting",
  "pool-rec": "Pool & Recreation Committee",
};

export const statusLabel: Record<MinutesState, string> = {
  draft: "Draft",
  in_review: "In review",
  ready_for_vote: "Ready for a vote",
  approved: "Approved",
  filed: "Filed in PayHOA",
};

export const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));

export const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(iso));

export const param = (name: string) =>
  new URLSearchParams(location.search).get(name) ?? "";

/**
 * A short random id for list items. Not crypto.randomUUID(): browsers only
 * provide that on https or localhost, and the admin is also used over plain
 * http on the LAN during development.
 */
export const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
