/**
 * Turns seed/*.json into SQL and KV puts so the first database can be filled
 * locally or remotely:
 *   node scripts/seed.ts            -> writes seed/seed.sql, seed/settings.sql
 *                                      and seed/kv.sh
 *   just seed-local                 -> applies both to the local dev database
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ITEM_BODIES,
  Committee,
  Person,
  SETTINGS,
  slugify,
} from "@dhoa/shared";

const dir = new URL("../seed/", import.meta.url).pathname;
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const q = (v: unknown) => `'${String(v).replaceAll("'", "''")}'`;
const now = new Date().toISOString();

/*
 * Ids are derived from whatever identifies the row, never generated, so that
 * applying the seed twice is the no-op `insert or ignore` promises. Items and
 * committees are keyed on a slug, and people on their name; a fresh uuid meant
 * a second run duplicated the whole board, which docs/RUNBOOK-admin.md tells
 * you to do against production. scripts/check-seed-stable.sh holds this.
 */
const stableId = (...parts: string[]) =>
  createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
const lines: string[] = [];
const kv: string[] = [
  "#!/usr/bin/env bash",
  "set -euo pipefail",
  'cd "$(dirname "$0")/.."',
];

// Files first, so documents can point at them.
const fileIds = new Map<string, string>();
for (const name of readdirSync(join(dir, "files"))) {
  const bytes = readFileSync(join(dir, "files", name));
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  fileIds.set(name, id);
  lines.push(
    `insert or replace into files (id, name, content_type, size, sha256, uploaded_at) values (${q(id)}, ${q(name)}, 'application/pdf', ${bytes.length}, ${q(createHash("sha256").update(bytes).digest("hex"))}, ${q(now)});`,
  );
  kv.push(
    `pnpm exec wrangler kv key put --binding FILES "$@" ${q(id)} --path ${q(join("seed/files", name))}`,
  );
}

for (const raw of read("items.json")) {
  const kind = raw.kind as keyof typeof ITEM_BODIES;
  if (kind === "document") {
    raw.body.file_id = fileIds.get(raw.file) ?? "";
  }
  const body = ITEM_BODIES[kind].parse(raw.body);
  const slug = raw.slug ?? slugify(body.title);
  const id = stableId("item", kind, slug);
  lines.push(
    `insert or ignore into items (id, kind, slug, status, body, publish_at, created_at, updated_at) values (${q(id)}, ${q(kind)}, ${q(slug)}, 'published', ${q(JSON.stringify(body))}, ${q(raw.publish_at)}, ${q(now)}, ${q(now)});`,
  );
}

/*
 * Settings are written twice: into the whole seed, and into a file of their
 * own that the deploy applies on every push.
 *
 * A settings group added in code is a row the database does not have, and
 * `readSettings` refuses to answer without it -- which takes out the public
 * snapshot, and with it every site build. That is what happened when
 * `agenda-templates` arrived: the deploy applied the migrations, nothing
 * created the row, and the site quietly stopped updating.
 *
 * `insert or ignore`, so this can only ever add the ones that are missing. A
 * value the board has edited is never touched.
 */
const settings = read("settings.json");
const settingsSql: string[] = [];
for (const [key, schema] of Object.entries(SETTINGS)) {
  const value = schema.parse(settings[key]);
  settingsSql.push(
    `insert or ignore into settings (key, value, updated_at) values (${q(key)}, ${q(JSON.stringify(value))}, ${q(now)});`,
  );
}
lines.push(...settingsSql);

const seenNames = new Set<string>();
for (const raw of read("people.json")) {
  const person = Person.parse(raw);
  // The id is the name, so two people sharing one would silently become one
  // row. Fail here rather than lose a director.
  if (seenNames.has(person.name))
    throw new Error(
      `people.json has two entries named ${person.name}; ids are derived from the name`,
    );
  seenNames.add(person.name);
  lines.push(
    `insert or ignore into people (id, data, created_at, updated_at) values (${q(stableId("person", person.name))}, ${q(JSON.stringify(person))}, ${q(now)}, ${q(now)});`,
  );
}
for (const raw of read("committees.json")) {
  const c = Committee.parse(raw);
  lines.push(
    `insert or ignore into committees (slug, data, updated_at) values (${q(c.slug)}, ${q(JSON.stringify(c))}, ${q(now)});`,
  );
}

writeFileSync(join(dir, "seed.sql"), lines.join("\n") + "\n");
writeFileSync(join(dir, "settings.sql"), settingsSql.join("\n") + "\n");
writeFileSync(join(dir, "kv.sh"), kv.join("\n") + "\n", { mode: 0o755 });
console.log(
  `wrote ${lines.length} statements and ${fileIds.size} file uploads`,
);
