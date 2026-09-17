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

/** A statement that records one audit entry. Batch it with the change it describes so both commit or neither does. */
export function auditStatement(
  db: D1Database,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  detail?: unknown,
) {
  return db
    .prepare(
      "insert into audit_log (at, actor_id, action, entity, entity_id, detail) values (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      nowIso(),
      actorId,
      action,
      entity,
      entityId,
      detail === undefined ? null : JSON.stringify(detail),
    );
}

export const isConstraintError = (e: unknown) =>
  /UNIQUE constraint failed|PRIMARY KEY/i.test(String(e));
