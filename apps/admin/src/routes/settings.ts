import {
  Approvals,
  SETTINGS,
  SETTINGS_KEYS,
  type Settings,
  type SettingsKey,
} from "@dhoa/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "../access.ts";
import { auditStatement, nowIso } from "../db.ts";
import { reconcileMeetings } from "../meetings-schedule.ts";
import type { AppEnv } from "../types.ts";
import type { AppDeps } from "../app.ts";

const isKey = (k: string): k is SettingsKey =>
  (SETTINGS_KEYS as string[]).includes(k);

export async function readSettings(db: D1Database): Promise<Settings> {
  const { results } = await db
    .prepare("select key, value from settings")
    .all<{ key: string; value: string }>();
  const out: Record<string, unknown> = {};
  for (const r of results)
    if (isKey(r.key)) out[r.key] = SETTINGS[r.key].parse(JSON.parse(r.value));
  const missing = SETTINGS_KEYS.filter((k) => !(k in out));
  if (missing.length)
    throw new HTTPException(500, {
      message: `Settings are missing: ${missing.join(", ")}. Run the seed.`,
    });
  return out as Settings;
}

/** One group, parsed. Throws 500 with the seed hint when the row is missing. */
export async function readSetting<K extends SettingsKey>(
  db: D1Database,
  key: K,
): Promise<Settings[K]> {
  const row = await db
    .prepare("select value from settings where key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row)
    throw new HTTPException(500, {
      message: `Settings are missing: ${key}. Run the seed.`,
    });
  return SETTINGS[key].parse(JSON.parse(row.value)) as Settings[K];
}

export async function approvalsSetting(db: D1Database) {
  try {
    return await readSetting(db, "approvals");
  } catch (e) {
    if (e instanceof HTTPException && e.status === 500)
      return Approvals.parse({});
    throw e;
  }
}

export function settingsRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.get("/", async (c) => c.json(await readSettings(c.env.DB)));
  app.get("/:key", async (c) => {
    const key = c.req.param("key");
    if (!isKey(key))
      throw new HTTPException(404, { message: "No such settings group." });
    return c.json(await readSetting(c.env.DB, key));
  });
  app.put("/:key", requireRole("admin"), async (c) => {
    const key = c.req.param("key");
    if (!isKey(key))
      throw new HTTPException(404, { message: "No such settings group." });
    const value = SETTINGS[key].parse(await c.req.json());
    const actor = c.get("user").id;
    let previous: Settings[SettingsKey] | undefined;
    try {
      previous = await readSetting(c.env.DB, key);
    } catch {
      previous = undefined;
    }
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into settings (key, value, updated_by, updated_at) values (?, ?, ?, ?) on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
      ).bind(key, JSON.stringify(value), actor, nowIso()),
      auditStatement(c.env.DB, actor, "update", "settings", key),
    ]);
    if (key === "organization") {
      const before = (previous as Settings["organization"] | undefined)
        ?.meetings.board;
      const after = (value as Settings["organization"]).meetings.board;
      if (
        !before ||
        before.ordinal !== after.ordinal ||
        before.weekday !== after.weekday ||
        before.time !== after.time ||
        before.location !== after.location
      )
        await reconcileMeetings(c.env.DB);
    }
    if (key !== "approvals") await deps.siteChanged(c.env, `settings ${key}`);
    return c.json(value);
  });
  return app;
}
