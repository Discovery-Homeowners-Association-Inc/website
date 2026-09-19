/**
 * Turns seed/*.json into SQL and KV puts so the first database can be filled
 * locally or remotely:
 *   node scripts/seed.ts            -> writes seed/seed.sql, seed/settings.sql
 *                                      and seed/kv.sh. settings.sql is what
 *                                      the deploy applies on every push: the
 *                                      settings and page copy a database does
 *                                      not have yet, and nothing else.
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

const pagesSql: string[] = [];
for (const raw of read("items.json")) {
  const kind = raw.kind as keyof typeof ITEM_BODIES;
  if (kind === "document") {
    raw.body.file_id = fileIds.get(raw.file) ?? "";
  }
  const body = ITEM_BODIES[kind].parse(raw.body);
  const slug = raw.slug ?? slugify(body.title);
  const id = stableId("item", kind, slug);
  const json = q(JSON.stringify(body));
  lines.push(
    `insert or ignore into items (id, kind, slug, status, body, publish_at, created_at, updated_at) values (${q(id)}, ${q(kind)}, ${q(slug)}, 'published', ${json}, ${q(raw.publish_at)}, ${q(now)}, ${q(now)});`,
  );
  /*
   * Page copy that nobody has edited follows the repository.
   *
   * The pages are written here and seeded; once a person edits one in the
   * admin app it is theirs and this never touches it again -- which is what
   * `updated_at = created_at` tests, since the seed writes both the same. It
   * exists because a correction in the repository otherwise never reaches the
   * site: `insert or ignore` skips the row, so the live committees page went
   * on saying "Three standing committees" above a list of five.
   *
   * Only pages. News, events and documents are the board's own writing from
   * the first word, so nothing here should ever overwrite one.
   */
  if (kind === "page")
    pagesSql.push(
      `update items set body = ${json}, updated_at = ${q(now)} where kind = 'page' and slug = ${q(slug)} and updated_at = created_at and body <> ${json};`,
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
  const json = q(JSON.stringify(value));
  // A group the database does not have at all.
  settingsSql.push(
    `insert or ignore into settings (key, value, updated_at) values (${q(key)}, ${json}, ${q(now)});`,
  );
  /*
   * A field the group does not have yet. `json_patch(seed, current)` takes the
   * seeded object as the base and lets the stored one override it, so every
   * value the board has edited survives and only keys they have never seen are
   * added. Creating the row was not enough on its own: `parks` already existed
   * when `places` was added to it, so the row was left alone and the map on
   * the live site had no markers to draw.
   */
  settingsSql.push(
    `update settings set value = json_patch(json(${json}), value), updated_at = ${q(now)} where key = ${q(key)} and json_patch(json(${json}), value) <> value;`,
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
writeFileSync(
  join(dir, "settings.sql"),
  [...settingsSql, ...pagesSql].join("\n") + "\n",
);
writeFileSync(join(dir, "kv.sh"), kv.join("\n") + "\n", { mode: 0o755 });
console.log(
  `wrote ${lines.length} statements and ${fileIds.size} file uploads`,
);
