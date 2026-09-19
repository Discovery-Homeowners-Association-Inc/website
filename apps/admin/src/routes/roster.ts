import { Committee, Person } from "@dhoa/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { hasRole, requireRole } from "../access.ts";
import { auditStatement, nowIso, type Guard } from "../db.ts";
import { readJson } from "../inputs.ts";
import type { AppEnv } from "../types.ts";
import type { AppDeps } from "../app.ts";

type PersonRow = {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
};
const expandPerson = (r: PersonRow) => ({
  id: r.id,
  ...Person.parse(JSON.parse(r.data)),
  updated_at: r.updated_at,
});

export async function listPeople(db: D1Database) {
  const { results } = await db.prepare("select * from people").all<PersonRow>();
  return results
    .map(expandPerson)
    .toSorted((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function listCommittees(db: D1Database) {
  const { results } = await db
    .prepare("select data from committees")
    .all<{ data: string }>();
  return results
    .map((r) => Committee.parse(JSON.parse(r.data)))
    .toSorted((a, b) => a.order - b.order);
}

/** The roster: directors and committee members. Editing is for admins and the secretary. */
export function rosterRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  /*
   * Everyone signed in needs the names -- minutes take attendance from this
   * list. Nobody but the people who can edit the roster needs a director's
   * phone number, or the address of one who chose not to publish theirs.
   *
   * `toPublicPerson` already draws that line for the website; this draws the
   * same one for the admin app, rather than handing an editor who writes news
   * posts the private contact details of the whole board.
   */
  app.get("/people", async (c) => {
    const people = await listPeople(c.env.DB);
    if (hasRole(c.get("user").grants, "admin", "secretary"))
      return c.json(people);
    return c.json(
      people.map((p) => ({
        ...p,
        phone: "",
        email: p.show_email ? p.email : "",
      })),
    );
  });
  app.get("/committees", async (c) => c.json(await listCommittees(c.env.DB)));

  app.post("/people", requireRole("admin", "secretary"), async (c) => {
    const person = Person.parse(await readJson(c));
    const id = crypto.randomUUID();
    const actor = c.get("user").id;
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into people (id, data, created_at, updated_at) values (?, ?, ?, ?)",
      ).bind(id, JSON.stringify(person), nowIso(), nowIso()),
      auditStatement(c.env.DB, actor, "create", "person", id, {
        name: person.name,
      }),
    ]);
    await deps.siteChanged(c.env, "roster");
    return c.json({ id, ...person }, 201);
  });

  app.put("/people/:id", requireRole("admin", "secretary"), async (c) => {
    const id = c.req.param("id");
    const person = Person.parse(await readJson(c));
    const actor = c.get("user").id;
    const exists: Guard = {
      sql: "select 1 from people where id = ?",
      binds: [id],
    };
    const r = await c.env.DB.batch([
      auditStatement(
        c.env.DB,
        actor,
        "update",
        "person",
        id,
        { name: person.name },
        exists,
      ),
      c.env.DB.prepare(
        "update people set data = ?, updated_at = ? where id = ?",
      ).bind(JSON.stringify(person), nowIso(), id),
    ]);
    if (r[1]?.meta.changes !== 1)
      throw new HTTPException(404, {
        message: "That person is not on the roster.",
      });
    await deps.siteChanged(c.env, "roster");
    return c.json({ id, ...person });
  });

  /**
   * Nobody is deleted from the roster. Ending a term keeps the record, so
   * past minutes and the history of who served stay intact.
   */
  app.delete("/people/:id", requireRole("admin"), async (c) => {
    const id = c.req.param("id");
    const row = await c.env.DB.prepare("select data from people where id = ?")
      .bind(id)
      .first<{ data: string }>();
    if (!row)
      throw new HTTPException(404, {
        message: "That person is not on the roster.",
      });
    const person = Person.parse(JSON.parse(row.data));
    if (!person.term_end)
      throw new HTTPException(409, {
        message:
          "End their term first (set a term end date). The record is kept for history.",
      });
    throw new HTTPException(409, {
      message:
        "Roster records are kept for history and cannot be deleted. Their term has ended, so they no longer appear as serving.",
    });
  });

  app.put("/committees/:slug", requireRole("admin", "secretary"), async (c) => {
    const slug = c.req.param("slug");
    const committee = Committee.parse({
      ...((await readJson(c)) as Record<string, unknown>),
      slug,
    });
    const actor = c.get("user").id;
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into committees (slug, data, updated_at) values (?, ?, ?) on conflict (slug) do update set data = excluded.data, updated_at = excluded.updated_at",
      ).bind(slug, JSON.stringify(committee), nowIso()),
      auditStatement(c.env.DB, actor, "update", "committee", slug),
    ]);
    await deps.siteChanged(c.env, "committees");
    return c.json(committee);
  });

  return app;
}
