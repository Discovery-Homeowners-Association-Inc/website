import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
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

function RecordField({
  f,
  id,
  value,
  help,
  onCommit,
}: {
  f: Extract<Field, { kind: "record" }>;
  id: string;
  value: unknown;
  help: JSX.Element | null;
  onCommit: (v: Record<string, string>) => void;
}) {
  const fromValue = (v: unknown): [string, string][] =>
    Object.entries((v as Record<string, string>) ?? {});
  const [rows, setRows] = useState<[string, string][]>(() => fromValue(value));
  // A row with no key yet is being typed and is not saved. The saved value only
  // replaces these rows when it says something they do not.
  useEffect(() => {
    if (
      JSON.stringify(fromValue(value)) !==
      JSON.stringify(rows.filter(([k]) => k))
    )
      setRows(fromValue(value));
  }, [value]);
  const change = (next: [string, string][]) => {
    setRows(next);
    onCommit(Object.fromEntries(next.filter(([k]) => k)));
  };
  return (
    <fieldset class="list-field">
      <legend>{f.label}</legend>
      {help}
      {rows.map(([k, val], i) => (
        <div class="list-row list-row--pair" key={i}>
          <div class="field">
            <label for={`${id}-${i}-k`}>{f.keyLabel}</label>
            <input
              id={`${id}-${i}-k`}
              type="text"
              value={k}
              onInput={(e) =>
                change(
                  rows.map((r, j) =>
                    j === i ? [e.currentTarget.value, r[1]] : r,
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
                change(
                  rows.map((r, j) =>
                    j === i ? [r[0], e.currentTarget.value] : r,
                  ),
                )
              }
            />
          </div>
          <button
            class="button button--quiet button--small"
            type="button"
            aria-label={`Remove ${k || "entry"}`}
            onClick={() => change(rows.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        class="button button--quiet button--small"
        type="button"
        onClick={() => change([...rows, ["", ""]])}
      >
        Add {f.valueLabel.toLowerCase()}
      </button>
    </fieldset>
  );
}

/** The open set with row `i` gone: rows after it keep their state at one index lower. */
function withoutRow(open: Set<number>, i: number): Set<number> {
  const next = new Set<number>();
  for (const j of open) {
    if (j < i) next.add(j);
    else if (j > i) next.add(j - 1);
  }
  return next;
}

/** `i` and `j` trade their open/closed state, so it stays with the row that moved. */
function swapRows(open: Set<number>, i: number, j: number): Set<number> {
  const next = new Set(open);
  const iWasOpen = open.has(i);
  const jWasOpen = open.has(j);
  jWasOpen ? next.add(i) : next.delete(i);
  iWasOpen ? next.add(j) : next.delete(j);
  return next;
}

function ListField({
  f,
  id,
  value,
  help,
  onCommit,
}: {
  f: Extract<Field, { kind: "list" }>;
  id: string;
  value: unknown;
  help: JSX.Element | null;
  onCommit: (v: Record<string, unknown>[]) => void;
}) {
  const fromValue = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  const [rows, setRows] = useState<Record<string, unknown>[]>(() =>
    fromValue(value),
  );
  const [open, setOpen] = useState<Set<number>>(
    () => new Set(rows.length <= 3 ? rows.map((_, i) => i) : []),
  );
  useEffect(() => {
    if (JSON.stringify(fromValue(value)) !== JSON.stringify(rows))
      setRows(fromValue(value));
  }, [value]);
  const change = (next: Record<string, unknown>[]) => {
    setRows(next);
    onCommit(next);
  };
  const move = (i: number, by: number) => {
    const next = [...rows];
    const [row] = next.splice(i, 1);
    if (row === undefined) return;
    next.splice(i + by, 0, row);
    change(next);
    setOpen((s) => swapRows(s, i, i + by));
  };
  const removeRow = (i: number) => {
    if (!confirm(`Remove ${f.itemLabel.toLowerCase()} ${i + 1}?`)) return;
    change(rows.filter((_, j) => j !== i));
    setOpen((s) => withoutRow(s, i));
  };
  return (
    <fieldset class="list-field">
      <legend>{f.label}</legend>
      {help}
      {rows.map((row, i) => (
        <details
          class="list-item"
          key={i}
          open={open.has(i)}
          onToggle={(e) =>
            setOpen((s) => {
              const n = new Set(s);
              e.currentTarget.open ? n.add(i) : n.delete(i);
              return n;
            })
          }
        >
          <summary>
            {f.itemLabel} {i + 1}
            {f.summary && (f.summary(row) ? `: ${f.summary(row)}` : "")}
          </summary>
          <Fields
            fields={f.fields}
            value={row}
            onChange={(next) =>
              change(rows.map((x, j) => (j === i ? next : x)))
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
              onClick={() => removeRow(i)}
            >
              Remove
            </button>
          </div>
        </details>
      ))}
      <button
        class="button button--quiet button--small"
        type="button"
        onClick={() => {
          const i = rows.length;
          change([
            ...rows,
            blank({
              kind: "group",
              key: "",
              label: "",
              fields: f.fields,
            }) as Record<string, unknown>,
          ]);
          setOpen((s) => new Set(s).add(i));
        }}
      >
        Add {f.itemLabel.toLowerCase()}
      </button>
    </fieldset>
  );
}

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
                        never out of date. Use{" "}
                        {"{{setting:rv-lot.fees.monthly}}"} for a fact from Site
                        settings.
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
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
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
          case "list":
            return (
              <ListField
                key={f.key}
                f={f}
                id={id}
                value={v}
                help={help}
                onCommit={(next) => update(f.key, next)}
              />
            );
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
          case "record":
            return (
              <RecordField
                key={f.key}
                f={f}
                id={id}
                value={v}
                help={help}
                onCommit={(next) => update(f.key, next)}
              />
            );
        }
      })}
    </>
  );
}
