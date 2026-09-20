import {
  type Item,
  type ItemAction,
  type ItemKind,
  itemActions,
} from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import {
  api,
  can,
  messageFrom,
  param,
  runAndReport,
  when,
} from "../lib/api.ts";
import { KINDS, stateLabel } from "../lib/content.ts";
import { blank, fromLocalInput, toLocalInput } from "../lib/fields.ts";
import { useMe } from "../lib/use-me.ts";
import { Fields } from "./Form.tsx";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";
import { Why } from "./Why.tsx";

type Full = Item & {
  author: string | null;
  approved_by: string | null;
  review_note: string;
};
type Approvals = Record<ItemKind, boolean>;

const actionLabel: Record<ItemAction, string> = {
  submit: "Submit for approval",
  approve: "Approve and publish",
  reject: "Send back with a note",
  publish: "Publish",
  unpublish: "Take off the site",
};

export default function ItemEditor({ kind }: { kind: ItemKind }) {
  const cfg = KINDS[kind];
  const id = param("id");
  const { me, error: meError } = useMe();
  const [item, setItem] = useState<Full | null>(null);
  const [body, setBody] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(cfg.fields.map((f) => [f.key, blank(f)])),
  );
  const [meta, setMeta] = useState({
    publish_at: new Date().toISOString(),
    expires_at: "",
    expiry_action: "hide" as "hide" | "delete",
  });
  const [approvals, setApprovals] = useState<Approvals | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!id) return;
    const it = await api<Full>("GET", `/items/${id}`);
    setItem(it);
    setBody(it.body as Record<string, unknown>);
    setMeta({
      publish_at: it.publish_at,
      expires_at: it.expires_at ?? "",
      expiry_action: it.expiry_action,
    });
    setDirty(false);
  };
  useEffect(() => {
    void load().catch((e: unknown) => setError(messageFrom(e)));
    api<Approvals>("GET", "/settings/approvals").then(setApprovals, () => {});
  }, [id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (error && !item && id) return <ErrorNotice message={error} />;
  if (meError) return <ErrorNotice message={meError} />;
  if (!me || (id && !item)) return <Loading />;

  const staff = can(me, "admin", "secretary");
  const requiresApproval = approvals?.[kind] ?? true;
  const editable =
    !item || staff || (item.author_id === me.id && item.status !== "published");
  const roles = me.grants.filter((g) => g.scope === "").map((g) => g.role);
  const actions = item
    ? itemActions({
        status: item.status,
        roles,
        isAuthor: item.author_id === me.id,
        requiresApproval,
      })
    : [];

  const act = runAndReport(setError, setSaved, load);

  async function save(event: Event) {
    event.preventDefault();
    const payload = {
      kind,
      body,
      meta: {
        publish_at: meta.publish_at,
        expires_at: meta.expires_at || null,
        expiry_action: meta.expiry_action,
      },
    };
    if (!item) {
      setError("");
      try {
        const created = await api<Full>("POST", "/items", payload);
        location.replace(`${cfg.path}edit/?id=${created.id}&saved=1`);
      } catch (e) {
        setError(messageFrom(e));
      }
      return;
    }
    await act(
      () => api("PUT", `/items/${item.id}`, payload),
      item.status === "published"
        ? "Saved. The site will update shortly."
        : "Saved.",
    );
  }

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setBody({ ...body, file_id: data.id, file_name: data.name });
      setDirty(true);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setUploading(false);
    }
  }

  const doAction = (action: ItemAction) => {
    if (dirty) return setError("Save your changes first.");
    if (action === "reject" && !note.trim())
      return setError("Write a note saying what needs to change.");
    if (
      action === "unpublish" &&
      !confirm(
        "Take this off the public site? It becomes a draft you can publish again later.",
      )
    )
      return;
    void act(
      () => api("POST", `/items/${item!.id}/action`, { action, note }),
      {
        submit: "Submitted. An approver will be able to publish it.",
        approve: "Approved and published. The site will update shortly.",
        reject: "Sent back to the author with your note.",
        publish: "Published. The site will update shortly.",
        unpublish: "Taken off the site.",
      }[action],
    ).then((ok) => ok && setNote(""));
  };

  const firstSaved = new URLSearchParams(location.search).get("saved") === "1";

  return (
    <>
      <PageHead
        crumbs={[{ href: cfg.path, label: cfg.many }]}
        title={item ? item.body.title : `New ${cfg.one}`}
      />
      <ErrorNotice message={error} />
      <Saved
        message={
          saved ||
          (firstSaved && !dirty
            ? "Saved as a draft. Publish it or submit it for approval when it is ready."
            : "")
        }
      />

      <div class="workspace">
        <aside class="workspace-actions" aria-label="Status and actions">
          <section class="panel">
            <h2>
              {item ? `Status: ${stateLabel[item.status]}` : "Not saved yet"}
            </h2>
            {!item && (
              <p>
                Save it as a draft first. Nothing shows on the site until it is
                published.
              </p>
            )}
            {item?.status === "draft" && item.review_note && (
              <p class="notice notice--error">
                <strong>Sent back:</strong> {item.review_note}
              </p>
            )}
            {item?.status === "draft" && !item.review_note && (
              <p>
                {requiresApproval
                  ? `${cfg.many} need a second person's approval before they go on the site.`
                  : "Ready when you are."}
              </p>
            )}
            {item?.status === "pending" && (
              <p>
                Waiting for an admin, the secretary or a board member to approve
                it.
              </p>
            )}
            {item?.status === "published" && (
              <p>
                On the site from {when(item.publish_at)}
                {item.expires_at ? ` until ${when(item.expires_at)}` : ""}.
                {cfg.publicUrl(item.slug) && (
                  <>
                    {" "}
                    <a
                      href={`https://discoveryhomeowners.com${cfg.publicUrl(item.slug)}`}
                    >
                      View on the site
                    </a>
                  </>
                )}
              </p>
            )}
            {actions.length > 0 && (
              <div class="actions actions--stack">
                {actions
                  .filter((a) => a !== "reject")
                  .map((a) => (
                    <button
                      key={a}
                      class={
                        a === "unpublish" ? "button button--quiet" : "button"
                      }
                      type="button"
                      disabled={dirty}
                      onClick={() => doAction(a)}
                    >
                      {actionLabel[a]}
                    </button>
                  ))}
                {actions.includes("reject") && (
                  <div class="field">
                    <label for="reject-note">Note for the author</label>
                    <textarea
                      id="reject-note"
                      rows={2}
                      value={note}
                      onInput={(e) => setNote(e.currentTarget.value)}
                      placeholder="What needs to change?"
                    />
                    <button
                      class="button button--quiet"
                      type="button"
                      disabled={dirty}
                      onClick={() => doAction("reject")}
                    >
                      {actionLabel.reject}
                    </button>
                  </div>
                )}
              </div>
            )}
            {dirty && (
              <p class="meta">
                Save your changes before publishing or submitting.
              </p>
            )}
          </section>

          {editable && (
            <section class="panel">
              <h2>When it shows</h2>
              <div class="field">
                <label for="publish-at">Publish date</label>
                <input
                  id="publish-at"
                  type="datetime-local"
                  value={toLocalInput(meta.publish_at)}
                  onInput={(e) => (
                    setMeta({
                      ...meta,
                      publish_at:
                        fromLocalInput(e.currentTarget.value) ||
                        new Date().toISOString(),
                    }),
                    setDirty(true)
                  )}
                />
                <span class="hint">
                  Set a future date to prepare something now and have it appear
                  later.
                </span>
              </div>
              <div class="field">
                <label for="expires-at">Hide after (optional)</label>
                <input
                  id="expires-at"
                  type="datetime-local"
                  value={toLocalInput(meta.expires_at)}
                  onInput={(e) => (
                    setMeta({
                      ...meta,
                      expires_at: fromLocalInput(e.currentTarget.value),
                    }),
                    setDirty(true)
                  )}
                />
                <span class="hint">
                  Leave blank to keep it up. Good for deadlines and seasonal
                  notices.
                </span>
              </div>
              {meta.expires_at && (
                <div class="field">
                  <label for="expiry-action">After that</label>
                  <select
                    id="expiry-action"
                    value={meta.expiry_action}
                    onChange={(e) => (
                      setMeta({
                        ...meta,
                        expiry_action: e.currentTarget.value as
                          "hide" | "delete",
                      }),
                      setDirty(true)
                    )}
                  >
                    <option value="hide">
                      Keep it here, hidden from the site
                    </option>
                    <option value="delete">Delete it for good</option>
                  </select>
                </div>
              )}
            </section>
          )}

          {item && (
            <section class="panel">
              <h2>Details</h2>
              <dl>
                <dt>Web address</dt>
                <dd>
                  <code>{cfg.publicUrl(item.slug)}</code>
                </dd>
                <dt>Written by</dt>
                <dd>{item.author ?? "Not recorded"}</dd>
                <dt>Last changed</dt>
                <dd>{when(item.updated_at)}</dd>
              </dl>
              {(staff ||
                (item.author_id === me.id && item.status === "draft")) && (
                <button
                  class="button button--danger button--small"
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete "${item.body.title}"? This cannot be undone.${item.status === "published" ? " It will disappear from the site." : ""}`,
                      )
                    ) {
                      void api("DELETE", `/items/${item.id}`).then(
                        () => location.assign(cfg.path),
                        (e: unknown) => setError(messageFrom(e)),
                      );
                    }
                  }}
                >
                  Delete this {cfg.one}
                </button>
              )}
            </section>
          )}
        </aside>

        <div class="workspace-doc">
          {editable ? (
            <form onSubmit={save}>
              {kind === "document" && (
                <div class="field">
                  <label for="file">The file</label>
                  {typeof body.file_name === "string" && body.file_name ? (
                    <p>
                      <strong>{body.file_name}</strong>{" "}
                      {typeof body.file_id === "string" && body.file_id && (
                        <a
                          href={`/api/files/${body.file_id}/content`}
                          target="_blank"
                          rel="noopener"
                        >
                          Open
                        </a>
                      )}
                    </p>
                  ) : (
                    <p class="hint">No file yet.</p>
                  )}
                  <input
                    id="file"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    disabled={uploading}
                    onChange={(e) =>
                      e.currentTarget.files?.[0] &&
                      void upload(e.currentTarget.files[0])
                    }
                  />
                  <span class="hint">
                    PDF, JPEG or PNG, up to 20 MB. {uploading && "Uploading…"}
                  </span>
                </div>
              )}
              <Fields
                fields={cfg.fields}
                value={body}
                onChange={(next) => (
                  setBody(next),
                  setDirty(true),
                  setSaved("")
                )}
                idPrefix="f"
              />
              <div class="actions">
                <button
                  class="button"
                  type="submit"
                  disabled={item ? !dirty : false}
                >
                  {item ? "Save changes" : "Save as draft"}
                </button>
                {dirty && <span class="meta">Unsaved changes</span>}
              </div>
            </form>
          ) : (
            <>
              <p class="notice">
                You can read this {cfg.one} but not change it.{" "}
                {item?.status === "published"
                  ? "Published items are changed by the secretary or an administrator."
                  : "Only its author can change it."}
              </p>
              <Why title="Why can't I edit this?">
                <p>
                  Editors change their own drafts. Once something is published,
                  the secretary or an administrator makes changes so the public
                  site stays consistent.
                </p>
              </Why>
              <dl class="minutes-facts">
                {cfg.fields.map((f) => (
                  <>
                    <dt>{f.label}</dt>
                    <dd>{String(body[f.key] ?? "")}</dd>
                  </>
                ))}
              </dl>
            </>
          )}
        </div>
      </div>
    </>
  );
}
