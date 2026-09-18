import { ExportRecord } from "@dhoa/shared";
import { Hono } from "hono";
import { z } from "zod";
import { requireRole } from "../access.ts";
import { auditStatement, nowIso } from "../db.ts";
import type { AppEnv } from "../types.ts";

/** One page. Older entries are reached with `before`, not by raising this. */
const PAGE = 200;

type Row = {
  id: number;
  at: string;
  actor_id: string | null;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string;
  detail: string | null;
};

export function auditRoutes() {
  const app = new Hono<AppEnv>();

  /**
   * The log says who did what. It names people, so only administrators read
   * it -- the same people who can already see the accounts it names.
   */
  app.get("/", requireRole("admin"), async (c) => {
    const limit = Math.min(
      PAGE,
      z.coerce.number().int().min(1).catch(PAGE).parse(c.req.query("limit")),
    );
    /*
     * Paged backwards from an id rather than capped at a fixed depth. A fixed
     * cap made everything older than the newest N rows unreachable through the
     * API at all, which is a poor property for the record of who did what:
     * anyone could push an entry out of sight by writing N of their own.
     */
    const before = z.coerce
      .number()
      .int()
      .min(1)
      .catch(0)
      .parse(c.req.query("before"));
    const { results } = await c.env.DB.prepare(
      `select a.id, a.at, a.actor_id, u.name as actor, a.action, a.entity,
              a.entity_id, a.detail
         from audit_log a left join "user" u on u.id = a.actor_id
        where ? = 0 or a.id < ?
        order by a.id desc
        limit ?`,
    )
      .bind(before, before, limit)
      .all<Row>();
    // `detail` goes out as the JSON text it is stored as, rather than parsed
    // here. Parsing two thousand of them is work this Worker has 10 ms to do,
    // and the only caller is a browser that is about to parse the response
    // anyway. See DECISIONS #7: CPU-heavy work belongs in the browser.
    return c.json(results);
  });

  /**
   * Records that someone took a copy of the association's data.
   *
   * The export itself is assembled in the browser, from endpoints that each
   * enforce their own roles, so there is nothing for the server to authorize
   * here beyond being signed in -- and nothing it could usefully refuse, since
   * the person already has the data by the time this is called. What it is for
   * is the log: an export is the one action that takes everything at once, and
   * this is what makes that visible afterwards.
   *
   * The action name is the server's, not the caller's. Only what was taken
   * comes from the request, and that is validated.
   */
  app.post("/export", async (c) => {
    const body = ExportRecord.parse(await c.req.json());
    const at = nowIso();
    await auditStatement(
      c.env.DB,
      c.get("user").id,
      "export",
      "export",
      at,
      body,
    ).run();
    return c.json({ at }, 201);
  });

  return app;
}
