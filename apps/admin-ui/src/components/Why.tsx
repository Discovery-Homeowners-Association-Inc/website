import type { ComponentChildren } from "preact";

/** A short explanation the reader can open when they want it. Works with a keyboard and a thumb. */
export function Why({
  title = "What is this?",
  children,
}: {
  title?: string;
  children: ComponentChildren;
}) {
  return (
    <details class="help-details">
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}
