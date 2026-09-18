import { z } from "zod";

/**
 * What the association can take out of this software, and who may take it.
 *
 * The roles here are what the admin app shows; they are not the enforcement.
 * Every dataset is read through the endpoint that already owns it, so the
 * server decides in the same place it always does and a hidden button is
 * never the only thing standing between someone and the minutes.
 */
export const EXPORT_DATASETS = [
  {
    key: "roster",
    label: "Roster and committees",
    note: "Who serves, and on what. Already public on the site.",
    roles: [],
  },
  {
    key: "meetings",
    label: "Meetings and agendas",
    note: "Every meeting, with its agenda where one was written.",
    roles: [],
  },
  {
    key: "content",
    label: "Site content",
    note: "News, events, pages and documents, including drafts.",
    roles: [],
  },
  {
    key: "minutes",
    label: "Minutes, including drafts",
    note: "Never published. The board's record of what was decided.",
    roles: ["admin", "secretary", "board", "reviewer"],
  },
  {
    key: "settings",
    label: "Site settings",
    note: "The facts the site repeats in many places, including contacts.",
    roles: ["admin", "secretary"],
  },
  {
    key: "accounts",
    label: "Sign-in accounts",
    note: "Names, email addresses and roles. Personal data: handle with care.",
    roles: ["admin"],
  },
  {
    key: "audit",
    label: "Audit log",
    note: "Who changed what, and when. Includes exports.",
    roles: ["admin"],
  },
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number]["key"];

export const EXPORT_FORMATS = ["json", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** What the admin app tells the server it took, so the log can say so. */
export const ExportRecord = z.object({
  // Capped at the number that exist: unbounded, a caller could hand the Worker
  // a hundred thousand entries to validate inside its 10 ms.
  datasets: z
    .array(z.enum(EXPORT_DATASETS.map((d) => d.key) as [string, ...string[]]))
    .min(1)
    .max(EXPORT_DATASETS.length),
  format: z.enum(EXPORT_FORMATS),
});
export type ExportRecord = z.infer<typeof ExportRecord>;
