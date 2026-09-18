import { useEffect, useState } from "preact/hooks";
import { api, can, messageFrom, param } from "../lib/api.ts";
import { SETTINGS_GROUPS } from "../lib/settings.ts";
import { useMe } from "../lib/use-me.ts";
import { Fields } from "./Form.tsx";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";

export default function Settings() {
  const { me } = useMe();
  const key = param("group");
  const group = SETTINGS_GROUPS.find((g) => g.key === key);
  const [value, setValue] = useState<Record<string, unknown> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!group) return;
    api<Record<string, unknown>>("GET", `/settings/${group.key}`).then(
      setValue,
      (e: unknown) => setError(messageFrom(e)),
    );
  }, [key]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (me && !can(me, "admin"))
    return <p class="notice">Only administrators can change site settings.</p>;

  if (!group) {
    return (
      <>
        <PageHead
          title="Site settings"
          lede="Facts the site shows in many places, so they are changed in one. Text for each page is under Pages."
        />
        <ul class="tasks">
          {SETTINGS_GROUPS.map((g) => (
            <li key={g.key}>
              <a href={`/settings/?group=${g.key}`}>
                <strong>{g.title}</strong>
                <span>{g.intro}</span>
              </a>
            </li>
          ))}
        </ul>
      </>
    );
  }

  async function save(e: Event) {
    e.preventDefault();
    setError("");
    setSaved("");
    try {
      const next = await api<Record<string, unknown>>(
        "PUT",
        `/settings/${group!.key}`,
        value,
      );
      setValue(next);
      setDirty(false);
      setSaved("Saved. The site will update shortly.");
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  return (
    <>
      <PageHead
        crumbs={[{ href: "/settings/", label: "Site settings" }]}
        title={group.title}
        lede={group.intro}
      />
      <ErrorNotice message={error} />
      <Saved message={saved} />
      {!value ? (
        <Loading />
      ) : (
        <form onSubmit={save} class="settings-form">
          <Fields
            fields={group.fields}
            value={value}
            onChange={(next) => (setValue(next), setDirty(true), setSaved(""))}
            idPrefix={group.key}
          />
          <div class="actions actions--sticky">
            <button class="button" type="submit" disabled={!dirty}>
              Save changes
            </button>
            {dirty && <span class="meta">Unsaved changes</span>}
          </div>
        </form>
      )}
    </>
  );
}
