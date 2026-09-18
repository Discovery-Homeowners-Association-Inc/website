import { ROLES, type Role } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import {
  api,
  can,
  messageFrom,
  runAndReport,
  when,
  type Grant,
} from "../lib/api.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";

type Person = {
  id: string;
  name: string;
  email: string;
  grants: Grant[];
  signed_in: boolean;
  former: boolean;
  removed_at: string | null;
};

const roleHelp: Record<Role, string> = {
  admin: "Invites people and sets roles",
  secretary:
    "Writes agendas and minutes, runs the vote, files minutes in PayHOA",
  board: "Reviews and votes on minutes",
  editor: "Edits public site content",
  reviewer: "Reads and comments on draft minutes, no vote",
};

function RolePicker({
  value,
  onChange,
  idPrefix,
}: {
  value: Role[];
  onChange: (r: Role[]) => void;
  idPrefix: string;
}) {
  return (
    <fieldset>
      <legend>Roles</legend>
      {ROLES.map((r) => (
        <div class="choice">
          <input
            id={`${idPrefix}-${r}`}
            type="checkbox"
            checked={value.includes(r)}
            onChange={(e) =>
              onChange(
                e.currentTarget.checked
                  ? [...value, r]
                  : value.filter((x) => x !== r),
              )
            }
          />
          <label for={`${idPrefix}-${r}`}>
            <strong>{r}</strong>
            <span class="meta">{roleHelp[r]}</span>
          </label>
        </div>
      ))}
    </fieldset>
  );
}

export default function People() {
  const { me } = useMe();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [invite, setInvite] = useState({
    email: "",
    name: "",
    roles: ["board"] as Role[],
  });
  const [editing, setEditing] = useState<{ id: string; roles: Role[] } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = () =>
    api<Person[]>("GET", "/users").then(setPeople, (e: unknown) =>
      setError(messageFrom(e)),
    );
  useEffect(() => void load(), []);

  const run = runAndReport(setError, setSaved, load);

  if (me && !can(me, "admin"))
    return <p class="notice">Only administrators can manage people.</p>;
  if (!people) return error ? <ErrorNotice message={error} /> : <Loading />;

  function renderPerson(p: Person) {
    if (editing?.id === p.id) {
      return (
        <li>
          <strong>{p.name}</strong>
          <span>{p.email}</span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const roles = editing.roles;
              void run(
                async () => {
                  await api("PUT", `/users/${p.id}/grants`, {
                    grants: roles.map((role) => ({ role })),
                  });
                  setEditing(null);
                },
                p.former
                  ? `Restored ${p.name}'s access.`
                  : `Updated ${p.name}'s roles.`,
              );
            }}
          >
            <RolePicker
              idPrefix={`edit-${p.id}`}
              value={editing.roles}
              onChange={(roles) => setEditing({ id: p.id, roles })}
            />
            <div class="actions">
              <button
                class="button button--small"
                type="submit"
                disabled={editing.roles.length === 0}
              >
                {p.former ? "Restore access" : "Save roles"}
              </button>
              <button
                class="button button--quiet button--small"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </li>
      );
    }
    return (
      <li>
        <strong>{p.name}</strong>
        <span>{p.email}</span>
        <div class="meta">
          {p.former
            ? `Access removed ${p.removed_at ? when(p.removed_at) : ""}.`
            : `${p.grants.map((g) => g.role).join(", ") || "No roles"}. ${p.signed_in ? "Google account linked." : "Has not signed in with Google yet."}`}
        </div>
        <div class="actions">
          {p.former ? (
            <button
              class="button button--quiet button--small"
              type="button"
              onClick={() => setEditing({ id: p.id, roles: ["board"] })}
            >
              Restore access
            </button>
          ) : (
            <>
              <button
                class="button button--quiet button--small"
                type="button"
                onClick={() =>
                  setEditing({ id: p.id, roles: p.grants.map((g) => g.role) })
                }
              >
                Change roles
              </button>
              {p.id !== me?.id && (
                <button
                  class="button button--danger button--small"
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Remove ${p.name}'s access? They will be signed out now. Their name stays on everything they did.`,
                      )
                    ) {
                      void run(
                        () => api("DELETE", `/users/${p.id}`),
                        `Removed ${p.name}'s access. They are listed under former members.`,
                      );
                    }
                  }}
                >
                  Remove access
                </button>
              )}
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <>
      <PageHead
        title="Accounts"
        lede={
          <>
            Who can sign in to this admin app, and what they may do. For who
            serves on the board, see <a href="/roster/">the roster</a>.
          </>
        }
      />
      <ErrorNotice message={error} />
      <Saved message={saved} />
      <form
        class="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (invite.roles.length === 0)
            return setError("Choose at least one role.");
          const sent = invite;
          // Clear the form as soon as the invite succeeds, before the list
          // reloads, so nothing typed afterwards is wiped.
          void run(async () => {
            await api("POST", "/users", {
              email: sent.email,
              name: sent.name,
              grants: sent.roles.map((role) => ({ role })),
            });
            setInvite({ email: "", name: "", roles: ["board"] });
          }, `Invited ${sent.email}. They can now sign in with Google using that address.`);
        }}
      >
        <h2>Invite someone</h2>
        <div class="row">
          <div class="field">
            <label for="i-name">Name</label>
            <input
              id="i-name"
              type="text"
              required
              value={invite.name}
              onInput={(e) =>
                setInvite({ ...invite, name: e.currentTarget.value })
              }
            />
          </div>
          <div class="field">
            <label for="i-email">Google account email</label>
            <input
              id="i-email"
              type="email"
              required
              value={invite.email}
              onInput={(e) =>
                setInvite({ ...invite, email: e.currentTarget.value })
              }
            />
          </div>
        </div>
        <RolePicker
          idPrefix="invite"
          value={invite.roles}
          onChange={(roles) => setInvite({ ...invite, roles })}
        />
        <button class="button" type="submit">
          Invite
        </button>
      </form>

      <h2>Current members</h2>
      <ul class="people">
        {people.filter((p) => !p.former).map((p) => renderPerson(p))}
      </ul>

      {people.some((p) => p.former) && (
        <>
          <h2>Former members</h2>
          <p class="meta">
            Former members cannot sign in. Their names stay on everything they
            wrote, reviewed, or voted on.
          </p>
          <ul class="people">
            {people.filter((p) => p.former).map((p) => renderPerson(p))}
          </ul>
        </>
      )}
    </>
  );
}
