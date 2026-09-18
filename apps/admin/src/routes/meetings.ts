import { AgendaBody } from "@dhoa/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireRole } from "../access.ts";
import { auditStatement, isConstraintError, nowIso } from "../db.ts";
import type { AppEnv } from "../types.ts";

const MeetingInput = z.object({
  type: z.enum(["board", "annual", "special", "pool-rec"]),
  date: z.iso.date(),
  time: z
    .string()
    .trim()
    .regex(/^\d{1,2}:\d{2} (am|pm)$/, "Use a time like 7:00 pm"),
  location: z.string().trim().min(1).max(200),
});

/*
 * The date is editable, which is how a meeting is moved. The id keeps the date
 * the schedule originally gave it, so the scheduler still recognizes the slot as
 * filled and does not put the old date back on the calendar.
 */
const MeetingPatch = MeetingInput.pick({
  date: true,
  time: true,
  location: true,
})
  .partial()
  .extend({ status: z.enum(["scheduled", "cancelled", "held"]).optional() });

export async function meetingOr404(db: D1Database, id: string) {
  const m = await db
    .prepare("select * from meetings where id = ?")
    .bind(id)
    .first<{
      id: string;
      type: string;
      date: string;
      time: string;
      location: string;
      status: string;
    }>();
  if (!m)
    throw new HTTPException(404, { message: "That meeting does not exist." });
  return m;
}

export function meetingRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const { results } = await c.env.DB.prepare(
      `select m.*, a.status as agenda_status, a.current_version as agenda_version, a.published_version as agenda_published_version,
              mi.status as minutes_status
         from meetings m left join agendas a on a.meeting_id = m.id left join minutes mi on mi.meeting_id = m.id
        order by m.date desc`,
    ).all();
    return c.json(results);
  });

  app.post("/", requireRole("secretary", "admin"), async (c) => {
    const input = MeetingInput.parse(await c.req.json());
    const id = `${input.date}-${input.type}`;
    const actor = c.get("user").id;
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "insert into meetings (id, type, date, time, location, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          id,
          input.type,
          input.date,
          input.time,
          input.location,
          actor,
          nowIso(),
        ),
        auditStatement(c.env.DB, actor, "create", "meeting", id, input),
      ]);
    } catch (e) {
      if (isConstraintError(e))
        throw new HTTPException(409, {
          message: "There is already a meeting of that type on that date.",
        });
      throw e;
    }
    return c.json({ id, ...input, status: "scheduled" }, 201);
  });

  app.patch("/:id", requireRole("secretary", "admin"), async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const patch = MeetingPatch.parse(await c.req.json());
    const next = { ...m, ...patch };
    await c.env.DB.batch([
      c.env.DB.prepare(
        "update meetings set date = ?, time = ?, location = ?, status = ? where id = ?",
      ).bind(next.date, next.time, next.location, next.status, m.id),
      auditStatement(
        c.env.DB,
        c.get("user").id,
        "update",
        "meeting",
        m.id,
        patch,
      ),
    ]);
    return c.json(next);
  });

  app.get("/:id/agenda", async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const agenda = await c.env.DB.prepare(
      "select * from agendas where meeting_id = ?",
    )
      .bind(m.id)
      .first<{ current_version: number }>();
    const current = agenda
      ? await c.env.DB.prepare(
          "select version, body, created_at from agenda_versions where meeting_id = ? and version = ?",
        )
          .bind(m.id, agenda.current_version)
          .first<{ version: number; body: string; created_at: string }>()
      : null;
    return c.json({
      meeting: m,
      agenda,
      current: current && { ...current, body: JSON.parse(current.body) },
    });
  });

  /** Save the agenda as a new version. `base_version` must match, so two people cannot overwrite each other. */
  app.put("/:id/agenda", requireRole("secretary", "admin"), async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const input = z
      .object({ base_version: z.number().int().min(0), body: AgendaBody })
      .parse(await c.req.json());
    const actor = c.get("user").id;
    const agenda = await c.env.DB.prepare(
      "select current_version from agendas where meeting_id = ?",
    )
      .bind(m.id)
      .first<{ current_version: number }>();
    const current = agenda?.current_version ?? 0;
    if (input.base_version !== current)
      throw new HTTPException(409, {
        message: "Someone else saved this agenda. Reload to see their changes.",
      });
    const version = current + 1;
    // D1 runs a batch as one transaction. If someone else saved first, the
    // version row already exists, the primary key rejects it, and nothing commits.
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "insert into agenda_versions (meeting_id, version, body, author_id, created_at) values (?, ?, ?, ?, ?)",
        ).bind(m.id, version, JSON.stringify(input.body), actor, nowIso()),
        c.env.DB.prepare(
          "insert into agendas (meeting_id, current_version) values (?, ?) on conflict (meeting_id) do update set current_version = excluded.current_version",
        ).bind(m.id, version),
        auditStatement(c.env.DB, actor, "save", "agenda", m.id, { version }),
      ]);
    } catch (e) {
      if (isConstraintError(e))
        throw new HTTPException(409, {
          message:
            "Someone else saved this agenda. Reload to see their changes.",
        });
      throw e;
    }
    return c.json({ version });
  });

  /** Mark the current agenda version as published. Updating the public site from it is a separate step. */
  app.post(
    "/:id/agenda/publish",
    requireRole("secretary", "admin"),
    async (c) => {
      const m = await meetingOr404(c.env.DB, c.req.param("id"));
      const agenda = await c.env.DB.prepare(
        "select current_version from agendas where meeting_id = ?",
      )
        .bind(m.id)
        .first<{ current_version: number }>();
      if (!agenda || agenda.current_version === 0)
        throw new HTTPException(422, {
          message: "Write the agenda before publishing it.",
        });
      const actor = c.get("user").id;
      await c.env.DB.batch([
        c.env.DB.prepare(
          "update agendas set status = 'published', published_version = current_version, published_at = ?, published_by = ? where meeting_id = ?",
        ).bind(nowIso(), actor, m.id),
        auditStatement(c.env.DB, actor, "publish", "agenda", m.id, {
          version: agenda.current_version,
        }),
      ]);
      return c.json({ published_version: agenda.current_version });
    },
  );

  return app;
}
