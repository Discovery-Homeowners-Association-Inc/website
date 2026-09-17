/**
 * The structured shapes of an agenda and a set of minutes. Minutes are
 * structured rather than free text so they render consistently, so reviewers
 * can comment against a specific item, and so the PDF export for PayHOA has
 * the same layout every month.
 */
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const name = text(120).min(1);

export const AgendaBody = z.object({
  items: z
    .array(
      z.object({
        id: text(40).min(1),
        title: text(200).min(1),
        detail: text(2000).default(""),
      }),
    )
    .max(60),
  notes: text(4000).default(""),
});
export type AgendaBody = z.infer<typeof AgendaBody>;

export const Motion = z.object({
  text: text(2000).min(1),
  moved_by: name,
  seconded_by: text(120).default(""),
  result: z.enum(["carried", "failed", "tabled", "withdrawn"]),
  yes: z.number().int().min(0).default(0),
  no: z.number().int().min(0).default(0),
  abstain: z.number().int().min(0).default(0),
});

export const MinutesBody = z.object({
  called_to_order: text(20).default(""),
  presiding: text(120).default(""),
  recorded_by: text(120).default(""),
  present: z.array(name).max(40).default([]),
  absent: z.array(name).max(40).default([]),
  guests: text(1000).default(""),
  quorum: z.boolean().default(false),
  items: z
    .array(
      z.object({
        id: text(40).min(1),
        title: text(200).min(1),
        discussion: text(20000).default(""),
        motions: z.array(Motion).max(20).default([]),
        /*
         * What happens to this item after the meeting. "closed" is finished and
         * carries nothing; "follow_up" was decided but someone must act;
         * "deferred" was not reached and belongs on the next agenda. The last
         * two are what the next meeting's agenda suggests, which is the only
         * reason the secretary is asked for it.
         */
        outcome: z.enum(["closed", "follow_up", "deferred"]).default("closed"),
        /** A roster name, so a follow-up has someone carrying it. */
        follow_up_owner: text(120).default(""),
        follow_up_note: text(500).default(""),
      }),
    )
    .max(60)
    .default([]),
  adjourned_at: text(20).default(""),
});
export type MinutesBody = z.infer<typeof MinutesBody>;

/** Stable JSON: keys sorted at every level, so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 of the canonical JSON, as lowercase hex. Uses Web Crypto, available in Workers, browsers and Node. */
export async function contentHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
