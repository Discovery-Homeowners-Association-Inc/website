import {
  ITEM_AFTER,
  ITEM_BODIES,
  ITEM_KINDS,
  ItemMeta,
  ROLES,
  type ItemAction,
  type ItemKind,
  type ItemState,
  type Role,
  itemActions,
  slugify,
} from "@dhoa/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { hasRole, requireRole } from "../access.ts";
import { auditStatement, isConstraintError, nowIso } from "../db.ts";
import { approvalsSetting } from "./settings.ts";
import type { AppEnv } from "../types.ts";
import type { AppDeps } from "../app.ts";

export type ItemRow = {
  id: string;
  kind: ItemKind;
  slug: string;
  status: ItemState;
  body: string;
  publish_at: string;
  expires_at: string | null;
  expiry_action: "hide" | "delete";
  author_id: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  review_note: string;
  created_at: string;
  updated_at: string;
};

const Kind = z.enum(ITEM_KINDS);
/*
 * The roles a person holds across the whole site, as opposed to one committee.
 * Read from the database, so checked rather than asserted: a row naming a role
 * this build does not have is dropped, not believed.
 */
const rolesOf = (grants: { role: string; scope: string }[]): Role[] =>
  grants
    .filter((g) => g.scope === "")
    .map((g) => g.role)
    .filter((role): role is Role =>
      (ROLES as readonly string[]).includes(role),
    );
const expand = (r: ItemRow) => ({ ...r, body: JSON.parse(r.body) });

export async function itemOr404(db: D1Database, id: string) {
  const row = await db
    .prepare("select * from items where id = ?")
    .bind(id)
    .first<ItemRow>();
  if (!row)
    throw new HTTPException(404, {
      message: "That item does not exist. It may have been deleted.",
    });
  return row;
}

