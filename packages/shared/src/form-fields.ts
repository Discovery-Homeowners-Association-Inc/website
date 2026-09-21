/**
 * Describes a form: which fields, in what order, with what label and help.
 * The Form component (in apps/admin-ui) renders any description; the server
 * validates with the matching zod schema in this package.
 *
 * `fieldsFrom` walks a zod object schema and derives the `Field[]` the form
 * needs -- kind, options, nesting -- from the schema itself, so the admin app
 * only has to supply the words a person chooses (labels, help text,
 * placeholders, option labels). That keeps the schema and the form from
 * drifting apart, which hand-written field lists could not guarantee.
 */
import type { z } from "zod";

export type Option = { value: string; label: string };

export type Field =
  | {
      key: string;
      label: string;
      help?: string;
      kind: "text" | "email" | "url" | "phone" | "date" | "datetime" | "time";
      required?: boolean;
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      help?: string;
      kind: "textarea" | "markdown";
      required?: boolean;
      rows?: number;
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      help?: string;
      kind: "number";
      min?: number;
      max?: number;
      step?: number;
    }
  | { key: string; label: string; help?: string; kind: "boolean" }
  | {
      key: string;
      label: string;
      help?: string;
      kind: "select";
      options: Option[];
      numeric?: boolean;
    }
  | {
      key: string;
      label: string;
      help?: string;
      kind: "strings";
      itemLabel: string;
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      help?: string;
      kind: "list";
      itemLabel: string;
      fields: Field[];
      summary?: (row: Record<string, unknown>) => string;
    }
  | {
      key: string;
      label: string;
      help?: string;
      kind: "group";
      fields: Field[];
    }
  | {
      key: string;
      label: string;
      help?: string;
      kind: "record";
      keyLabel: string;
      valueLabel: string;
      valueKind: "text" | "email";
    };

/**
 * The words a person chooses for one field; everything else (kind, options'
 * values, nesting) comes from the zod schema. `fields` and `options` are
 * keyed the same way the schema shapes them, so `fieldsFrom` can check the
 * two against each other.
 */
export type FieldLabels = Record<string, FieldLabel>;
export type FieldLabel = {
  label: string;
  help?: string;
  placeholder?: string;
  // "textarea"/"markdown": a string that wants more than one line.
  // "phone": a string a person reads back, rendered with type="tel" --
  // not derivable from the schema, since it is plain text there too.
  kind?: "textarea" | "markdown" | "phone";
  rows?: number;
  step?: number;
  min?: number; // numbers: bounds the schema itself doesn't state
  max?: number;
  itemLabel?: string; // arrays
  summary?: string; // arrays of objects: the row key to show in the summary
  keyLabel?: string;
  valueLabel?: string; // records
  options?: Record<string, string>; // enum or literal-union value -> label
  fields?: FieldLabels; // objects and arrays of objects
};

// zod 4.6 `def.type` / `def.format` names, discovered with a throwaway test
// against zod 4.6.5 (see form-fields.test.ts history / task-10 report) rather
// than assumed from documentation.
const KIND = {
  string: "string",
  number: "number",
  boolean: "boolean",
  enum: "enum",
  literal: "literal",
  union: "union",
  array: "array",
  object: "object",
  record: "record",
  optional: "optional",
  nullable: "nullable",
  default: "default",
} as const;

const FORMAT = {
  email: "email",
  url: "url",
  date: "date",
} as const;

const CHECK = {
  minLength: "min_length",
  numberFormat: "number_format",
} as const;

/**
 * zod 4 does not export types for `.def`, so this file reads it structurally.
 * These are narrow shapes for exactly the fields this walker looks at.
 */
type AnyZod = z.ZodTypeAny;
type ZodDef = {
  type: string;
  format?: string;
  innerType?: AnyZod;
  checks?: unknown[];
  entries?: Record<string, string | number>;
  values?: unknown[];
  options?: AnyZod[];
  element?: AnyZod;
  shape?: z.ZodRawShape;
  keyType?: AnyZod;
  valueType?: AnyZod;
};
const defOf = (schema: AnyZod): ZodDef =>
  (schema as unknown as { def: ZodDef }).def;

/** A check's own definition, wherever this zod build put it. */
const checkDef = (
  check: unknown,
): { check?: string; [k: string]: unknown } | undefined => {
  const c = check as { _zod?: { def?: unknown }; def?: unknown };
  return (c._zod?.def ?? c.def) as { check?: string } | undefined;
};

