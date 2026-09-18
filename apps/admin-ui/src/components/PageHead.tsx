import type { ComponentChildren } from "preact";

/**
 * How a screen introduces itself: where you are, what this is, and one line
 * saying what it is for.
 *
 * Twelve components wrote this by hand, which is why the two apps drifted apart
 * on something as small as whether a page title has a top margin. The public
 * site has had `PageHead.astro` all along; this is the same structure and the
 * same `.page-head` class, so the rule under a title is in one place for both.
 */
export function PageHead({
  title,
  lede,
  crumbs = [],
  children,
}: {
  title: ComponentChildren;
  /** One sentence on what the screen is for. */
  lede?: ComponentChildren;
  crumbs?: { href: string; label: string }[];
  /** Anything that belongs with the title rather than under it. */
  children?: ComponentChildren;
}) {
  return (
    <header class="page-head">
      {crumbs.length > 0 && (
        <nav class="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.href}>
              {i > 0 && " / "}
              <a href={c.href}>{c.label}</a>
            </span>
          ))}
        </nav>
      )}
      <h1>{title}</h1>
      {lede && <p class="lede">{lede}</p>}
      {children}
    </header>
  );
}
