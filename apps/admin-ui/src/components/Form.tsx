import {
  type Field,
  blank,
  fromLocalInput,
  get,
  set,
  toLocalInput,
} from "../lib/fields.ts";

type Props = {
  fields: Field[];
  value: unknown;
  onChange: (next: Record<string, unknown>) => void;
  idPrefix: string;
};

const inputType: Record<string, string> = {
  text: "text",
  email: "email",
  url: "url",
  phone: "tel",
  date: "date",
  time: "text",
};

/** Renders a form from a field description. Every input has a label; help text sits under it. */
export function Fields({ fields, value, onChange, idPrefix }: Props) {
  const update = (key: string, v: unknown) => onChange(set(value, key, v));
  return (
    <>
      {fields.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const v = get(value, f.key);
        const help = f.help ? (
          <span class="hint" id={`${id}-help`}>
            {f.help}
          </span>
        ) : null;
        const describedBy = f.help ? `${id}-help` : undefined;
        switch (f.kind) {
          case "text":
          case "email":
          case "url":
          case "phone":
          case "date":
          case "time":
            return (
              <div class="field" key={f.key}>
                <label for={id}>{f.label}</label>
                <input
                  id={id}
                  type={inputType[f.kind]}
                  value={String(v ?? "")}
                  required={f.required}
                  placeholder={f.placeholder}
                  aria-describedby={describedBy}
                  onInput={(e) => update(f.key, e.currentTarget.value)}
                />
                {help}
              </div>
            );
          case "datetime":
            return (
              <div class="field" key={f.key}>
                <label for={id}>{f.label}</label>
                <input
                  id={id}
                  type="datetime-local"
                  value={toLocalInput(String(v ?? ""))}
                  required={f.required}
                  aria-describedby={describedBy}
                  onInput={(e) =>
                    update(f.key, fromLocalInput(e.currentTarget.value))
                  }
                />
                {help}
              </div>
            );
          case "textarea":
          case "markdown":
            return (
              <div class="field" key={f.key}>
                <label for={id}>{f.label}</label>
                <textarea
                  id={id}
                  rows={f.rows ?? (f.kind === "markdown" ? 10 : 3)}
                  value={String(v ?? "")}
                  required={f.required}
                  placeholder={f.placeholder}
                  aria-describedby={describedBy}
                  onInput={(e) => update(f.key, e.currentTarget.value)}
                />
                {help}
                {f.kind === "markdown" && (
                  <details class="help-details">
                    <summary>Formatting tips</summary>
                    <ul>
                      <li>Leave a blank line between paragraphs.</li>
                      <li>
                        Start a line with "## " for a heading, or "- " for a
                        bullet.
                      </li>
                      <li>
                        Bold: **like this**. A link:
                        [words](https://example.com).
                      </li>
                      <li>
                        Write {"{{email:general}}"} for the office email, or{" "}
                        {"{{phone:office}}"} for the office phone, so they are
                        never out of date.
                      </li>
                    </ul>
                  </details>
                )}
              </div>
            );
          case "number":
            return (
              <div class="field" key={f.key}>
                <label for={id}>{f.label}</label>
                <input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={f.min}
                  max={f.max}
                  step={f.step ?? "any"}
                  value={String(v ?? "")}
                  aria-describedby={describedBy}
                  onInput={(e) =>
                    update(
                      f.key,
                      e.currentTarget.value === ""
                        ? ""
                        : Number(e.currentTarget.value),
                    )
                  }
                />
                {help}
              </div>
            );
          case "boolean":
            return (
              <div class="choice" key={f.key}>
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(v)}
                  aria-describedby={describedBy}
                  onChange={(e) => update(f.key, e.currentTarget.checked)}
                />
                <label for={id}>
                  <strong>{f.label}</strong>
                  {f.help && (
                    <span class="meta" id={`${id}-help`}>
                      {f.help}
                    </span>
                  )}
                </label>
              </div>
            );
          case "select":
            return (
              <div class="field" key={f.key}>
                <label for={id}>{f.label}</label>
                <select
                  id={id}
                  value={String(v ?? "")}
                  aria-describedby={describedBy}
                  onChange={(e) =>
                    update(
                      f.key,
                      f.numeric
                        ? Number(e.currentTarget.value)
                        : e.currentTarget.value,
                    )
                  }
                >
                  {f.options.map((o) => (
                    <option value={o.value}>{o.label}</option>
                  ))}
                </select>
                {help}
              </div>
            );
          case "strings": {
            const items = Array.isArray(v) ? (v as string[]) : [];
            return (
              <fieldset key={f.key} class="list-field">
                <legend>{f.label}</legend>
                {help}
                {items.map((s, i) => (
                  <div class="list-row" key={i}>
                    <label class="visually-hidden" for={`${id}-${i}`}>
                      {f.itemLabel} {i + 1}
                    </label>
                    <input
                      id={`${id}-${i}`}
                      type="text"
                      value={s}
                      placeholder={f.placeholder}
                      onInput={(e) =>
                        update(
                          f.key,
                          items.map((x, j) =>
                            j === i ? e.currentTarget.value : x,
                          ),
                        )
                      }
                    />
                    <button
                      class="button button--quiet button--small"
                      type="button"
                      aria-label={`Remove ${f.itemLabel.toLowerCase()} ${i + 1}`}
                      onClick={() =>
                        update(
                          f.key,
                          items.filter((_, j) => j !== i),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  class="button button--quiet button--small"
                  type="button"
                  onClick={() => update(f.key, [...items, ""])}
                >
                  Add {f.itemLabel.toLowerCase()}
                </button>
              </fieldset>
            );
          }
          case "list": {
            const rows = Array.isArray(v)
              ? (v as Record<string, unknown>[])
              : [];
            const move = (i: number, by: number) => {
              const next = [...rows];
              const [row] = next.splice(i, 1);
              next.splice(i + by, 0, row!);
              update(f.key, next);
            };
            return (
              <fieldset key={f.key} class="list-field">
                <legend>{f.label}</legend>
                {help}
                {rows.map((row, i) => (
                  <details class="list-item" key={i} open={rows.length <= 3}>
                    <summary>
                      {f.itemLabel} {i + 1}
                      {f.summary &&
                        (f.summary(row) ? `: ${f.summary(row)}` : "")}
                    </summary>
                    <Fields
                      fields={f.fields}
                      value={row}
                      onChange={(next) =>
                        update(
                          f.key,
                          rows.map((x, j) => (j === i ? next : x)),
                        )
                      }
                      idPrefix={`${id}-${i}`}
                    />
                    <div class="actions">
                      <button
                        class="button button--quiet button--small"
                        type="button"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        Move up
                      </button>
                      <button
                        class="button button--quiet button--small"
                        type="button"
                        disabled={i === rows.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        Move down
                      </button>
                      <button
                        class="button button--danger button--small"
                        type="button"
                        onClick={() =>
                          confirm(
                            `Remove ${f.itemLabel.toLowerCase()} ${i + 1}?`,
                          ) &&
                          update(
                            f.key,
                            rows.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </details>
                ))}
                <button
                  class="button button--quiet button--small"
                  type="button"
                  onClick={() =>
                    update(f.key, [
                      ...rows,
                      blank({
                        kind: "group",
                        key: "",
                        label: "",
                        fields: f.fields,
                      }),
                    ])
                  }
                >
                  Add {f.itemLabel.toLowerCase()}
                </button>
              </fieldset>
            );
          }
          case "group":
            return (
              <fieldset key={f.key}>
                <legend>{f.label}</legend>
                {help}
                <Fields
                  fields={f.fields}
                  value={v ?? blank(f)}
                  onChange={(next) => update(f.key, next)}
                  idPrefix={id}
                />
              </fieldset>
            );
          case "record": {
            const entries = Object.entries((v as Record<string, string>) ?? {});
            const commit = (next: [string, string][]) =>
              update(f.key, Object.fromEntries(next));
            return (
              <fieldset key={f.key} class="list-field">
                <legend>{f.label}</legend>
                {help}
                {entries.map(([k, val], i) => (
                  <div class="list-row list-row--pair" key={i}>
                    <div class="field">
                      <label for={`${id}-${i}-k`}>{f.keyLabel}</label>
                      <input
                        id={`${id}-${i}-k`}
                        type="text"
                        value={k}
                        onInput={(e) =>
                          commit(
                            entries.map((en, j) =>
                              j === i ? [e.currentTarget.value, en[1]] : en,
                            ),
                          )
                        }
                      />
                    </div>
                    <div class="field">
                      <label for={`${id}-${i}-v`}>{f.valueLabel}</label>
                      <input
                        id={`${id}-${i}-v`}
                        type={f.valueKind}
                        value={val}
                        onInput={(e) =>
                          commit(
                            entries.map((en, j) =>
                              j === i ? [en[0], e.currentTarget.value] : en,
                            ),
                          )
                        }
                      />
                    </div>
                    <button
                      class="button button--quiet button--small"
                      type="button"
                      aria-label={`Remove ${k || "entry"}`}
                      onClick={() => commit(entries.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  class="button button--quiet button--small"
                  type="button"
                  onClick={() => commit([...entries, ["", ""]])}
                >
                  Add {f.valueLabel.toLowerCase()}
                </button>
              </fieldset>
            );
          }
        }
      })}
    </>
  );
}
