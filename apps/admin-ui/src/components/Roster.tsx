import {
  BOARD_OFFICES,
  todayInNewYork,
  type Committee,
  type Person,
} from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import { api, can, messageFrom } from "../lib/api.ts";
import { type RosterPerson, useRoster } from "../lib/roster.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";
import { Why } from "./Why.tsx";

const blankPerson = (): Person => ({
  name: "",
  email: "",
  phone: "",
  office: "",
  committees: [],
  chairs: [],
  term_start: null,
  term_end: null,
  note: "",
  show_email: false,
  order: 100,
});

export default function Roster() {
  const { me, error: meError } = useMe();
  const { people, committees, serving, error: loadError, reload } = useRoster();
  const [editing, setEditing] = useState<{
    id: string | null;
    data: Person;
  } | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(
    null,
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [emailKeys, setEmailKeys] = useState<string[]>([]);
  useEffect(() => {
    api<{ emails: Record<string, string> }>(
      "GET",
      "/settings/organization",
    ).then(
      (o) => setEmailKeys(Object.keys(o.emails)),
      () => {},
    );
  }, []);

  if (loadError) return <ErrorNotice message={loadError} />;
  if (meError) return <ErrorNotice message={meError} />;
  if (!people || !committees || !me) return <Loading />;
  const canEdit = can(me, "admin", "secretary");
  const past = people.filter((p) => !serving.includes(p));
  const cname = (slug: string) =>
    committees.find((c) => c.slug === slug)?.name ?? slug;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setError("");
    setSaved("");
    try {
      await fn();
      await reload();
      setSaved(done);
      setEditing(null);
      setEditingCommittee(null);
    } catch (e) {
      setError(messageFrom(e));
    }
  };

  const personForm = (p: { id: string | null; data: Person }) => {
    const d = p.data;
    const set = (patch: Partial<Person>) =>
      setEditing({ id: p.id, data: { ...d, ...patch } });
    return (
      <form
        class="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () =>
              p.id
                ? api("PUT", `/roster/people/${p.id}`, d)
                : api("POST", "/roster/people", d),
            p.id ? `Saved ${d.name}.` : `Added ${d.name} to the roster.`,
          );
        }}
      >
        <h2>{p.id ? d.name || "Edit person" : "Add a person"}</h2>
        <div class="row">
          <div class="field">
            <label for="p-name">Name</label>
            <input
              id="p-name"
              type="text"
              required
              value={d.name}
              onInput={(e) => set({ name: e.currentTarget.value })}
            />
          </div>
          <div class="field">
            <label for="p-office">Board office</label>
            <select
              id="p-office"
              value={d.office}
              onChange={(e) =>
                set({ office: e.currentTarget.value as Person["office"] })
              }
            >
              <option value="">Not on the board</option>
              {BOARD_OFFICES.map((o) => (
                <option value={o}>{o}</option>
              ))}
            </select>
            <span class="hint">
              Directors appear on the board page and in the attendance list for
              minutes.
            </span>
          </div>
        </div>
        <fieldset>
          <legend>Committees</legend>
          {committees.map((c) => (
            <div class="choice" key={c.slug}>
              <input
                id={`p-c-${c.slug}`}
                type="checkbox"
                checked={d.committees.includes(c.slug)}
                onChange={(e) =>
                  set({
                    committees: e.currentTarget.checked
                      ? [...d.committees, c.slug]
                      : d.committees.filter((x) => x !== c.slug),
                    chairs: e.currentTarget.checked
                      ? d.chairs
                      : d.chairs.filter((x) => x !== c.slug),
                  })
                }
              />
              <label for={`p-c-${c.slug}`}>
                {c.name}
                {d.committees.includes(c.slug) && (
                  <span class="choice-inline">
                    <input
                      id={`p-ch-${c.slug}`}
                      type="checkbox"
                      checked={d.chairs.includes(c.slug)}
                      onChange={(e) =>
                        set({
                          chairs: e.currentTarget.checked
                            ? [...d.chairs, c.slug]
                            : d.chairs.filter((x) => x !== c.slug),
                        })
                      }
                    />{" "}
                    <label for={`p-ch-${c.slug}`}>Chairs it</label>
                  </span>
                )}
              </label>
            </div>
          ))}
        </fieldset>
        <div class="row">
          <div class="field">
            <label for="p-start">Term started</label>
            <input
              id="p-start"
              type="date"
              value={d.term_start ?? ""}
              onInput={(e) =>
                set({ term_start: e.currentTarget.value || null })
              }
            />
          </div>
          <div class="field">
            <label for="p-end">Leaves or left on</label>
            <input
              id="p-end"
              type="date"
              value={d.term_end ?? ""}
              onInput={(e) => set({ term_end: e.currentTarget.value || null })}
            />
            <span class="hint">
              Set this when someone leaves. Their record stays for the minutes
              and the history of who served.
            </span>
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label for="p-email">Email</label>
            <input
              id="p-email"
              type="email"
              value={d.email}
              onInput={(e) => set({ email: e.currentTarget.value })}
            />
          </div>
          <div class="field">
            <label for="p-phone">Phone</label>
            <input
              id="p-phone"
              type="tel"
              value={d.phone}
              onInput={(e) => set({ phone: e.currentTarget.value })}
            />
            <span class="hint">
              Never shown on the site. For the board's own use.
            </span>
          </div>
        </div>
        <div class="choice">
          <input
            id="p-show"
            type="checkbox"
            checked={d.show_email}
            onChange={(e) => set({ show_email: e.currentTarget.checked })}
          />
          <label for="p-show">
            <strong>Show their email on the public site</strong>
            <span class="meta">
              Off by default. Most directors prefer people to contact the
              office.
            </span>
          </label>
        </div>
        <div class="row">
          <div class="field">
            <label for="p-note">Note shown on the site</label>
            <input
              id="p-note"
              type="text"
              value={d.note}
              onInput={(e) => set({ note: e.currentTarget.value })}
              placeholder="Chairs the Architectural Control Committee"
            />
          </div>
          <div class="field">
            <label for="p-order">Order on the board page</label>
            <input
              id="p-order"
              type="number"
              min={0}
              step={1}
              value={d.order}
              onInput={(e) =>
                set({ order: Number(e.currentTarget.value) || 0 })
              }
            />
            <span class="hint">Lower numbers come first.</span>
          </div>
        </div>
        <div class="actions">
          <button class="button" type="submit">
            {p.id ? "Save" : "Add to the roster"}
          </button>
          <button
            class="button button--quiet"
            type="button"
            onClick={() => setEditing(null)}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  };

  const row = (p: RosterPerson) => (
    <li key={p.id}>
      <strong>{p.name}</strong>
      <span>
        {[
          p.office,
          ...p.committees.map((c) =>
            p.chairs.includes(c) ? `${cname(c)} (chair)` : cname(c),
          ),
        ]
          .filter(Boolean)
          .join(", ") || "No current role"}
      </span>
      <div class="meta">
        {p.term_start && `Since ${p.term_start}. `}
        {p.term_end &&
          `${p.term_end > todayInNewYork() ? "Leaves" : "Left"} ${p.term_end}. `}
        {p.note}
      </div>
      {canEdit && (
        <div class="actions">
          <button
            class="button button--quiet button--small"
            type="button"
            onClick={() =>
              setEditing({ id: p.id, data: { ...blankPerson(), ...p } })
            }
          >
            Edit
          </button>
          {!p.term_end && (
            <button
              class="button button--danger button--small"
              type="button"
              onClick={() => {
                const today = todayInNewYork();
                if (
                  confirm(
                    `End ${p.name}'s term today? They stay in the records but no longer appear as serving.`,
                  )
                )
                  void run(
                    () =>
                      api("PUT", `/roster/people/${p.id}`, {
                        ...p,
                        term_end: today,
                      }),
                    `${p.name}'s term is recorded as ended.`,
                  );
              }}
            >
              End term
            </button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <>
      <PageHead
        title="The roster"
        lede="Who serves on the board and its committees. The board page, the committees page and the attendance list in minutes all come from here."
      />
      <Why title="How the roster relates to sign-in accounts">
        <p>
          The roster is who serves; it is public. Sign-in accounts are who can
          use this admin app; they are under <a href="/people/">Accounts</a>. A
          director need not have an account, and a volunteer with an account
          need not be on the roster.
        </p>
      </Why>
      <ErrorNotice message={error} />
      <Saved message={saved} />
      {editing
        ? personForm(editing)
        : canEdit && (
            <p>
              <button
                class="button"
                type="button"
                onClick={() => setEditing({ id: null, data: blankPerson() })}
              >
                Add a person
              </button>
            </p>
          )}

      <h2>Serving now</h2>
      <ul class="people">{serving.map(row)}</ul>

      {past.length > 0 && (
        <>
          <h2>
            <button
              class="button button--quiet button--small"
              type="button"
              aria-expanded={showPast}
              onClick={() => setShowPast(!showPast)}
            >
              {showPast ? "Hide" : "Show"} past members ({past.length})
            </button>
          </h2>
          {showPast && <ul class="people">{past.map(row)}</ul>}
        </>
      )}

      <h2>Committees</h2>
      <ul class="people">
        {committees.map((c) => (
          <li key={c.slug}>
            <strong>{c.name}</strong>
            <span>{c.purpose}</span>
            <div class="meta">
              {serving
                .filter((p) => p.committees.includes(c.slug))
                .map((p) => p.name)
                .join(", ") || "No members listed"}
              {c.volunteers_wanted && ". Looking for volunteers."}
            </div>
            {canEdit && (
              <div class="actions">
                <button
                  class="button button--quiet button--small"
                  type="button"
                  onClick={() => setEditingCommittee(c)}
                >
                  Edit
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editingCommittee && (
        <form
          class="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                api(
                  "PUT",
                  `/roster/committees/${editingCommittee.slug}`,
                  editingCommittee,
                ),
              `Saved ${editingCommittee.name}.`,
            );
          }}
        >
          <h2>{editingCommittee.name}</h2>
          {(
            [
              ["name", "Name", "text"],
              ["purpose", "What it does", "textarea"],
              ["meets", "When it meets", "text"],
              ["page", "Related page on the site", "text"],
            ] as const
          ).map(([k, label, kind]) => (
            <div class="field" key={k}>
              <label for={`c-${k}`}>{label}</label>
              {kind === "textarea" ? (
                <textarea
                  id={`c-${k}`}
                  value={editingCommittee[k]}
                  onInput={(e) =>
                    setEditingCommittee({
                      ...editingCommittee,
                      [k]: e.currentTarget.value,
                    })
                  }
                />
              ) : (
                <input
                  id={`c-${k}`}
                  type="text"
                  value={editingCommittee[k]}
                  onInput={(e) =>
                    setEditingCommittee({
                      ...editingCommittee,
                      [k]: e.currentTarget.value,
                    })
                  }
                />
              )}
            </div>
          ))}
          <div class="field">
            <label for="c-email">Email role key</label>
            <select
              id="c-email"
              value={editingCommittee.email_key}
              onChange={(e) =>
                setEditingCommittee({
                  ...editingCommittee,
                  email_key: e.currentTarget.value,
                })
              }
            >
              {emailKeys.map((k) => (
                <option value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div class="choice">
            <input
              id="c-vol"
              type="checkbox"
              checked={editingCommittee.volunteers_wanted}
              onChange={(e) =>
                setEditingCommittee({
                  ...editingCommittee,
                  volunteers_wanted: e.currentTarget.checked,
                })
              }
            />
            <label for="c-vol">
              <strong>Looking for volunteers</strong>
            </label>
          </div>
          <div class="actions">
            <button class="button" type="submit">
              Save
            </button>
            <button
              class="button button--quiet"
              type="button"
              onClick={() => setEditingCommittee(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}
