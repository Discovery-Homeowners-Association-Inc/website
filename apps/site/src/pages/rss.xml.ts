import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { org } from "../lib/data";

const x = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ site }) => {
  const items = (await getCollection("news"))
    .toSorted((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map((n) => {
      const link = new URL(`/news/${n.id}/`, site).href;
      return `<item><title>${x(n.data.title)}</title><link>${link}</link><guid>${link}</guid><pubDate>${n.data.date.toUTCString()}</pubDate><description>${x(n.data.summary)}</description></item>`;
    });
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${x(org.legal_name)}</title><link>${site}</link><description>News from the board</description><language>en-us</language>${items.join("")}</channel></rss>`;
  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
