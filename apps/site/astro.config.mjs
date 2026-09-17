import { defineConfig } from "astro/config";
import remarkOrg from "./src/lib/remark-org.ts";

export default defineConfig({
  site: "https://discoveryhomeowners.com",
  output: "static",
  trailingSlash: "always",
  markdown: { remarkPlugins: [remarkOrg] },
});
