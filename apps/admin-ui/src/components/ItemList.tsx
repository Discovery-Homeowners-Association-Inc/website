import type { Item, ItemKind } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import { api, can, messageFrom, when } from "../lib/api.ts";
import { KINDS, stateLabel } from "../lib/content.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";
import { Why } from "./Why.tsx";

type Row = Item & { author: string | null };

/** Whether an item is showing on the public site right now. */
const live = (i: Item, now: number) =>
  i.status === "published" &&
  new Date(i.publish_at).getTime() <= now &&
  !(i.expires_at && new Date(i.expires_at).getTime() <= now);

export default function ItemList({ kind }: { kind: ItemKind }) {
  const cfg = KINDS[kind];
  const { me, error: meError } = useMe();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "mine" | "pending">("all");
  useEffect(() => {
    api<Row[]>("GET", `/items?kind=${kind}`).then(setRows, (e: unknown) =>
      setError(messageFrom(e)),
    );
  }, [kind]);
  if (error) return <ErrorNotice message={error} />;
  if (meError) return <ErrorNotice message={meError} />;
  if (!rows || !me) return <Loading />;
  const now = Date.now();
  const needle = q.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (show === "mine" && r.author_id !== me.id) return false;
    if (show === "pending" && r.status !== "pending") return false;
    return (
      !needle ||
      `${r.body.title} ${"summary" in r.body ? r.body.summary : ""}`
        .toLowerCase()
        .includes(needle)
    );
  });
  const pending = rows.filter((r) => r.status === "pending").length;
  const canWrite = can(me, "admin", "secretary", "editor");

  return (
    <>
      <PageHead title={cfg.many} lede={cfg.intro} />
      <Why title={`How ${cfg.many.toLowerCase()} get onto the site`}>
        <p>
          Write a {cfg.one}, then either publish it or submit it for approval,
          depending on your role. It appears on the site from its publish date
          until its expiry date, if you set one. The site itself is updated a
          few minutes after a change, and every morning.
        </p>
      </Why>
      <div class="toolbar">
        {canWrite && (
          <a class="button" href={`${cfg.path}edit/`}>
            New {cfg.one}
          </a>
        )}
        <div class="field toolbar__search">
          <label for="q">Search</label>
          <input
            id="q"
            type="search"
            value={q}
            onInput={(e) => setQ(e.currentTarget.value)}
            placeholder="Title or summary"
          />
        </div>
        <div class="field">
          <label for="show">Show</label>
          <select
            id="show"
            value={show}
            onChange={(e) => setShow(e.currentTarget.value as typeof show)}
          >
            <option value="all">Everything ({rows.length})</option>
            <option value="pending">Waiting for approval ({pending})</option>
            <option value="mine">Mine</option>
          </select>
        </div>
      </div>
      {visible.length === 0 ? (
        <p class="empty">
          {rows.length === 0
            ? `No ${cfg.many.toLowerCase()} yet.`
            : "Nothing matches."}
        </p>
      ) : (
        <ul class="item-list">
          {visible.map((r) => (
            <li key={r.id}>
              <a href={`${cfg.path}edit/?id=${r.id}`}>
                <strong>{r.body.title}</strong>
              </a>
              <div class="item-list__meta">
                <span
                  class={`status status--${r.status}${live(r, now) ? " status--live" : ""}`}
                >
                  {r.status === "published" && !live(r, now)
                    ? new Date(r.publish_at).getTime() > now
                      ? "Scheduled"
                      : "Expired"
                    : stateLabel[r.status]}
                </span>
                <span class="meta">
                  {r.status === "published"
                    ? `From ${when(r.publish_at)}`
                    : `Changed ${when(r.updated_at)}`}
                  {r.author && ` by ${r.author}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
