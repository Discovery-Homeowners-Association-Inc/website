/**
 * Every kind of content the public site shows, as the admin app stores it
 * and the site reads it. One definition, used by both.
 */
import { z } from "zod";
import type { Role } from "./minutes.ts";

const text = (max: number) => z.string().trim().max(max);
const isoDateTime = z.iso.datetime({ offset: true });

/* ── Items: many of a kind, each with a lifecycle ─────────────────────────── */

export const ITEM_KINDS = ["news", "event", "document", "page"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_STATES = ["draft", "pending", "published"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export const NEWS_CATEGORIES = [
  "general",
  "maintenance",
  "pool",
  "meetings",
  "events",
] as const;
export const DOCUMENT_CATEGORIES = [
  "general",
  "governing",
  "acc",
  "pool",
  "rec-center",
  "rv-lot",
  "parks",
  "trash",
  "newsletters",
  "minutes",
] as const;

export const NewsBody = z.object({
  title: text(160).min(1),
  summary: text(300).min(1),
  body: text(20000).default(""),
  category: z.enum(NEWS_CATEGORIES).default("general"),
  pinned: z.boolean().default(false),
});

export const EventBody = z.object({
  title: text(160).min(1),
  summary: text(300).min(1),
  body: text(20000).default(""),
  start: isoDateTime,
  end: isoDateTime,
  location: text(200).default("Discovery Recreation Center"),
  cost: text(80).default(""),
  audience: text(120).default(""),
  contact_email_key: text(40).default(""),
});

export const DocumentBody = z.object({
  title: text(160).min(1),
  summary: text(300).min(1),
  category: z.enum(DOCUMENT_CATEGORIES).default("general"),
  language: z.enum(["en", "es"]).default("en"),
  featured: z.boolean().default(false),
  /** Id of the uploaded file; the public site serves it at /documents/<slug>.pdf. */
  file_id: text(64).default(""),
  file_name: text(200).default(""),
});

export const PageBody = z.object({
  title: text(160).min(1),
  summary: text(300).default(""),
  body: text(60000).default(""),
});

export const ITEM_BODIES = {
  news: NewsBody,
  event: EventBody,
  document: DocumentBody,
  page: PageBody,
} as const;

/** Fields every item has, whatever its kind. */
export const ItemMeta = z.object({
  publish_at: isoDateTime,
  expires_at: isoDateTime.nullable().default(null),
  expiry_action: z.enum(["hide", "delete"]).default("hide"),
});
export type ItemMeta = z.infer<typeof ItemMeta>;

export type Item<K extends ItemKind = ItemKind> = ItemMeta & {
  id: string;
  kind: K;
  slug: string;
  status: ItemState;
  body: z.infer<(typeof ITEM_BODIES)[K]>;
  author_id: string | null;
  updated_at: string;
};

/** Visible on the public site: published, and inside its dates. */
export function isVisible(
  item: { status: ItemState; publish_at: string; expires_at: string | null },
  now: Date,
): boolean {
  if (item.status !== "published") return false;
  if (new Date(item.publish_at) > now) return false;
  if (item.expires_at && new Date(item.expires_at) <= now) return false;
  return true;
}

export type ItemAction =
  "submit" | "approve" | "reject" | "publish" | "unpublish";

/**
 * Which lifecycle actions a person may take on an item.
 *  - Editors submit; they never publish.
 *  - Admins and secretaries publish directly unless the kind needs approval.
 *  - Nobody approves their own submission.
 */
export function itemActions(input: {
  status: ItemState;
  roles: readonly Role[];
  isAuthor: boolean;
  requiresApproval: boolean;
}): ItemAction[] {
  const { status, roles, isAuthor, requiresApproval } = input;
  const can = (...r: Role[]) => r.some((x) => roles.includes(x));
  const out: ItemAction[] = [];
  if (status === "draft") {
    if (can("admin", "secretary") && !requiresApproval) out.push("publish");
    if (can("admin", "secretary", "editor", "board")) out.push("submit");
  }
  if (status === "pending" && can("admin", "secretary", "board") && !isAuthor)
    out.push("approve", "reject");
  if (status === "published" && can("admin", "secretary"))
    out.push("unpublish");
  return out;
}

export const ITEM_AFTER: Record<ItemAction, ItemState> = {
  submit: "pending",
  approve: "published",
  reject: "draft",
  publish: "published",
  unpublish: "draft",
};

/** A URL-safe slug from a title: "Pool passes for 2026" -> "pool-passes-for-2026". */
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";

/* ── Roster: people who serve, with or without a login ────────────────────── */

export const BOARD_OFFICES = [
  "President",
  "Vice President",
  "Treasurer",
  "Secretary",
  "Director",
] as const;

export const Person = z.object({
  name: text(120).min(1),
  email: z.email().or(z.literal("")).default(""),
  phone: text(40).default(""),
  /** Office held on the board, or empty if not a director. */
  office: z.enum(BOARD_OFFICES).or(z.literal("")).default(""),
  /** Committee slugs this person serves on, e.g. ["acc"]. */
  committees: z.array(text(40)).default([]),
  chairs: z.array(text(40)).default([]),
  term_start: z.iso.date().nullable().default(null),
  term_end: z.iso.date().nullable().default(null),
  note: text(300).default(""),
  /** Show the email address on the public site? Off by default. */
  show_email: z.boolean().default(false),
  order: z.number().int().min(0).default(100),
});
export type Person = z.infer<typeof Person>;

/** What the public site may show about a person. Phone numbers never leave the admin app. */
export const PublicPerson = Person.omit({
  phone: true,
  show_email: true,
}).extend({ id: z.string() });
export type PublicPerson = z.infer<typeof PublicPerson>;
export const toPublicPerson = (p: Person & { id: string }): PublicPerson => {
  const { phone: _phone, show_email, email, ...rest } = p;
  return { ...rest, email: show_email ? email : "" };
};

/** Serving today: no end date, or a leaving date still to come. `term_end` is the day they leave. */
export const isServing = (p: { term_end: string | null }, today: string) =>
  !p.term_end || p.term_end > today;

export const Committee = z.object({
  slug: text(40).regex(/^[a-z-]+$/),
  name: text(120).min(1),
  abbr: text(12).default(""),
  email_key: text(40).default("general"),
  purpose: text(600).default(""),
  meets: text(200).default(""),
  page: text(120).default(""),
  volunteers_wanted: z.boolean().default(false),
  order: z.number().int().min(0).default(100),
});
export type Committee = z.infer<typeof Committee>;