/** Peels off `default`/`optional`/`nullable` wrappers. */
function unwrap(schema: AnyZod): {
  schema: AnyZod;
  def: ZodDef;
  wrapped: boolean;
} {
  let current = schema;
  let def = defOf(current);
  let wrapped = false;
  while (
    def.type === KIND.default ||
    def.type === KIND.optional ||
    def.type === KIND.nullable
  ) {
    wrapped = true;
    current = def.innerType as AnyZod;
    def = defOf(current);
  }
  return { schema: current, def, wrapped };
}

/** A string schema's own `.min(1)`-or-better check, if it has one. */
function hasMinLengthOne(def: ZodDef): boolean {
  return (def.checks ?? []).some((c) => {
    const cd = checkDef(c);
    return (
      cd?.check === CHECK.minLength &&
      typeof cd.minimum === "number" &&
      cd.minimum >= 1
    );
  });
}

/** A number schema's `.int()` (or other integer format) check, if it has one. */
function isIntFormat(def: ZodDef): boolean {
  return (def.checks ?? []).some((c) => {
    const cd = checkDef(c);
    return (
      cd?.check === CHECK.numberFormat &&
      typeof cd.format === "string" &&
      cd.format.includes("int")
    );
  });
}

/**
 * Not optional, nullable, or defaulted -- and, for a plain string, backed by
 * an explicit `.min(1)` (or stronger) check, since a string with no default
 * and no minimum is one zod will accept empty, so the form should not demand
 * a value it doesn't have to have.
 */
function isRequired(def: ZodDef, wrapped: boolean): boolean {
  if (wrapped) return false;
  if (def.type === KIND.string) return hasMinLengthOne(def);
  return true;
}

/** Every key gets its own name as a label, for a schema with no chosen words. */
function autoLabels(shape: z.ZodRawShape): FieldLabels {
  return Object.fromEntries(
    Object.keys(shape).map((key) => [
      key,
      { label: key, itemLabel: key, keyLabel: key, valueLabel: key },
    ]),
  );
}

/**
 * Derives the `Field[]` for one zod object schema. Throws when a schema key
 * has no matching label, or a label matches no schema key, so the two forms
 * of truth cannot drift apart.
 *
 * A nested object or array-of-objects whose label has no `fields` gets
 * `autoLabels` for its own keys instead -- used by callers that only need
 * the walker exercised, such as the settings test that proves every settings
 * group's schema can be walked without a human having written labels for it.
 */
export function fieldsFrom(
  schema: z.ZodObject<z.ZodRawShape>,
  labels: FieldLabels,
  path = "",
): Field[] {
  const shape = schema.shape;

  for (const labelKey of Object.keys(labels)) {
    if (!(labelKey in shape)) {
      throw new Error(`Label for ${path}.${labelKey} matches no field`);
    }
  }

  const fields: Field[] = [];
  for (const key of Object.keys(shape)) {
    const { schema: unwrapped, def, wrapped } = unwrap(shape[key] as AnyZod);

    // A bare literal (as opposed to one option of a union) carries no
    // information a person would edit, so it needs no label and no field.
    if (def.type === KIND.literal) continue;

    const label = labels[key];
    if (!label) throw new Error(`No label for ${path}.${key}`);

    const field = fieldFor(
      key,
      unwrapped,
      def,
      wrapped,
      label,
      `${path}.${key}`,
    );
    if (field) fields.push(field);
  }
  return fields;
}

