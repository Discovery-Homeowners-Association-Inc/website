import { getEntry } from "astro:content";
import { PAGE_PATHS } from "@dhoa/shared";

/** A page's entry, or a build failure that says where to add the page. */
export async function pageEntry(id: string) {
  const entry = await getEntry("pages", id);
  if (!entry)
    throw new Error(
      `No published page with the slug "${id}". Add it in the admin app under Content › Pages.`,
    );
  return entry;
}

export const page = async (id: string) => (await pageEntry(id)).data;

/** The title of the page served at a path, for links that name a page rather than "Related page". */
export async function titleForPath(path: string): Promise<string | undefined> {
  const slug = Object.entries(PAGE_PATHS).find(([, p]) => p === path)?.[0];
  return slug ? (await page(slug)).title : undefined;
}
