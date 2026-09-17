import { defineConfig } from "astro/config";
import remarkOrg from "./src/lib/remark-org.ts";

export default defineConfig({
  // Canonical URLs and the feeds point at wherever the site is really served.
  // Until the domain moves to Cloudflare that is the workers.dev address, set as
  // the SITE_URL repository variable; delete the variable at the cutover and the
  // real domain takes over. See docs/DECISIONS.md #5.
  site: process.env.SITE_URL || "https://discoveryhomeowners.com",
  output: "static",
  trailingSlash: "always",
  markdown: { remarkPlugins: [remarkOrg] },
  // The dev server is reached from other machines over the LAN and Tailscale.
  // Vite blocks unknown Host headers to prevent DNS rebinding, so allow the
  // development machine's name and any Tailscale MagicDNS name.
  server: { allowedHosts: ["desktop", ".ts.net"] },
});
