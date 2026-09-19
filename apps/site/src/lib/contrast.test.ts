import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast } from "./contrast.ts";

/**
 * The palette, read from base.css itself so a token change is tested rather than
 * remembered. The light values are the first :root block; the dark values are
 * the block under prefers-color-scheme: dark.
 */
const css = readFileSync(
  new URL("../../../../packages/design/base.css", import.meta.url),
  "utf8",
);
const tokens = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [
      m[1],
      m[2]!.toLowerCase(),
    ]),
  );
const light = tokens(
  css.slice(
    css.indexOf(":root {"),
    css.indexOf("@media (prefers-color-scheme: dark)"),
  ),
);
const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
const dark = {
  ...light,
  ...tokens(darkBlock.slice(0, darkBlock.indexOf("}\n}") + 3)),
};

const TEXT: [string, string][] = [
  ["ink", "paper"],
  ["ink", "surface"],
  ["ink-muted", "paper"],
  ["ink-muted", "surface"],
  ["ink-muted", "pool"],
  ["ink", "pool"],
  ["plan", "paper"],
  ["plan", "surface"],
  ["plan-strong", "pool"],
  ["warn", "warn-soft"],
  ["ink-on-light", "marigold"],
  ["band-ink", "band"],
  ["band-link", "band"],
];
const UI: [string, string][] = [
  ["control-border", "surface"],
  ["plan", "paper"],
];

describe("the palette", () => {
  for (const [name, theme] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it(`reads at AA in ${name} mode`, () => {
      for (const [fg, bg] of TEXT)
        expect(
          contrast(theme[fg]!, theme[bg]!),
          `${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      for (const [fg, bg] of UI)
        expect(
          contrast(theme[fg]!, theme[bg]!),
          `${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(3);
    });
  }
});
