/**
 * Describes a form: which fields, in what order, with what label and help.
 * The Form component renders any description; the server validates with the
 * matching zod schema in @dhoa/shared.
 *
 * `Field` and `Option` themselves, and the `fieldsFrom` walker that derives a
 * schema's fields, live in @dhoa/shared (packages/shared/src/form-fields.ts)
 * so the shared package's tests can exercise the walker against the same
 * schemas the server validates with. Only the value helpers below -- which
 * have nothing to do with the schema -- stay here.
 */
export type { Field, Option } from "@dhoa/shared";
import type { Field } from "@dhoa/shared";

export const get = (obj: unknown, key: string): unknown =>
  obj && typeof obj === "object"
    ? (obj as Record<string, unknown>)[key]
    : undefined;
export const set = (
  obj: unknown,
  key: string,
  value: unknown,
): Record<string, unknown> => ({
  ...(obj as Record<string, unknown>),
  [key]: value,
});

/** A blank value for a field, so new rows start with every key present. */
export function blank(field: Field): unknown {
  switch (field.kind) {
    case "number":
      return field.min ?? 0;
    case "boolean":
      return false;
    case "select":
      return field.options[0]?.value ?? "";
    case "strings":
    case "list":
      return [];
    case "group":
      return Object.fromEntries(field.fields.map((f) => [f.key, blank(f)]));
    case "record":
      return {};
    default:
      return "";
  }
}

/** Local datetime-local string for an ISO instant, in the browser's time zone. */
export function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO instant with offset for a datetime-local value; empty stays empty. */
export function fromLocalInput(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  return `${local.length === 16 ? `${local}:00` : local}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}
