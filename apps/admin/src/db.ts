import type { Grant } from "./types.ts";

export const nowIso = () => new Date().toISOString();

export async function grantsFor(
  db: D1Database,
  userId: string,
): Promise<Grant[]> {
  const { results } = await db
    .prepare("select role, scope from user_roles where user_id = ?")
    .bind(userId)
    .all<Grant>();
  return results;
}

/** A condition, as SQL that can sit inside `exists (...)`, with its bind values. */
export type Guard = { sql: string; binds: unknown[] };

/**
 * A statement that records one audit entry. Batch it with the change it
 * describes so both commit or neither does.
 *
 * With `onlyIf`, the row is written only where the guard holds -- the same
 * guard the change itself is conditional on. D1 runs a batch as one
 * transaction but rolls it back only on an error; a guarded update that
 * changes zero rows still commits everything beside it, and the log then
 * records something that did not happen.
 */
export function auditStatement(
  db: D1Database,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  detail?: unknown,
  onlyIf?: Guard,
) {
  const values = [
    nowIso(),
    actorId,
    action,
    entity,
    entityId,
    detail === undefined ? null : JSON.stringify(detail),
  ];
  if (!onlyIf)
    return db
      .prepare(
        "insert into audit_log (at, actor_id, action, entity, entity_id, detail) values (?, ?, ?, ?, ?, ?)",
      )
      .bind(...values);
  return db
    .prepare(
      `insert into audit_log (at, actor_id, action, entity, entity_id, detail) select ?, ?, ?, ?, ?, ? where exists (${onlyIf.sql})`,
    )
    .bind(...values, ...onlyIf.binds);
}

export const isConstraintError = (e: unknown) =>
  /UNIQUE constraint failed|PRIMARY KEY/i.test(String(e));