export function itemRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  /** Everyone signed in can see the list; the status column shows what is live. */
  app.get("/", async (c) => {
    const kind = Kind.parse(c.req.query("kind"));
    const { results } = await c.env.DB.prepare(
      `select i.*, u.name as author from items i left join "user" u on u.id = i.author_id where i.kind = ? order by i.publish_at desc`,
    )
      .bind(kind)
      .all<ItemRow & { author: string | null }>();
    return c.json(results.map(expand));
  });

  app.get("/:id", async (c) =>
    c.json(expand(await itemOr404(c.env.DB, c.req.param("id")))),
  );

  app.post("/", requireRole("admin", "secretary", "editor"), async (c) => {
    const raw = await c.req.json();
    const kind = Kind.parse(raw.kind);
    const body = ITEM_BODIES[kind].parse(raw.body);
    const meta = ItemMeta.parse({ publish_at: nowIso(), ...raw.meta });
    const actor = c.get("user").id;
    const id = crypto.randomUUID();
    const wanted = slugify(
      typeof raw.slug === "string" && raw.slug ? raw.slug : body.title,
    );
    /*
     * Keep slugs unique per kind by appending a counter. Every candidate that
     * could collide is read once, rather than one query per attempt: this ran
     * inside the loop, so a popular title cost a round trip per try, in a
     * Worker with 10 ms of CPU. It also stopped at 49 having never checked the
     * name it settled on, so the insert, not the loop, would have reported the
     * collision.
     */
    const { results: existing } = await c.env.DB.prepare(
      "select slug from items where kind = ? and (slug = ? or slug like ?)",
    )
      .bind(kind, wanted, `${wanted}-%`)
      .all<{ slug: string }>();
    const taken = new Set(existing.map((r) => r.slug));
    let slug = wanted;
    for (let n = 2; taken.has(slug); n++) slug = `${wanted}-${n}`;
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into items (id, kind, slug, status, body, publish_at, expires_at, expiry_action, author_id, created_at, updated_at) values (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        id,
        kind,
        slug,
        JSON.stringify(body),
        meta.publish_at,
        meta.expires_at,
        meta.expiry_action,
        actor,
        nowIso(),
        nowIso(),
      ),
      auditStatement(c.env.DB, actor, "create", kind, id, { slug }),
    ]);
    return c.json(expand(await itemOr404(c.env.DB, id)), 201);
  });

  /** Editors change their own drafts and pending items; admins and secretaries change anything. */
  app.put("/:id", requireRole("admin", "secretary", "editor"), async (c) => {
    const row = await itemOr404(c.env.DB, c.req.param("id"));
    const user = c.get("user");
    const staff = hasRole(user.grants, "admin", "secretary");
    if (!staff && (row.author_id !== user.id || row.status === "published")) {
      throw new HTTPException(403, {
        message:
          "You can change only your own items, and only before they are published.",
      });
    }
    const raw = await c.req.json();
    const body = ITEM_BODIES[row.kind].parse(raw.body ?? JSON.parse(row.body));
    const meta = ItemMeta.parse({
      publish_at: row.publish_at,
      expires_at: row.expires_at,
      expiry_action: row.expiry_action,
      ...raw.meta,
    });
    const slug =
      typeof raw.slug === "string" && raw.slug && staff
        ? slugify(raw.slug)
        : row.slug;
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "update items set body = ?, publish_at = ?, expires_at = ?, expiry_action = ?, slug = ?, updated_at = ? where id = ?",
        ).bind(
          JSON.stringify(body),
          meta.publish_at,
          meta.expires_at,
          meta.expiry_action,
          slug,
          nowIso(),
          row.id,
        ),
        auditStatement(c.env.DB, user.id, "update", row.kind, row.id),
      ]);
    } catch (e) {
      if (isConstraintError(e))
        throw new HTTPException(409, {
          message:
            "Another item of this kind already uses that web address (slug).",
        });
      throw e;
    }
    if (row.status === "published")
      await deps.siteChanged(c.env, `${row.kind} ${slug} updated`);
    return c.json(expand(await itemOr404(c.env.DB, row.id)));
  });

  /** Submit, approve, reject, publish or unpublish. The rules live in @dhoa/shared. */
  app.post("/:id/action", async (c) => {
    const row = await itemOr404(c.env.DB, c.req.param("id"));
    const { action, note } = z
      .object({
        action: z.enum(["submit", "approve", "reject", "publish", "unpublish"]),
        note: z.string().trim().max(500).default(""),
      })
      .parse(await c.req.json());
    const user = c.get("user");
    const requiresApproval = (await approvalsSetting(c.env.DB))[row.kind];
    const allowed = itemActions({
      status: row.status,
      roles: rolesOf(user.grants),
      isAuthor: row.author_id === user.id || row.submitted_by === user.id,
      requiresApproval,
    });
    if (!allowed.includes(action)) {
      throw new HTTPException(409, {
        message: explain(action, row.status, requiresApproval),
      });
    }
    if (action === "reject" && !note)
      throw new HTTPException(422, {
        message: "Say what needs to change so the author knows.",
      });
    const next = ITEM_AFTER[action];
    const sets: Record<ItemAction, string> = {
      submit: "submitted_by = ?, submitted_at = ?, review_note = ''",
      approve: "approved_by = ?, approved_at = ?, review_note = ''",
      reject:
        "approved_by = null, approved_at = null, review_note = ?, submitted_by = null, submitted_at = ?",
      publish: "approved_by = ?, approved_at = ?, review_note = ''",
      unpublish:
        "approved_by = null, approved_at = null, review_note = ?, submitted_by = null, submitted_at = ?",
    };
    const binds: Record<ItemAction, unknown[]> = {
      submit: [user.id, nowIso()],
      approve: [user.id, nowIso()],
      reject: [note, null],
      publish: [user.id, nowIso()],
      unpublish: [note, null],
    };
    await c.env.DB.batch([
      c.env.DB.prepare(
        `update items set status = ?, ${sets[action]}, updated_at = ? where id = ? and status = ?`,
      ).bind(next, ...binds[action], nowIso(), row.id, row.status),
      auditStatement(c.env.DB, user.id, action, row.kind, row.id, {
        from: row.status,
        to: next,
        note,
      }),
    ]);
    if (next === "published" || row.status === "published")
      await deps.siteChanged(c.env, `${row.kind} ${row.slug} ${action}`);
    return c.json(expand(await itemOr404(c.env.DB, row.id)));
  });

  app.delete("/:id", requireRole("admin", "secretary", "editor"), async (c) => {
    const row = await itemOr404(c.env.DB, c.req.param("id"));
    const user = c.get("user");
    if (
      !hasRole(user.grants, "admin", "secretary") &&
      !(row.author_id === user.id && row.status === "draft")
    ) {
      throw new HTTPException(403, {
        message: "You can delete only your own drafts.",
      });
    }
    await c.env.DB.batch([
      c.env.DB.prepare("delete from items where id = ?").bind(row.id),
      auditStatement(c.env.DB, user.id, "delete", row.kind, row.id, {
        slug: row.slug,
        status: row.status,
      }),
    ]);
    if (row.status === "published")
      await deps.siteChanged(c.env, `${row.kind} ${row.slug} deleted`);
    return c.body(null, 204);
  });

  return app;
}

function explain(
  action: ItemAction,
  status: ItemState,
  requiresApproval: boolean,
): string {
  if (action === "approve" || action === "reject") {
    if (status !== "pending") return "This item is not waiting for approval.";
    return "You cannot approve something you submitted yourself. Ask another board member.";
  }
  if (action === "publish" && requiresApproval)
    return "This kind of item needs a second person's approval. Submit it for approval instead.";
  if (action === "publish" && status !== "draft")
    return "Only drafts can be published.";
  if (action === "submit")
    return status === "draft"
      ? "You do not have permission to submit items."
      : "This item has already been submitted.";
  return "That action is not available right now.";
}
