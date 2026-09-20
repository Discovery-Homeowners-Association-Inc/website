import { useState } from "preact/hooks";

/**
 * Picks a person from the roster, with "Someone else" for guests and
 * residents. The value is always a plain name, so minutes stay readable
 * whoever is on the board later.
 */
export function NamePicker({
  id,
  label,
  value,
  names,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  names: string[];
  onChange: (name: string) => void;
  required?: boolean;
}) {
  const known = names.includes(value);
  const [chosenOther, setChosenOther] = useState(false);
  /*
   * "Someone else" is shown when the person chose it, or when the saved value
   * is nobody on the roster -- judged only once the roster is known. Deciding
   * on first render decided before the roster had loaded, so every saved
   * director came back as a stranger with a text box.
   */
  const other = chosenOther || (!!value && !known && names.length > 0);
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <select
        id={id}
        value={other ? "__other" : value}
        required={required}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v === "__other") {
            setChosenOther(true);
            onChange("");
          } else {
            setChosenOther(false);
            onChange(v);
          }
        }}
      >
        <option value="">Choose…</option>
        {names.map((n) => (
          <option value={n}>{n}</option>
        ))}
        <option value="__other">Someone else…</option>
      </select>
      {other && (
        <>
          <label class="visually-hidden" for={`${id}-other`}>
            {label}, name
          </label>
          <input
            id={`${id}-other`}
            type="text"
            value={value}
            placeholder="Type their name"
            required={required}
            onInput={(e) => onChange(e.currentTarget.value)}
          />
        </>
      )}
    </div>
  );
}

/** A checklist of directors; anyone not on the roster can be added by name. */
export function AttendancePicker({
  id,
  label,
  value,
  names,
  onChange,
}: {
  id: string;
  label: string;
  value: string[];
  names: string[];
  onChange: (v: string[]) => void;
}) {
  const extra = value.filter((n) => !names.includes(n));
  const [typed, setTyped] = useState("");
  const toggle = (n: string, on: boolean) =>
    onChange(on ? [...value, n] : value.filter((x) => x !== n));
  return (
    <fieldset class="attendance">
      <legend>{label}</legend>
      {names.map((n, i) => (
        <div class="choice" key={n}>
          <input
            id={`${id}-${i}`}
            type="checkbox"
            checked={value.includes(n)}
            onChange={(e) => toggle(n, e.currentTarget.checked)}
          />
          <label for={`${id}-${i}`}>{n}</label>
        </div>
      ))}
      {extra.map((n) => (
        <div class="choice" key={n}>
          <input
            id={`${id}-x-${n}`}
            type="checkbox"
            checked
            onChange={() => toggle(n, false)}
          />
          <label for={`${id}-x-${n}`}>{n}</label>
        </div>
      ))}
      <div class="list-row">
        <label class="visually-hidden" for={`${id}-add`}>
          Add a name
        </label>
        <input
          id={`${id}-add`}
          type="text"
          value={typed}
          placeholder="Someone not listed"
          onInput={(e) => setTyped(e.currentTarget.value)}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            (e.preventDefault(),
            typed.trim() && (toggle(typed.trim(), true), setTyped("")))
          }
        />
        <button
          class="button button--quiet button--small"
          type="button"
          disabled={!typed.trim()}
          onClick={() => (toggle(typed.trim(), true), setTyped(""))}
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}
