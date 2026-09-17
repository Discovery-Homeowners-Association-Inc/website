import { getEntry } from "astro:content";

export async function page(id: string) {
  const entry = await getEntry("pages", id);
  if (!entry)
    throw new Error(`Missing page content: src/content/pages/${id}.md`);
  return entry.data;
}
