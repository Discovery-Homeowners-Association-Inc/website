import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "../access.ts";
import { auditStatement, nowIso } from "../db.ts";
import type { AppEnv } from "../types.ts";

export type FileRow = {
  id: string;
  name: string;
  content_type: string;
  size: number;
  sha256: string;
  uploaded_by: string | null;
  uploaded_at: string;
};

const ALLOWED = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);
/** KV values may be 25 MiB; keep uploads well under that and under a Worker's memory. */
const MAX_BYTES = 20 * 1024 * 1024;

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Uploaded files (PDF forms, images). Bytes go to KV; this table lists them. */
export function fileRoutes() {
  const app = new Hono<AppEnv>();

  // Same roles as uploading: the list carries every file's id, and an id is
  // all anyone needs to fetch the bytes.
  app.get("/", requireRole("admin", "secretary", "editor"), async (c) => {
    const { results } = await c.env.DB.prepare(
      'select f.*, u.name as uploaded_by_name from files f left join "user" u on u.id = f.uploaded_by order by f.uploaded_at desc',
    ).all();
    return c.json(results);
  });

  app.post("/", requireRole("admin", "secretary", "editor"), async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new HTTPException(400, { message: "Choose a file to upload." });
    const ext = ALLOWED.get(file.type);
    if (!ext)
      throw new HTTPException(415, {
        message: "Only PDF, JPEG and PNG files can be uploaded.",
      });
    if (file.size > MAX_BYTES)
      throw new HTTPException(413, {
        message:
          "That file is larger than 20 MB. Compress it or split it first.",
      });
    const bytes = await file.arrayBuffer();
    const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
    const id = sha256.slice(0, 32);
    const actor = c.get("user").id;
    const name =
      file.name.replace(/[^\w.() -]+/g, "_").slice(0, 200) || `file${ext}`;
    const existing = await c.env.DB.prepare("select * from files where id = ?")
      .bind(id)
      .first<FileRow>();
    if (existing) return c.json(existing);
    await c.env.FILES.put(id, bytes, {
      metadata: { name, content_type: file.type },
    });
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into files (id, name, content_type, size, sha256, uploaded_by, uploaded_at) values (?, ?, ?, ?, ?, ?, ?)",
      ).bind(id, name, file.type, file.size, sha256, actor, nowIso()),
      auditStatement(c.env.DB, actor, "upload", "file", id, {
        name,
        size: file.size,
      }),
    ]);
    return c.json(
      {
        id,
        name,
        content_type: file.type,
        size: file.size,
        sha256,
        uploaded_by: actor,
        uploaded_at: nowIso(),
      },
      201,
    );
  });

  app.delete("/:id", requireRole("admin", "secretary"), async (c) => {
    const id = c.req.param("id");
    const used = await c.env.DB.prepare(
      "select slug from items where kind = 'document' and json_extract(body, '$.file_id') = ?",
    )
      .bind(id)
      .first<{ slug: string }>();
    if (used)
      throw new HTTPException(409, {
        message: `That file is attached to the document "${used.slug}". Remove it there first.`,
      });
    await c.env.FILES.delete(id);
    await c.env.DB.batch([
      c.env.DB.prepare("delete from files where id = ?").bind(id),
      auditStatement(c.env.DB, c.get("user").id, "delete", "file", id),
    ]);
    return c.body(null, 204);
  });

  return app;
}

/**
 * Streams a stored file to the public, but only once a document that residents
 * can actually see points at it.
 *
 * Without the check, every byte ever uploaded was world-readable forever: a
 * draft's attachment, a scan uploaded and then thought better of, a form that
 * was later unpublished. The ids are content hashes rather than guessable, but
 * that was the only thing standing in the way, and the signed-in file list
 * hands them all out.
 *
 * The condition is `isVisible` in SQL -- published, published by now, not yet
 * expired -- so a file stops being public at the same moment its document does.
 */
export async function servePublicFile(env: Env, id: string): Promise<Response> {
  const now = new Date().toISOString();
  const shown = await env.DB.prepare(
    `select 1 from items
      where kind = 'document'
        and status = 'published'
        and publish_at <= ?
        and (expires_at is null or expires_at > ?)
        and json_extract(body, '$.file_id') = ?
      limit 1`,
  )
    .bind(now, now, id)
    .first();
  if (!shown) return new Response("Not found", { status: 404 });
  return serveFile(env, id);
}

/** Streams a stored file. Used by the signed-in preview and, guarded, the site. */
export async function serveFile(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    "select name, content_type, size from files where id = ?",
  )
    .bind(id)
    .first<{ name: string; content_type: string; size: number }>();
  if (!row) return new Response("Not found", { status: 404 });
  const body = await env.FILES.get(id, "stream");
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": row.content_type,
      "content-length": String(row.size),
      "content-disposition": `inline; filename="${row.name.replaceAll('"', "")}"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
