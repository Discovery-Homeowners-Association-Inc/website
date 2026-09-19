/**
 * Saves the admin API's public content into apps/site/content/ so the public
 * site can build from it without the Worker. Committed to git: it is the
 * record of what was published.
 *
 *   node scripts/snapshot.ts http://127.0.0.1:8787
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SiteSnapshot } from "@dhoa/shared";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const dir = new URL("../apps/site/content/", import.meta.url).pathname;
const filesDir = new URL("../apps/site/public/documents/", import.meta.url)
  .pathname;
mkdirSync(filesDir, { recursive: true });

const res = await fetch(`${base}/api/public/site.json`);
if (!res.ok)
  throw new Error(`${base}/api/public/site.json answered ${res.status}`);
const snapshot = SiteSnapshot.parse(await res.json());

// Documents: download each file once, named by its slug so URLs stay stable.
const EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};
const keep = new Set<string>();
for (const doc of snapshot.documents) {
  if (!doc.file_url) continue;
  const ext = EXT[doc.file_type] ?? ".bin";
  const name = `${doc.slug}${ext}`;
  /*
   * Fetched from the origin the snapshot itself came from, not from the origin
   * inside file_url. The Worker builds those URLs from BETTER_AUTH_URL so that
   * one cached snapshot is correct for every caller, and that hostname is not
   * necessarily resolvable from wherever this script runs.
   */
  const f = await fetch(new URL(new URL(doc.file_url).pathname, base));
  if (!f.ok) throw new Error(`file for ${doc.slug} answered ${f.status}`);
  writeFileSync(join(filesDir, name), new Uint8Array(await f.arrayBuffer()));
  keep.add(name);
  doc.file_url = `/documents/${name}`;
}
for (const name of readdirSync(filesDir))
  if (!keep.has(name)) rmSync(join(filesDir, name));

writeFileSync(join(dir, "site.json"), JSON.stringify(snapshot, null, 2) + "\n");
console.log(
  `saved ${snapshot.news.length} news, ${snapshot.events.length} events, ${snapshot.documents.length} documents, ${snapshot.pages.length} pages, ${snapshot.people.length} people, ${snapshot.meetings.length} meetings`,
);
