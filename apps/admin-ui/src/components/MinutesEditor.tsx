import type { MinutesBody } from "@dhoa/shared";
import { newId } from "../lib/api.ts";
import { AttendancePicker, NamePicker } from "./NamePicker.tsx";

type Motion = MinutesBody["items"][number]["motions"][number];

export function MinutesEditor({
  body,
  onChange,
  directors,
  everyone,
}: {
  body: MinutesBody;
  onChange: (b: MinutesBody) => void;
  /** Names of directors serving now, for attendance. */
  directors: string[];
  /** Everyone on the roster, for pickers. */
  everyone: string[];
}) {
  const set = (patch: Partial<MinutesBody>) => onChange({ ...body, ...patch });
  /** A motion recorded as tabled is a follow-up; pre-select it once. */
  const afterMotionChange = (i: number, motions: Motion[]) => {
    const item = body.items[i]!;
    const tabled = motions.some((m) => m.result === "tabled");
    return tabled && item.outcome === "closed"
      ? { motions, outcome: "follow_up" as const }
      : { motions };
  };

  const setItem = (i: number, patch: Partial<MinutesBody["items"][number]>) =>
    set({
      items: body.items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    });
  const setMotion = (i: number, k: number, patch: Partial<Motion>) =>
    setItem(
      i,
      afterMotionChange(
        i,
        body.items[i]!.motions.map((mo, j) =>
          j === k ? { ...mo, ...patch } : mo,
        ),
      ),
    );
  const num = (v: string) => Math.max(0, Number.parseInt(v, 10) || 0);

  return (
    <div class="minutes-editor">
      <fieldset>
        <legend>Opening</legend>
        <div class="row">
          <div class="field">
            <label for="called">Called to order at</label>
            <input
              id="called"
              type="text"
              placeholder="7:02 pm"
              value={body.called_to_order}
              onInput={(e) => set({ called_to_order: e.currentTarget.value })}
            />
          </div>
          <NamePicker
            id="presiding"
            label="Presiding"
            value={body.presiding}
            names={everyone}
            onChange={(v) => set({ presiding: v })}
          />
          <NamePicker
            id="recorded"
            label="Recorded by"
            value={body.recorded_by}
            names={everyone}
            onChange={(v) => set({ recorded_by: v })}
          />
        </div>
        <div class="row">
          <AttendancePicker
            id="present"
            label="Directors present"
            value={body.present}
            names={directors}
            onChange={(v) =>
              set({
                present: v,
                absent: body.absent.filter((n) => !v.includes(n)),
              })
            }
          />
          <AttendancePicker
            id="absent"
            label="Directors absent"
            value={body.absent}
            names={directors.filter((n) => !body.present.includes(n))}
            onChange={(v) => set({ absent: v })}
          />
        </div>
        <div class="field">
          <label for="guests">Also present</label>
          <input
            id="guests"
            type="text"
            placeholder="Residents, the manager, guests"
            value={body.guests}
            onInput={(e) => set({ guests: e.currentTarget.value })}
          />
        </div>
        <div>
          <input
            id="quorum"
            type="checkbox"
            checked={body.quorum}
            onChange={(e) => set({ quorum: e.currentTarget.checked })}
          />{" "}
          <label for="quorum">A quorum was present</label>
        </div>
      </fieldset>

      {body.items.map((it, i) => (
        <fieldset key={it.id} id={`item-${it.id}`}>
          <legend>Item {i + 1}</legend>
          <div class="field">
            <label for={`title-${it.id}`}>Title</label>
            <input
              id={`title-${it.id}`}
              type="text"
              required
              value={it.title}
              onInput={(e) => setItem(i, { title: e.currentTarget.value })}
            />
          </div>
          <div class="field">
            <label for={`disc-${it.id}`}>Discussion</label>
            <textarea
              id={`disc-${it.id}`}
              rows={5}
              value={it.discussion}
              onInput={(e) => setItem(i, { discussion: e.currentTarget.value })}
            />
            <span class="hint">Leave a blank line between paragraphs</span>
          </div>
          {/*
           * What happens to this item after the meeting. Anything not closed
           * is offered on the next meeting's agenda, so this is the one field
           * that saves someone rebuilding the agenda from memory.
           */}
          <div class="row">
            <div class="field">
              <label for={`outcome-${it.id}`}>After the meeting</label>
              <select
                id={`outcome-${it.id}`}
                value={it.outcome}
                onInput={(e) =>
                  setItem(i, {
                    outcome: e.currentTarget
                      .value as MinutesBody["items"][number]["outcome"],
                  })
                }
              >
                <option value="closed">Closed</option>
                <option value="follow_up">Follow up</option>
                <option value="deferred">Deferred</option>
              </select>
              <span class="hint">
                {it.outcome === "closed"
                  ? "Nothing carries to the next meeting"
                  : it.outcome === "follow_up"
                    ? "Decided, but someone must act — offered on the next agenda"
                    : "Not reached — offered on the next agenda"}
              </span>
            </div>
            {it.outcome !== "closed" && (
              <>
                <NamePicker
                  id={`owner-${it.id}`}
                  label="Who is carrying it"
                  value={it.follow_up_owner}
                  names={everyone}
                  onChange={(v) => setItem(i, { follow_up_owner: v })}
                />
                <div class="field">
                  <label for={`fnote-${it.id}`}>What is waiting on</label>
                  <input
                    id={`fnote-${it.id}`}
                    type="text"
                    value={it.follow_up_note}
                    placeholder="Waiting on a second quote"
                    onInput={(e) =>
                      setItem(i, { follow_up_note: e.currentTarget.value })
                    }
                  />
                </div>
              </>
            )}
          </div>
          {it.motions.map((mo, k) => (
            <div class="motion" key={k}>
              <div class="field">
                <label for={`mt-${it.id}-${k}`}>Motion</label>
                <textarea
                  id={`mt-${it.id}-${k}`}
                  rows={2}
                  required
                  value={mo.text}
                  onInput={(e) =>
                    setMotion(i, k, { text: e.currentTarget.value })
                  }
                />
              </div>
              <div class="row">
                <NamePicker
                  id={`mb-${it.id}-${k}`}
                  label="Moved by"
                  value={mo.moved_by}
                  names={everyone}
                  required
                  onChange={(v) => setMotion(i, k, { moved_by: v })}
                />
                <NamePicker
                  id={`ms-${it.id}-${k}`}
                  label="Seconded by"
                  value={mo.seconded_by}
                  names={everyone}
                  onChange={(v) => setMotion(i, k, { seconded_by: v })}
                />
                <div class="field">
                  <label for={`mr-${it.id}-${k}`}>Result</label>
                  <select
                    id={`mr-${it.id}-${k}`}
                    value={mo.result}
                    onChange={(e) =>
                      setMotion(i, k, {
                        result: e.currentTarget.value as Motion["result"],
                      })
                    }
                  >
                    <option value="carried">Carried</option>
                    <option value="failed">Failed</option>
                    <option value="tabled">Tabled</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
              </div>
              <div class="row row--counts">
                {(["yes", "no", "abstain"] as const).map((f) => (
                  <div class="field" key={f}>
                    <label for={`m${f}-${it.id}-${k}`}>
                      {f === "yes"
                        ? "In favor"
                        : f === "no"
                          ? "Against"
                          : "Abstaining"}
                    </label>
                    <input
                      id={`m${f}-${it.id}-${k}`}
                      type="number"
                      min={0}
                      value={mo[f]}
                      onInput={(e) =>
                        setMotion(i, k, { [f]: num(e.currentTarget.value) })
                      }
                    />
                  </div>
                ))}
              </div>
              <button
                class="button button--danger button--small"
                type="button"
                onClick={() =>
                  setItem(i, { motions: it.motions.filter((_, j) => j !== k) })
                }
              >
                Remove motion
              </button>
            </div>
          ))}
          <div class="actions">
            <button
              class="button button--quiet button--small"
              type="button"
              onClick={() =>
                setItem(i, {
                  motions: [
                    ...it.motions,
                    {
                      text: "",
                      moved_by: "",
                      seconded_by: "",
                      result: "carried",
                      yes: 0,
                      no: 0,
                      abstain: 0,
                    },
                  ],
                })
              }
            >
              Add a motion
            </button>
            <button
              class="button button--danger button--small"
              type="button"
              onClick={() =>
                set({ items: body.items.filter((_, j) => j !== i) })
              }
            >
              Remove item
            </button>
          </div>
        </fieldset>
      ))}
      <p>
        <button
          class="button button--quiet"
          type="button"
          onClick={() =>
            set({
              items: [
                ...body.items,
                {
                  id: newId(),
                  title: "",
                  discussion: "",
                  motions: [],
                  outcome: "closed" as const,
                  follow_up_owner: "",
                  follow_up_note: "",
                },
              ],
            })
          }
        >
          Add an item
        </button>
      </p>
      <div class="field">
        <label for="adjourned">Adjourned at</label>
        <input
          id="adjourned"
          type="text"
          placeholder="8:15 pm"
          value={body.adjourned_at}
          onInput={(e) => set({ adjourned_at: e.currentTarget.value })}
        />
      </div>
    </div>
  );
}
