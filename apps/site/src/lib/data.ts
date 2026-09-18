/**
 * Organizational facts and structured page data, read from the snapshot.
 * Every page imports from here rather than reaching into the snapshot, so
 * the shapes the templates rely on live in one place.
 */
import { isServing, todayInNewYork } from "@dhoa/shared";
import { settings, snapshot } from "./snapshot.ts";

export const org = settings.organization;
export const parks = settings.parks;
export const problems = settings.problems.entries;
export const trash = settings.trash;
/** The assessment, as the dues page and the home page both read it. */
export const dues = org.dues;
export const links = settings.links.categories;
export const newsletter = org.newsletter;
export const pageData = {
  pool: settings.pool,
  "recreation-center": settings["recreation-center"],
  "rv-lot": settings["rv-lot"],
  projects: settings.projects,
  "architectural-control": settings["architectural-control"],
};

const today = todayInNewYork();
const serving = snapshot.people.filter((p) => isServing(p, today));
const committeeName = (slug: string) =>
  snapshot.committees.find((c) => c.slug === slug)?.name ?? slug;

/** Directors currently serving, in board order. */
export const board = {
  term_note: "Directors are elected by the membership at the Annual Meeting.",
  members: serving
    .filter((p) => p.office)
    .toSorted((a, b) => a.order - b.order)
    .map((p) => ({
      name: p.name,
      role: p.office,
      committees: p.committees.map(committeeName),
      note: p.note,
      email: p.email,
    })),
};

/** Committees with their current members, chair first. */
export const committees = snapshot.committees.map((c) => ({
  ...c,
  members: serving
    .filter((p) => p.committees.includes(c.slug))
    .toSorted(
      (a, b) =>
        Number(b.chairs.includes(c.slug)) - Number(a.chairs.includes(c.slug)) ||
        a.order - b.order,
    )
    .map((p) => ({
      name: p.name,
      role: p.chairs.includes(c.slug) ? "Chairperson" : undefined,
    })),
}));

/** Resolve an email role key. Throws on an unknown key so the build fails. */
export function email(key: string): string {
  const address = org.emails[key];
  if (!address)
    throw new Error(
      `Unknown email key "${key}". Add it under Site settings › Organization › Email addresses.`,
    );
  return address;
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
