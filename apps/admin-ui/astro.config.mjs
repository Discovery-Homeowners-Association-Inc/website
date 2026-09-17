import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";

// Static pages; all data is fetched in the browser from the Worker's /api.
// The Worker serves this build as static assets, so page views cost no Worker CPU.
export default defineConfig({
  output: "static",
  trailingSlash: "always",
  integrations: [preact()],
});
