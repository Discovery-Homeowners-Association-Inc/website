import { ROLES, type Role } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import { api, can, type Grant } from "../lib/api.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";

type Person = {
  id: string;
  name: string;
  email: string;
  grants: Grant[];
  signed_in: boolean;
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
        <div>
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
          />{" "}
          <label for={`${idPrefix}-${r}`}>
            <strong>{r}</strong> <span class="meta">{roleHelp[r]}</span>
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
    api<Person[]>("GET", "/users").then(setPeople, (e: Error) =>
      setError(e.message),
    );
  useEffect(() => void load(), []);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setError("");
    setSaved("");
    try {
      await fn();
      setSaved(done);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (me && !can(me, "admin"))
    return <p class="notice">Only administrators can manage people.</p>;
  if (!people) return error ? <ErrorNotice message={error} /> : <Loading />;

  return (
    <>
      <h1>People</h1>
      <ErrorNotice message={error} />
      <Saved message={saved} />
      <form
        class="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (invite.roles.length === 0)
            return setError("Choose at least one role.");
          void run(
            () =>
              api("POST", "/users", {
                email: invite.email,
                name: invite.name,
                grants: invite.roles.map((role) => ({ role })),
              }),
            `Invited ${invite.email}. They can now sign in with Google using that address.`,
          ).then(() => setInvite({ email: "", name: "", roles: ["board"] }));
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

      <ul class="people">
        {people.map((p) => (
          <li>
            <strong>{p.name}</strong>
            <span>{p.email}</span>
            <div class="meta">
              {p.grants.map((g) => g.role).join(", ") || "No roles"}.{" "}
              {p.signed_in
                ? "Google account linked."
                : "Has not signed in with Google yet."}
            </div>
            {editing?.id === p.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () =>
                      api("PUT", `/users/${p.id}/grants`, {
                        grants: editing.roles.map((role) => ({ role })),
                      }),
                    `Updated ${p.name}'s roles.`,
                  ).then(() => setEditing(null));
                }}
              >
                <RolePicker
                  idPrefix={`edit-${p.id}`}
                  value={editing.roles}
                  onChange={(roles) => setEditing({ id: p.id, roles })}
                />
                <div class="actions">
                  <button class="button button--small" type="submit">
                    Save roles
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
            ) : (
              <div class="actions">
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
                    onClick={() =>
                      confirm(
                        `Remove ${p.name}? They will be signed out and lose all access.`,
                      ) &&
                      void run(
                        () => api("DELETE", `/users/${p.id}`),
                        `Removed ${p.name}.`,
                      )
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