function fieldFor(
  key: string,
  schema: AnyZod,
  def: ZodDef,
  wrapped: boolean,
  label: FieldLabel,
  path: string,
): Field | undefined {
  const { label: text, help } = label;

  switch (def.type) {
    case KIND.string: {
      if (label.kind === "phone")
        return {
          key,
          label: text,
          help,
          kind: "phone",
          required: isRequired(def, wrapped),
          placeholder: label.placeholder,
        };
      if (def.format === FORMAT.email)
        return {
          key,
          label: text,
          help,
          kind: "email",
          required: isRequired(def, wrapped),
          placeholder: label.placeholder,
        };
      if (def.format === FORMAT.url)
        return {
          key,
          label: text,
          help,
          kind: "url",
          required: isRequired(def, wrapped),
          placeholder: label.placeholder,
        };
      if (def.format === FORMAT.date)
        return {
          key,
          label: text,
          help,
          kind: "date",
          required: isRequired(def, wrapped),
          placeholder: label.placeholder,
        };
      if (label.kind === "textarea" || label.kind === "markdown")
        return {
          key,
          label: text,
          help,
          kind: label.kind,
          required: isRequired(def, wrapped),
          rows: label.rows,
          placeholder: label.placeholder,
        };
      return {
        key,
        label: text,
        help,
        kind: "text",
        required: isRequired(def, wrapped),
        placeholder: label.placeholder,
      };
    }

    case KIND.number:
      return {
        key,
        label: text,
        help,
        kind: "number",
        step: label.step ?? (isIntFormat(def) ? 1 : undefined),
        min: label.min,
        max: label.max,
      };

    case KIND.boolean:
      return { key, label: text, help, kind: "boolean" };

    case KIND.enum: {
      const values = Object.values(def.entries ?? {});
      const options: Option[] = values.map((v) => ({
        value: String(v),
        label: label.options?.[String(v)] ?? String(v),
      }));
      return { key, label: text, help, kind: "select", options };
    }

    case KIND.union:
      return unionField(key, def, label, path);

    case KIND.array:
      return arrayField(key, def, label, path);

    case KIND.object:
      return {
        key,
        label: text,
        help,
        kind: "group",
        fields: fieldsFrom(
          schema as z.ZodObject<z.ZodRawShape>,
          label.fields ?? autoLabels(def.shape ?? {}),
          path,
        ),
      };

    case KIND.record: {
      const valueDef = unwrap(def.valueType as AnyZod).def;
      const valueKind: "text" | "email" =
        valueDef.type === KIND.string && valueDef.format === FORMAT.email
          ? "email"
          : "text";
      return {
        key,
        label: text,
        help,
        kind: "record",
        keyLabel: label.keyLabel ?? key,
        valueLabel: label.valueLabel ?? key,
        valueKind,
      };
    }

    default:
      throw new Error(
        `fieldsFrom cannot derive a field for ${path} (zod type "${def.type}")`,
      );
  }
}

function unionField(
  key: string,
  def: ZodDef,
  label: FieldLabel,
  path: string,
): Field {
  const options = (def.options ?? []) as AnyZod[];
  const optDefs = options.map(defOf);

  const allLiterals = optDefs.every(
    (d) =>
      d.type === KIND.literal &&
      Array.isArray(d.values) &&
      d.values.length === 1,
  );
  if (allLiterals) {
    const raw = optDefs.map((d) => (d.values as unknown[])[0]);
    const numeric = typeof raw[0] === "number";
    const selectOptions: Option[] = raw.map((v) => ({
      value: String(v),
      label: label.options?.[String(v)] ?? String(v),
    }));
    return {
      key,
      label: label.label,
      help: label.help,
      kind: "select",
      options: selectOptions,
      numeric,
    };
  }

  // A string (url or email) or the empty string: the schema's way of saying
  // "optional in practice", written as `.or(z.literal(""))` rather than
  // `.optional()` so the value stays `""` and never `undefined`.
  const stringOpt = optDefs.find(
    (d) =>
      d.type === KIND.string &&
      (d.format === FORMAT.url || d.format === FORMAT.email),
  );
  const emptyLiteralOpt = optDefs.find(
    (d) =>
      d.type === KIND.literal && Array.isArray(d.values) && d.values[0] === "",
  );
  if (stringOpt && emptyLiteralOpt && optDefs.length === 2) {
    return {
      key,
      label: label.label,
      help: label.help,
      kind: stringOpt.format === FORMAT.email ? "email" : "url",
      required: false,
    };
  }

  throw new Error(
    `fieldsFrom cannot derive a field for ${path} (unrecognized union)`,
  );
}

function arrayField(
  key: string,
  def: ZodDef,
  label: FieldLabel,
  path: string,
): Field {
  const element = def.element as AnyZod;
  const elementDef = defOf(element);

  if (elementDef.type === KIND.object) {
    const summaryKey = label.summary;
    return {
      key,
      label: label.label,
      help: label.help,
      kind: "list",
      itemLabel: label.itemLabel ?? key,
      fields: fieldsFrom(
        element as z.ZodObject<z.ZodRawShape>,
        label.fields ?? autoLabels(elementDef.shape ?? {}),
        path,
      ),
      summary: summaryKey
        ? (row: Record<string, unknown>) => String(row[summaryKey] ?? "")
        : undefined,
    };
  }

  if (elementDef.type === KIND.string) {
    return {
      key,
      label: label.label,
      help: label.help,
      kind: "strings",
      itemLabel: label.itemLabel ?? key,
      placeholder: label.placeholder,
    };
  }

  throw new Error(
    `fieldsFrom cannot derive a field for ${path} (array of ${elementDef.type})`,
  );
}
