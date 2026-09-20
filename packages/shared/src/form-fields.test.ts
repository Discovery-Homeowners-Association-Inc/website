import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldsFrom, type FieldLabels } from "./form-fields.ts";
import { SETTINGS } from "./settings.ts";

describe("fieldsFrom", () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.email(),
    site: z.url().or(z.literal("")).default(""),
    year: z.number().int(),
    price: z.number(),
    on: z.boolean().default(false),
    kind: z.enum(["park", "amenity"]).default("park"),
    weekday: z.union([z.literal(0), z.literal(1)]),
    tags: z.array(z.string()).default([]),
    fees: z.array(z.object({ label: z.string(), amount: z.string() })),
    office: z.object({ street: z.string() }),
    emails: z.record(z.string(), z.email()),
    note: z.string().default(""),
  });
  const labels = {
    name: { label: "Name" },
    email: { label: "Email" },
    site: { label: "Website" },
    year: { label: "Year" },
    price: { label: "Price", step: 0.01 },
    on: { label: "On" },
    kind: {
      label: "Kind",
      options: { park: "Numbered park", amenity: "Amenity" },
    },
    weekday: { label: "Day", options: { "0": "Sunday", "1": "Monday" } },
    tags: { label: "Tags", itemLabel: "Tag" },
    fees: {
      label: "Fees",
      itemLabel: "Fee",
      summary: "label",
      fields: { label: { label: "What" }, amount: { label: "Amount" } },
    },
    office: { label: "Office", fields: { street: { label: "Street" } } },
    emails: { label: "Emails", keyLabel: "Role", valueLabel: "Address" },
    note: { label: "Note", kind: "textarea" as const, rows: 4 },
  };
  it("derives every field kind from the schema", () => {
    const kinds = Object.fromEntries(
      fieldsFrom(schema, labels).map((f) => [f.key, f.kind]),
    );
    expect(kinds).toEqual({
      name: "text",
      email: "email",
      site: "url",
      year: "number",
      price: "number",
      on: "boolean",
      kind: "select",
      weekday: "select",
      tags: "strings",
      fees: "list",
      office: "group",
      emails: "record",
      note: "textarea",
    });
  });
  it("carries what only a person can decide: labels, steps, options, summaries", () => {
    const by = Object.fromEntries(
      fieldsFrom(schema, labels).map((f) => [f.key, f]),
    );
    expect(by.year).toMatchObject({ step: 1 });
    expect(by.price).toMatchObject({ step: 0.01 });
    expect(by.weekday).toMatchObject({
      numeric: true,
      options: [
        { value: "0", label: "Sunday" },
        { value: "1", label: "Monday" },
      ],
    });
    expect(by.kind).toMatchObject({
      options: [
        { value: "park", label: "Numbered park" },
        { value: "amenity", label: "Amenity" },
      ],
    });
    expect(
      (by.fees as { summary: (r: Record<string, unknown>) => string }).summary({
        label: "Adult",
      }),
    ).toBe("Adult");
    expect(by.emails).toMatchObject({
      keyLabel: "Role",
      valueLabel: "Address",
      valueKind: "email",
    });
    expect(by.note).toMatchObject({ rows: 4 });
  });
  it("refuses to drift: a key without a label, or a label without a key", () => {
    expect(() =>
      fieldsFrom(schema, { ...labels, extra: { label: "x" } }),
    ).toThrow(/extra/);
    const { note: _note, ...missing } = labels;
    expect(() => fieldsFrom(schema, missing)).toThrow(/note/);
  });
  it("derives a phone kind for a plain string labeled phone", () => {
    const phoneSchema = z.object({ number: z.string() });
    const [field] = fieldsFrom(phoneSchema, {
      number: { label: "Phone", kind: "phone" },
    });
    expect(field).toMatchObject({ kind: "phone" });
  });
  it("carries min and max through for a number", () => {
    const numberSchema = z.object({ founded: z.number().int() });
    const [field] = fieldsFrom(numberSchema, {
      founded: { label: "Year founded", min: 1800, max: 2100 },
    });
    expect(field).toMatchObject({ min: 1800, max: 2100 });
  });
  it("can describe every settings group the admin app shows", () => {
    // Labels live in the admin app; here only the shape is walked, with a
    // label generated for every key, to prove the walker handles every type
    // the settings use.
    const auto = (s: z.ZodObject<z.ZodRawShape>): FieldLabels =>
      Object.fromEntries(
        Object.keys(s.shape).map((k) => [
          k,
          { label: k, itemLabel: k, keyLabel: k, valueLabel: k },
        ]),
      );
    for (const [key, schema] of Object.entries(SETTINGS))
      expect(() =>
        fieldsFrom(
          schema as z.ZodObject<z.ZodRawShape>,
          auto(schema as z.ZodObject<z.ZodRawShape>),
          key,
        ),
      ).not.toThrow();
  });
});
