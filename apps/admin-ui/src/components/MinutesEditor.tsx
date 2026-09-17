import type { MinutesBody } from "@dhoa/shared";
import { newId } from "../lib/api.ts";

type Motion = MinutesBody["items"][number]["motions"][number];
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function MinutesEditor({
  body,
  onChange,
}: {
  body: MinutesBody;
  onChange: (b: MinutesBody) => void;
}) {
  const set = (patch: Partial<MinutesBody>) => onChange({ ...body, ...patch });
  const setItem = (i: number, patch: Partial<MinutesBody["items"][number]>) =>
    set({
      items: body.items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    });
  const setMotion = (i: number, k: number, patch: Partial<Motion>) =>
    setItem(i, {
      motions: body.items[i]!.motions.map((mo, j) =>
        j === k ? { ...mo, ...patch } : mo,
      ),
    });
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
          <div class="field">
            <label for="presiding">Presiding</label>
            <input
              id="presiding"
              type="text"
              value={body.presiding}
              onInput={(e) => set({ presiding: e.currentTarget.value })}
            />
          </div>
          <div class="field">
            <label for="recorded">Recorded by</label>
            <input
              id="recorded"
              type="text"
              value={body.recorded_by}
              onInput={(e) => set({ recorded_by: e.currentTarget.value })}
            />
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label for="present">Directors present</label>
            <textarea
              id="present"
              rows={4}
              value={body.present.join("\n")}
              onInput={(e) => set({ present: lines(e.currentTarget.value) })}
            />
            <span class="hint">One name per line</span>
          </div>
          <div class="field">
            <label for="absent">Directors absent</label>
            <textarea
              id="absent"
              rows={4}
              value={body.absent.join("\n")}
              onInput={(e) => set({ absent: lines(e.currentTarget.value) })}
            />
            <span class="hint">One name per line</span>
          </div>
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
          {it.motions.map((mo, k) => (
            <div class="motion">
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
                <div class="field">
                  <label for={`mb-${it.id}-${k}`}>Moved by</label>
                  <input
                    id={`mb-${it.id}-${k}`}
                    type="text"
                    required
                    value={mo.moved_by}
                    onInput={(e) =>
                      setMotion(i, k, { moved_by: e.currentTarget.value })
                    }
                  />
                </div>
                <div class="field">
                  <label for={`ms-${it.id}-${k}`}>Seconded by</label>
                  <input
                    id={`ms-${it.id}-${k}`}
                    type="text"
                    value={mo.seconded_by}
                    onInput={(e) =>
                      setMotion(i, k, { seconded_by: e.currentTarget.value })
                    }
                  />
                </div>
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
                  <div class="field">
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
                { id: newId(), title: "", discussion: "", motions: [] },
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
