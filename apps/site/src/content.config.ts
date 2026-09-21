import { defineCollection } from "astro:content";
import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { snapshot } from "./lib/snapshot.ts";

/**
 * Collections come from the snapshot rather than from files. Each loader
 * renders the Markdown body so pages can use <Content /> as before.
 */
function fromSnapshot<T extends { slug?: string; id: string }>(
  name: string,
  rows: T[],
  map: (row: T) => { id: string; data: Record<string, unknown>; body?: string },
): Loader {
  return {
    name: `snapshot:${name}`,
    async load({ store, renderMarkdown, parseData }) {
      store.clear();
      for (const row of rows) {
        const { id, data, body } = map(row);
        const parsed = await parseData({ id, data });
        store.set({
          id,
          data: parsed,
          body,
          rendered: body ? await renderMarkdown(body) : undefined,
        });
      }
    },
  };
}

/**
 * Each page is stored whole and in two parts, split at its first "## "
 * heading, so a template can put its own sections between a page's opening
 * paragraphs and its later ones. The meetings page used to render the whole
 * body after a "Minutes" section, which put "the board meets on the third
 * Tuesday" under a heading about minutes.
 */
const splitAtFirstHeading = (body: string): [string, string] => {
  const at = body.search(/^## /m);
  return at === -1 ? [body, ""] : [body.slice(0, at), body.slice(at)];
};

const pages = defineCollection({
  loader: {
    name: "snapshot:pages",
    async load({ store, renderMarkdown, parseData }) {
      store.clear();
      for (const p of snapshot.pages) {
        const data = await parseData({
          id: p.slug,
          data: { title: p.body.title, summary: p.body.summary },
        });
        const [intro, rest] = splitAtFirstHeading(p.body.body);
        for (const [suffix, body] of [
          ["", p.body.body],
          ["--intro", intro],
          ["--rest", rest],
        ] as const)
          store.set({
            id: `${p.slug}${suffix}`,
            data,
            body,
            rendered: body ? await renderMarkdown(body) : undefined,
          });
      }
    },
  },
  schema: z.object({ title: z.string(), summary: z.string() }),
});

const news = defineCollection({
  loader: fromSnapshot("news", snapshot.news, (n) => ({
    id: n.slug,
    data: {
      title: n.body.title,
      date: n.publish_at,
      summary: n.body.summary,
      category: n.body.category,
      pinned: n.body.pinned,
    },
    body: n.body.body,
  })),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    category: z.string(),
    pinned: z.boolean(),
  }),
});

const events = defineCollection({
  loader: fromSnapshot("events", snapshot.events, (e) => ({
    id: e.slug,
    data: {
      title: e.body.title,
      start: e.body.start,
      end: e.body.end,
      summary: e.body.summary,
      location: e.body.location,
      cost: e.body.cost,
      audience: e.body.audience,
      contact_email_key: e.body.contact_email_key,
    },
    body: e.body.body,
  })),
  schema: z.object({
    title: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date(),
    summary: z.string(),
    location: z.string(),
    cost: z.string(),
    audience: z.string(),
    contact_email_key: z.string(),
  }),
});

const documents = defineCollection({
  loader: fromSnapshot("documents", snapshot.documents, (d) => ({
    id: d.slug,
    data: {
      title: d.body.title,
      date: d.publish_at,
      category: d.body.category,
      file: d.file_url,
      language: d.body.language,
      summary: d.body.summary,
      featured: d.body.featured,
    },
  })),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    file: z.string(),
    language: z.enum(["en", "es"]),
    summary: z.string(),
    featured: z.boolean(),
  }),
});

/**
 * Every meeting the board has on the books, with or without an agenda yet: the
 * schedule the site shows is these records, and each one needs a page for the
 * upcoming list to link to. Minutes are never here; they live in PayHOA.
 */
const meetings = defineCollection({
  loader: fromSnapshot("meetings", snapshot.meetings, (m) => ({
    id: m.id,
    data: {
      date: m.date,
      type: m.type,
      time: m.time,
      location: m.location,
      status: m.status,
      agenda: m.agenda?.items ?? [],
      notes: m.agenda?.notes ?? "",
      agenda_published: m.agenda_published_at,
    },
  })),
  schema: z.object({
    date: z.string(),
    type: z.enum(["board", "annual", "special", "pool-rec"]),
    time: z.string(),
    location: z.string(),
    status: z.enum(["scheduled", "canceled", "held"]),
    agenda: z.array(
      z.object({ id: z.string(), title: z.string(), detail: z.string() }),
    ),
    notes: z.string(),
    agenda_published: z.string().nullable(),
  }),
});

export const collections = { pages, news, events, documents, meetings };
