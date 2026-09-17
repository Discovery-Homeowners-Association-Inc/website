import type { AgendaBody } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import {
  type AgendaResponse,
  api,
  can,
  longDate,
  newId,
  param,
  typeLabel,
} from "../lib/api.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";

type Suggestions = {
  template: { title: string; detail: string }[];
  open: {
    id: string;
    title: string;
    outcome: "follow_up" | "deferred";
    owner: string;
    note: string;
    from_date: string;
  }[];
};

export default function Meeting() {
  const id = param("id");
  const { me } = useMe();
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [body, setBody] = useState<AgendaBody>({ items: [], notes: "" });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

  const load = async () => {
    // Offered, never applied: the secretary decides what goes on the agenda.
    api<Suggestions>("GET", `/meetings/${id}/agenda/suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions(null));
    const d = await api<AgendaResponse>("GET", `/meetings/${id}/agenda`);
    setData(d);
    setBody(
      d.current?.body ?? {
        items: [{ id: newId(), title: "Call to order", detail: "" }],
        notes: "",
      },
    );
    setDirty(false);
  };
  useEffect(() => void load().catch((e: Error) => setError(e.message)), []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!data) return error ? <ErrorNotice message={error} /> : <Loading />;
  const editable = can(me, "admin", "secretary");
  const m = data.meeting;
  const version = data.agenda?.current_version ?? 0;
  const published = data.agenda?.published_version ?? null;

  const update = (next: AgendaBody) => {
    setBody(next);
    setDirty(true);
    setSaved("");
  };
  const setItem = (i: number, patch: Partial<AgendaBody["items"][number]>) =>
    update({
      ...body,
      items: body.items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    });
  const move = (i: number, by: number) => {
    const items = [...body.items];
    const [it] = items.splice(i, 1);
    items.splice(i + by, 0, it!);
    update({ ...body, items });
  };

  async function save() {
    setError("");
    try {
      const r = await api<{ version: number }>(
        "PUT",
        `/meetings/${id}/agenda`,
        { base_version: version, body },
      );
      await load();
      setSaved(`Saved as version ${r.version}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function publish() {
    setError("");
    try {
      const r = await api<{ published_version: number }>(
        "POST",
        `/meetings/${id}/agenda/publish`,
      );
      await load();
      setSaved(`Version ${r.published_version} is marked as published.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const addSuggestion = (title: string, detail: string) =>
    update({ ...body, items: [...body.items, { id: newId(), title, detail }] });

  const onAgenda = (title: string) =>
    body.items.some((it) => it.title.trim() === title.trim());

  /**
   * What to put on the agenda, offered rather than applied. Each open item says
   * which meeting it came from, so it can be checked rather than trusted.
   */
  function Suggested() {
    const template = suggestions!.template.filter((t) => !onAgenda(t.title));
    const open = suggestions!.open.filter((o) => !onAgenda(o.title));
    if (template.length === 0 && open.length === 0) return null;
    return (
      <details class="help-details" open={open.length > 0}>
        <summary>Suggested items ({template.length + open.length})</summary>
        <div>
          {open.length > 0 && (
            <>
              <h3>Left open last meeting</h3>
              <ul class="suggestions">
                {open.map((o) => (
                  <li key={o.id}>
                    <button
                      class="button button--quiet button--small"
                      type="button"
                      onClick={() => addSuggestion(o.title, o.note)}
                    >
                      Add
                    </button>
                    <div>
                      <strong>{o.title}</strong>
                      <span class="meta">
                        {o.outcome === "deferred" ? "Deferred" : "Follow up"}
                        {o.owner && `, ${o.owner}`}
                        {" — "}
                        {longDate(o.from_date)}
                      </span>
                      {o.note && <span class="meta">{o.note}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {template.length > 0 && (
            <>
              <h3>{typeLabel[m.type]} template</h3>
              <ul class="suggestions">
                {template.map((t) => (
                  <li key={t.title}>
                    <button
                      class="button button--quiet button--small"
                      type="button"
                      onClick={() => addSuggestion(t.title, t.detail)}
                    >
                      Add
                    </button>
                    <div>
                      <strong>{t.title}</strong>
                      {t.detail && <span class="meta">{t.detail}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>
    );
  }

  return (
    <>
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/meetings/">Meetings</a>
      </nav>
      <h1>
        {typeLabel[m.type]}, {longDate(m.date)}
      </h1>
      <p>
        {m.time}, {m.location}.{" "}
        {m.status === "cancelled" && <strong>Cancelled.</strong>}
      </p>
      {can(me, "admin", "secretary", "board", "reviewer") && (
        <p>
          <a class="button button--quiet" href={`/minutes/?id=${m.id}`}>
            Minutes for this meeting
          </a>
        </p>
      )}

      <h2>Agenda</h2>
      {editable && suggestions && <Suggested />}
      <p class="meta">
        {version === 0 ? "Not saved yet." : `Version ${version}.`}{" "}
        {published === null
          ? "Not published."
          : published === version
            ? `Version ${published} is published.`
            : `Version ${published} is published; version ${version} has changes that are not published yet.`}
      </p>
      <ErrorNotice message={error} />
      <Saved message={saved} />

      {editable ? (
        <form onSubmit={(e) => (e.preventDefault(), void save())}>
          <ol class="prose agenda-items">
            {body.items.map((it, i) => (
              <li key={it.id} class="item-card">
                <div class="field">
                  <label for={`t-${it.id}`}>Item title</label>
                  <input
                    id={`t-${it.id}`}
                    type="text"
                    required
                    value={it.title}
                    onInput={(e) =>
                      setItem(i, { title: e.currentTarget.value })
                    }
                  />
                </div>
                <div class="field">
                  <label for={`d-${it.id}`}>Details</label>
                  <textarea
                    id={`d-${it.id}`}
                    rows={2}
                    value={it.detail}
                    onInput={(e) =>
                      setItem(i, { detail: e.currentTarget.value })
                    }
                  />
                </div>
                <div class="actions">
                  <button
                    class="button button--quiet button--small"
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move "${it.title}" up`}
                  >
                    Move up
                  </button>
                  <button
                    class="button button--quiet button--small"
                    type="button"
                    disabled={i === body.items.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move "${it.title}" down`}
                  >
                    Move down
                  </button>
                  <button
                    class="button button--danger button--small"
                    type="button"
                    onClick={() =>
                      update({
                        ...body,
                        items: body.items.filter((_, j) => j !== i),
                      })
                    }
                    aria-label={`Remove "${it.title}"`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p>
            <button
              class="button button--quiet"
              type="button"
              onClick={() =>
                update({
                  ...body,
                  items: [
                    ...body.items,
                    { id: newId(), title: "", detail: "" },
                  ],
                })
              }
            >
              Add an item
            </button>
          </p>
          <div class="field prose">
            <label for="notes">Notes for attendees</label>
            <textarea
              id="notes"
              value={body.notes}
              onInput={(e) => update({ ...body, notes: e.currentTarget.value })}
            />
          </div>
          <div class="actions">
            <button class="button" type="submit" disabled={!dirty}>
              Save agenda
            </button>
            <button
              class="button button--quiet"
              type="button"
              disabled={dirty || version === 0 || published === version}
              onClick={publish}
            >
              Publish this version
            </button>
            {dirty && <span class="meta">Unsaved changes</span>}
          </div>
        </form>
      ) : body.items.length === 0 ? (
        <p>No agenda yet.</p>
      ) : (
        <ol class="prose agenda-items">
          {body.items.map((it) => (
            <li>
              <strong>{it.title}</strong>
              {it.detail && <p>{it.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
