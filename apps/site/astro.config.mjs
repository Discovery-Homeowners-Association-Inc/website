import { defineConfig } from "astro/config";
import remarkOrg from "./src/lib/remark-org.ts";

export default defineConfig({
  site: "https://discoveryhomeowners.com",
  output: "static",
  trailingSlash: "always",
  markdown: { remarkPlugins: [remarkOrg] },
  // The dev server is reached from other machines over the LAN and Tailscale.
  // Vite blocks unknown Host headers to prevent DNS rebinding, so allow the
  // development machine's name and any Tailscale MagicDNS name.
  server: { allowedHosts: ["desktop", ".ts.net"] },
});
