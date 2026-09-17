import { MINUTES_STATES, type MinutesBody } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import {
  type AgendaResponse,
  api,
  can,
  longDate,
  type MinutesResponse,
  param,
  personName,
  statusLabel,
  typeLabel,
  when,
} from "../lib/api.ts";
import { useMe } from "../lib/use-me.ts";
import { MinutesEditor } from "./MinutesEditor.tsx";
import { MinutesView } from "./MinutesView.tsx";
import { ErrorNotice, Loading, Saved } from "./Notice.tsx";

type Loaded = Extract<MinutesResponse, { minutes: object }>;

export default function Minutes() {
  const id = param("id");
  const { me } = useMe();
  const [data, setData] = useState<MinutesResponse | null>(null);
  const [draft, setDraft] = useState<MinutesBody | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = async () => {
    const d = await api<MinutesResponse>("GET", `/meetings/${id}/minutes`);
    setData(d);
    setDraft(d.minutes ? d.current.body : null);
    setDirty(false);
  };
  useEffect(() => void load().catch((e: Error) => setError(e.message)), []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setError("");
    setSaved("");
    try {
      await fn();
      await load();
      setSaved(done);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!data) return error ? <ErrorNotice message={error} /> : <Loading />;
  const m = data.meeting;
  const secretary = can(me, "admin", "secretary");
  const heading = (
    <>
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/meetings/">Meetings</a> /{" "}
        <a href={`/meeting/?id=${m.id}`}>{longDate(m.date)}</a>
      </nav>
      <h1>
        Minutes: {typeLabel[m.type]}, {longDate(m.date)}
      </h1>
    </>
  );

  if (!data.minutes) {
    const start = async () => {
      const agenda = await api<AgendaResponse>("GET", `/meetings/${id}/agenda`);
      const items = (agenda.current?.body.items ?? []).map((it) => ({
        id: it.id,
        title: it.title,
        discussion: "",
        motions: [],
      }));
      const body: MinutesBody = {
        called_to_order: "",
        presiding: "",
        recorded_by: me?.name ?? "",
        present: [],
        absent: [],
        guests: "",
        quorum: false,
        items,
        adjourned_at: "",
      };
      await api("PUT", `/meetings/${id}/minutes`, {
        base_version: 0,
        body,
        change_note: "Started from the agenda",
      });
    };
    return (
      <>
        {heading}
        <ErrorNotice message={error} />
        <p>No minutes have been started for this meeting.</p>
        {secretary && (
          <button
            class="button"
            type="button"
            onClick={() => act(start, "Minutes started from the agenda.")}
          >
            Start minutes from the agenda
          </button>
        )}
      </>
    );
  }

  const d = data as Loaded;
  const status = d.minutes.status;
  const editable =
    secretary &&
    (status === "draft" ||
      status === "in_review" ||
      status === "ready_for_vote");
  const stepIndex = MINUTES_STATES.indexOf(status);
  const reviewedByMe = d.reviewed_by.some((r) => r.user_id === me?.id);

  return (
    <>
      {heading}
      <ol class="steps" aria-label="Progress">
        {MINUTES_STATES.map((s, i) => (
          <li
            class={i < stepIndex ? "done" : undefined}
            aria-current={i === stepIndex ? "step" : undefined}
          >
            {statusLabel[s]}
          </li>
        ))}
      </ol>
      <ErrorNotice message={error} />
      <Saved message={saved} />

      <div class="workspace">
        <div>
          <p class="meta">
            Version {d.current.version}, saved {when(d.current.created_at)}.
          </p>
          {editable && draft ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  const r = await api<{ version: number; unchanged?: boolean }>(
                    "PUT",
                    `/meetings/${id}/minutes`,
                    {
                      base_version: d.current.version,
                      body: draft,
                      change_note: changeNote || undefined,
                    },
                  );
                  setChangeNote("");
                  if (r.unchanged)
                    throw new Error("Nothing changed since the last version.");
                }, "Saved a new version.");
              }}
            >
              <MinutesEditor
                body={draft}
                onChange={(b) => {
                  setDraft(b);
                  setDirty(true);
                  setSaved("");
                }}
              />
              <div class="field">
                <label for="change-note">What changed</label>
                <input
                  id="change-note"
                  type="text"
                  placeholder="For example: added the vendor's name"
                  value={changeNote}
                  onInput={(e) => setChangeNote(e.currentTarget.value)}
                />
              </div>
              <div class="actions">
                <button class="button" type="submit" disabled={!dirty}>
                  Save a new version
                </button>
                {dirty && <span class="meta">Unsaved changes</span>}
              </div>
            </form>
          ) : (
            <MinutesView body={d.current.body} />
          )}
        </div>

        <aside>
          <section class="panel">
            <h2>Status: {statusLabel[status]}</h2>
            {status === "draft" && (
              <p>
                Only the secretary is working on these. Send them for review
                when they are ready for the board to read.
              </p>
            )}
            {status === "in_review" && (
              <p>
                Board members read, comment, and mark them reviewed. Every save
                makes a new version.
              </p>
            )}
            {status === "ready_for_vote" && (
              <p>
                At the meeting, record the vote. Changes made at the meeting
                create a new version, and the vote applies to the latest one.
              </p>
            )}
            {status === "approved" && (
              <p>
                Locked. Export the PDF, upload it to PayHOA, then mark it filed.
              </p>
            )}
            {status === "filed" && (
              <p>
                Uploaded to PayHOA{" "}
                {d.minutes.filed_at && when(d.minutes.filed_at)}.{" "}
                {d.minutes.filed_note}
              </p>
            )}
            {secretary && (
              <div class="actions">
                {status === "draft" && (
                  <button
                    class="button button--small"
                    type="button"
                    disabled={dirty}
                    onClick={() =>
                      act(
                        () =>
                          api("POST", `/meetings/${id}/minutes/transition`, {
                            to: "in_review",
                          }),
                        "Sent to the board for review.",
                      )
                    }
                  >
                    Send for review
                  </button>
                )}
                {status === "in_review" && (
                  <>
                    <button
                      class="button button--small"
                      type="button"
                      disabled={dirty}
                      onClick={() =>
                        act(
                          () =>
                            api("POST", `/meetings/${id}/minutes/transition`, {
                              to: "ready_for_vote",
                            }),
                          "Ready for a vote.",
                        )
                      }
                    >
                      Ready for a vote
                    </button>
                    <button
                      class="button button--quiet button--small"
                      type="button"
                      onClick={() =>
                        act(
                          () =>
                            api("POST", `/meetings/${id}/minutes/transition`, {
                              to: "draft",
                            }),
                          "Moved back to draft.",
                        )
                      }
                    >
                      Back to draft
                    </button>
                  </>
                )}
                {status === "ready_for_vote" && (
                  <button
                    class="button button--quiet button--small"
                    type="button"
                    onClick={() =>
                      act(
                        () =>
                          api("POST", `/meetings/${id}/minutes/transition`, {
                            to: "in_review",
                          }),
                        "Moved back to review.",
                      )
                    }
                  >
                    Back to review
                  </button>
                )}
              </div>
            )}
            {dirty && (
              <p class="meta">Save your changes before changing the status.</p>
            )}
          </section>

          {(status === "in_review" || status === "ready_for_vote") && (
            <section class="panel">
              <h2>Reviewed version {d.current.version}</h2>
              {d.reviewed_by.length === 0 ? (
                <p>Nobody yet.</p>
              ) : (
                <ul>
                  {d.reviewed_by.map((r) => (
                    <li>{personName(r.name, r.former)}</li>
                  ))}
                </ul>
              )}
              {can(me, "board", "secretary", "admin") && !reviewedByMe && (
                <button
                  class="button button--small"
                  type="button"
                  onClick={() =>
                    act(
                      () => api("POST", `/meetings/${id}/minutes/reviewed`),
                      "Marked as reviewed.",
                    )
                  }
                >
                  I have reviewed this version
                </button>
              )}
            </section>
          )}

          {status === "ready_for_vote" &&
            can(me, "board", "secretary", "admin") && (
              <VoteForm
                d={d}
                disabled={dirty}
                onVote={(v) =>
                  act(
                    () => api("POST", `/meetings/${id}/minutes/vote`, v),
                    "Approved. The minutes are now locked.",
                  )
                }
              />
            )}

          {(status === "approved" || status === "filed") && (
            <section class="panel">
              <h2>PayHOA</h2>
              <p>
                <a
                  class="button button--small"
                  href={`/minutes/print/?id=${id}`}
                  target="_blank"
                  rel="noopener"
                >
                  Export PDF
                </a>
              </p>
              {d.vote && (
                <p class="meta">
                  Approved {longDate(d.vote.voted_on)}: {d.vote.yes} in favor,{" "}
                  {d.vote.no} against, {d.vote.abstain} abstaining.
                </p>
              )}
              {status === "approved" && secretary && (
                <FileForm
                  onFile={(note) =>
                    act(
                      () =>
                        api("POST", `/meetings/${id}/minutes/file`, { note }),
                      "Marked as filed in PayHOA.",
                    )
                  }
                />
              )}
            </section>
          )}

          <Comments
            d={d}
            canComment={
              editable ||
              (can(me, "board", "reviewer") &&
                status !== "approved" &&
                status !== "filed")
            }
            meId={me?.id}
            secretary={secretary}
            act={act}
          />

          <section class="panel">
            <h2>Versions</h2>
            <ol reversed>
              {d.versions.map((v) => (
                <li>
                  Version {v.version}, {when(v.created_at)}
                  {v.author && ` by ${personName(v.author, v.author_former)}`}
                  {v.change_note && <div class="meta">{v.change_note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

function VoteForm({
  d,
  disabled,
  onVote,
}: {
  d: Loaded;
  disabled: boolean;
  onVote: (v: object) => void;
}) {
  const [v, setV] = useState({
    voted_on: new Date().toISOString().slice(0, 10),
    motion_by: "",
    seconded_by: "",
    yes: 0,
    no: 0,
    abstain: 0,
  });
  const num = (s: string) => Math.max(0, Number.parseInt(s, 10) || 0);
  return (
    <form
      class="panel"
      onSubmit={(e) => {
        e.preventDefault();
        onVote({ ...v, version: d.current.version, sha256: d.current.sha256 });
      }}
    >
      <h2>Record the vote</h2>
      <p class="meta">
        This vote applies to version {d.current.version} exactly. If anyone
        saves a change first, you will be asked to reload.
      </p>
      <div class="field">
        <label for="v-date">Date of the vote</label>
        <input
          id="v-date"
          type="date"
          required
          value={v.voted_on}
          onInput={(e) => setV({ ...v, voted_on: e.currentTarget.value })}
        />
      </div>
      <div class="field">
        <label for="v-moved">Motion to approve moved by</label>
        <input
          id="v-moved"
          type="text"
          required
          value={v.motion_by}
          onInput={(e) => setV({ ...v, motion_by: e.currentTarget.value })}
        />
      </div>
      <div class="field">
        <label for="v-second">Seconded by</label>
        <input
          id="v-second"
          type="text"
          required
          value={v.seconded_by}
          onInput={(e) => setV({ ...v, seconded_by: e.currentTarget.value })}
        />
      </div>
      <div class="row">
        {(["yes", "no", "abstain"] as const).map((f) => (
          <div class="field">
            <label for={`v-${f}`}>
              {f === "yes" ? "In favor" : f === "no" ? "Against" : "Abstaining"}
            </label>
            <input
              id={`v-${f}`}
              type="number"
              min={0}
              required
              value={v[f]}
              onInput={(e) => setV({ ...v, [f]: num(e.currentTarget.value) })}
            />
          </div>
        ))}
      </div>
      <button class="button" type="submit" disabled={disabled}>
        Record vote and approve
      </button>
    </form>
  );
}

function FileForm({ onFile }: { onFile: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onFile(note);
      }}
    >
      <div class="field">
        <label for="file-note">Where it was uploaded</label>
        <input
          id="file-note"
          type="text"
          placeholder="PayHOA > Documents > Minutes"
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </div>
      <button class="button button--small" type="submit">
        Mark as uploaded to PayHOA
      </button>
    </form>
  );
}

function Comments({
  d,
  canComment,
  meId,
  secretary,
  act,
}: {
  d: Loaded;
  canComment: boolean;
  meId: string | undefined;
  secretary: boolean;
  act: (fn: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState("");
  const [text, setText] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const titleFor = (a: string) =>
    d.current.body.items.find((it) => it.id === a)?.title;
  const visible = d.comments.filter((c) => showResolved || !c.resolved_at);
  const id = d.meeting.id;

  return (
    <section class="panel">
      <h2>Comments ({d.comments.filter((c) => !c.resolved_at).length} open)</h2>
      {visible.map((c) => (
        <div class={c.resolved_at ? "comment comment--resolved" : "comment"}>
          <p>{c.body}</p>
          <p class="meta">
            {personName(c.author, c.author_former)}, on version {c.version}
            {c.anchor && titleFor(c.anchor)
              ? `, about "${titleFor(c.anchor)}"`
              : ""}
            . {when(c.created_at)}
            {c.resolved_at && ". Resolved"}
          </p>
          {!c.resolved_at && (secretary || c.author_id === meId) && (
            <button
              class="button button--quiet button--small"
              type="button"
              onClick={() =>
                act(
                  () =>
                    api(
                      "POST",
                      `/meetings/${id}/minutes/comments/${c.id}/resolve`,
                    ),
                  "Comment resolved.",
                )
              }
            >
              Resolve
            </button>
          )}
        </div>
      ))}
      {d.comments.some((c) => c.resolved_at) && (
        <p>
          <button
            class="button button--quiet button--small"
            type="button"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
        </p>
      )}
      {canComment && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              () =>
                api("POST", `/meetings/${id}/minutes/comments`, {
                  anchor,
                  body: text,
                }),
              "Comment added.",
            ).then(() => setText(""));
          }}
        >
          <div class="field">
            <label for="c-anchor">About</label>
            <select
              id="c-anchor"
              value={anchor}
              onChange={(e) => setAnchor(e.currentTarget.value)}
            >
              <option value="">The minutes in general</option>
              {d.current.body.items.map((it, i) => (
                <option value={it.id}>
                  Item {i + 1}: {it.title}
                </option>
              ))}
            </select>
          </div>
          <div class="field">
            <label for="c-text">Comment</label>
            <textarea
              id="c-text"
              rows={3}
              required
              value={text}
              onInput={(e) => setText(e.currentTarget.value)}
            />
          </div>
          <button class="button button--small" type="submit">
            Add comment
          </button>
        </form>
      )}
    </section>
  );
}
