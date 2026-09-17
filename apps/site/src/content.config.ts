import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({ title: z.string(), summary: z.string() }),
});

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    category: z.enum(["general", "maintenance", "pool", "meetings", "events"]),
    pinned: z.boolean().default(false),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date(),
    summary: z.string(),
    location: z.string().default("Discovery Recreation Center"),
    cost: z.string().optional(),
    category: z.string().optional(),
    audience: z.string().optional(),
    contact_email_key: z.string().optional(),
  }),
});

const documents = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/documents" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum([
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
    ]),
    file: z.string().startsWith("/documents/"),
    language: z.enum(["en", "es"]).default("en"),
    summary: z.string(),
    featured: z.boolean().default(false),
  }),
});

/**
 * Published meeting records. The admin app writes one file per meeting when an
 * agenda is published. Minutes are not published here: approved minutes are
 * kept in PayHOA's resident portal, and drafts never leave the admin app.
 */
const meetings = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/meetings" }),
  schema: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(["board", "annual", "special", "pool-rec"]),
    time: z.string(),
    location: z.string(),
    agenda: z
      .array(z.object({ title: z.string(), detail: z.string().optional() }))
      .optional(),
    agenda_published: z.coerce.date().optional(),
  }),
});

export const collections = { pages, news, events, documents, meetings };
