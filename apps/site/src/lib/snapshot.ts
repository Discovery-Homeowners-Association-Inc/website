/**
 * The site builds from content/site.json, a snapshot of what the admin app
 * publishes (see scripts/snapshot.ts). Parsing it here means a broken or
 * incomplete snapshot fails the build instead of shipping a blank page.
 */
import { SiteSnapshot } from "@dhoa/shared";
import raw from "../../content/site.json";

export const snapshot = SiteSnapshot.parse(raw);
export const settings = snapshot.settings;
