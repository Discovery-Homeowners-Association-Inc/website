/**
 * Turns seed/*.json into SQL and KV puts so the first database can be filled
 * locally or remotely:
 *   node scripts/seed.ts            -> writes seed/seed.sql and seed/kv.sh
 *   just seed-local                 -> applies both to the local dev database
 */
import { createHash, randomUUID } from "node:crypto";
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
  const id = randomUUID();
  lines.push(
    `insert or ignore into items (id, kind, slug, status, body, publish_at, created_at, updated_at) values (${q(id)}, ${q(kind)}, ${q(raw.slug ?? slugify(body.title))}, 'published', ${q(JSON.stringify(body))}, ${q(raw.publish_at)}, ${q(now)}, ${q(now)});`,
  );
}

const settings = read("settings.json");
for (const [key, schema] of Object.entries(SETTINGS)) {
  const value = schema.parse(settings[key]);
  lines.push(
    `insert or ignore into settings (key, value, updated_at) values (${q(key)}, ${q(JSON.stringify(value))}, ${q(now)});`,
  );
}

for (const raw of read("people.json")) {
  const person = Person.parse(raw);
  lines.push(
    `insert or ignore into people (id, data, created_at, updated_at) values (${q(randomUUID())}, ${q(JSON.stringify(person))}, ${q(now)}, ${q(now)});`,
  );
}
for (const raw of read("committees.json")) {
  const c = Committee.parse(raw);
  lines.push(
    `insert or ignore into committees (slug, data, updated_at) values (${q(c.slug)}, ${q(JSON.stringify(c))}, ${q(now)});`,
  );
}

writeFileSync(join(dir, "seed.sql"), lines.join("\n") + "\n");
writeFileSync(join(dir, "kv.sh"), kv.join("\n") + "\n", { mode: 0o755 });
console.log(
  `wrote ${lines.length} statements and ${fileIds.size} file uploads`,
);
