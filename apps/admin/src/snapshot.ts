import {
  ITEM_BODIES,
  PUBLIC_SETTINGS,
  type SiteSnapshot,
  isVisible,
  toPublicPerson,
} from "@dhoa/shared";
import type { z } from "zod";
import type { ItemRow } from "./routes/items.ts";
import { listCommittees, listPeople } from "./routes/roster.ts";
import { readSettings } from "./routes/settings.ts";

/**
 * Everything the public site needs, and nothing it must not see: only
 * published items inside their dates, only published agendas, never minutes.
 */
export async function buildSnapshot(
  db: D1Database,
  now: Date,
  fileUrl: (id: string, slug: string) => string,
): Promise<SiteSnapshot> {
  const [allSettings, people, committees, items, meetings, files] =
    await Promise.all([
      readSettings(db),
      listPeople(db),
      listCommittees(db),
      db
        .prepare(
          "select * from items where status = 'published' order by publish_at desc",
        )
        .all<ItemRow>(),
      db
        .prepare(
          `select m.id, m.type, m.date, m.time, m.location, m.status, a.published_at, v.body as agenda
           from meetings m
           left join agendas a on a.meeting_id = m.id and a.status = 'published'
           left join agenda_versions v on v.meeting_id = m.id and v.version = a.published_version
          order by m.date desc`,
        )
        .all<{
          id: string;
          type: "board" | "annual" | "special" | "pool-rec";
          date: string;
          time: string;
          location: string;
          status: "scheduled" | "canceled" | "held";
          published_at: string | null;
          agenda: string | null;
        }>(),
      db
        .prepare("select id, content_type from files")
        .all<{ id: string; content_type: string }>(),
    ]);
  const typeOf = new Map(files.results.map((f) => [f.id, f.content_type]));
  const visible = items.results.filter((r) => isVisible(r, now));
  const of = <K extends keyof typeof ITEM_BODIES>(kind: K) =>
    visible
      .filter((r) => r.kind === kind)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        publish_at: r.publish_at,
        updated_at: r.updated_at,
        body: ITEM_BODIES[kind].parse(JSON.parse(r.body)) as z.infer<
          (typeof ITEM_BODIES)[K]
        >,
      }));
  return {
    generated_at: now.toISOString(),
    // The board's own settings stay in the admin app; see PUBLIC_SETTINGS.
    settings: Object.fromEntries(
      Object.entries(allSettings).filter(([k]) =>
        Object.keys(PUBLIC_SETTINGS).includes(k),
      ),
    ) as SiteSnapshot["settings"],
    people: people.map(toPublicPerson),
    committees,
    news: of("news"),
    events: of("event"),
    documents: of("document").map((d) => ({
      ...d,
      file_url: d.body.file_id ? fileUrl(d.body.file_id, d.slug) : "",
      file_type: d.body.file_id ? (typeOf.get(d.body.file_id) ?? "") : "",
    })),
    pages: of("page"),
    meetings: meetings.results.map((m) => ({
      id: m.id,
      type: m.type,
      date: m.date,
      time: m.time,
      location: m.location,
      status: m.status,
      agenda: m.agenda ? JSON.parse(m.agenda) : null,
      agenda_published_at: m.published_at,
    })),
  };
}
