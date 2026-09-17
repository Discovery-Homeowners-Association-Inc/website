import { writeFile } from "node:fs/promises";
import { defineConfig } from "astro/config";
import remarkOrg from "./src/lib/remark-org.ts";

const siteUrl = process.env.SITE_URL || "https://discoveryhomeowners.com";

/**
 * A workers.dev address is the temporary one. The board has not reviewed the
 * content yet (docs/CONTENT-REVIEW.md), so it stays out of search results until
 * the domain moves. Deleting the SITE_URL variable at the cutover removes this
 * with the same switch that restores the real canonical host -- there is no
 * second thing to remember at launch.
 */
const isTemporaryAddress = new URL(siteUrl).hostname.endsWith(".workers.dev");

/**
 * The pages carry a noindex meta tag, but the PDFs under /documents/ cannot --
 * only a header reaches those. Cloudflare reads _headers from the assets
 * directory.
 */
const noindexHeader = {
  name: "dhoa-noindex-temporary-address",
  hooks: {
    "astro:build:done": async ({ dir, logger }) => {
      if (!isTemporaryAddress) return;
      await writeFile(
        new URL("_headers", dir),
        "/*\n  X-Robots-Tag: noindex, nofollow\n",
      );
      logger.warn(`temporary address ${siteUrl}: wrote _headers with noindex`);
    },
  },
};

export default defineConfig({
  // Canonical URLs and the feeds point at wherever the site is really served.
  // Until the domain moves to Cloudflare that is the workers.dev address, set as
  // the SITE_URL repository variable; delete the variable at the cutover and the
  // real domain takes over. See docs/DECISIONS.md #5.
  site: siteUrl,
  integrations: [noindexHeader],
  output: "static",
  trailingSlash: "always",
  markdown: { remarkPlugins: [remarkOrg] },
  // The dev server is reached from other machines over the LAN and Tailscale.
  // Vite blocks unknown Host headers to prevent DNS rebinding, so allow the
  // development machine's name and any Tailscale MagicDNS name.
  server: { allowedHosts: ["desktop", ".ts.net"] },
});
