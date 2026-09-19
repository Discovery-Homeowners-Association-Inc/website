/**
 * Everything the public site needs, in one document. The admin API serves it
 * at /api/public/site.json; `just snapshot` saves it into the site repo.
 */
import { z } from "zod";
import { AgendaBody } from "./documents.ts";
import {
  Committee,
  DocumentBody,
  EventBody,
  NewsBody,
  PageBody,
  PublicPerson,
} from "./content.ts";
import { PUBLIC_SETTINGS } from "./settings.ts";

const meta = {
  id: z.string(),
  slug: z.string(),
  publish_at: z.string(),
  updated_at: z.string(),
};

export const SiteSnapshot = z.object({
  generated_at: z.iso.datetime(),
  settings: z.object(PUBLIC_SETTINGS),
  people: z.array(PublicPerson),
  committees: z.array(Committee),
  news: z.array(z.object({ ...meta, body: NewsBody })),
  events: z.array(z.object({ ...meta, body: EventBody })),
  documents: z.array(
    z.object({
      ...meta,
      body: DocumentBody,
      file_url: z.string().default(""),
      file_type: z.string().default(""),
    }),
  ),
  pages: z.array(z.object({ ...meta, body: PageBody })),
  meetings: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["board", "annual", "special", "pool-rec"]),
      date: z.iso.date(),
      time: z.string(),
      location: z.string(),
      status: z.enum(["scheduled", "canceled", "held"]),
      agenda: AgendaBody.nullable(),
      agenda_published_at: z.string().nullable(),
    }),
  ),
});
export type SiteSnapshot = z.infer<typeof SiteSnapshot>;
