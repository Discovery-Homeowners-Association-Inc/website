import type { AppDeps } from "./app.ts";

/**
 * Runs once a day (see wrangler.jsonc triggers). Deletes items whose expiry
 * has passed and whose owner chose "delete" rather than "hide". Hidden items
 * simply stop appearing in the snapshot; nothing else changes.
 */
export async function runScheduled(
  env: Env,
  deps: Pick<AppDeps, "siteChanged">,
  now = new Date(),
): Promise<{ deleted: number }> {
  const { results } = await env.DB.prepare(
    "select id, kind, slug from items where expiry_action = 'delete' and expires_at is not null and expires_at <= ?",
  )
    .bind(now.toISOString())
    .all<{ id: string; kind: string; slug: string }>();
  if (results.length === 0) return { deleted: 0 };
  await env.DB.batch(
    results.flatMap((r) => [
      env.DB.prepare("delete from items where id = ?").bind(r.id),
      env.DB.prepare(
        "insert into audit_log (at, actor_id, action, entity, entity_id, detail) values (?, null, 'expire_delete', ?, ?, ?)",
      ).bind(now.toISOString(), r.kind, r.id, JSON.stringify({ slug: r.slug })),
    ]),
  );
  await deps.siteChanged(env, `${results.length} expired item(s) deleted`);
  return { deleted: results.length };
}
