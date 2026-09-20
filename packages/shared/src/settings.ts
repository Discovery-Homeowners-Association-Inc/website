/**
 * Site settings: one record each, edited on the admin app's Settings screens
 * and read by the public site. Optional text is an empty string, never
 * undefined, so forms always have something to bind to.
 */
import { z } from "zod";

const s = z.string().trim();
const url = z.url().or(z.literal("")).default("");
/** "7:00 pm": the one form the calendar feed can turn into an instant. */
export const MEETING_TIME = /^(1[0-2]|0?[1-9]):([0-5]\d) (am|pm)$/i;
const meetingTime = s.regex(MEETING_TIME, "Use a time like 7:00 pm");
const Fee = z.object({
  label: s.min(1),
  amount: s.min(1),
  unit: s.default(""),
  note: s.default(""),
});
const Weekday = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
const Ordinal = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const Organization = z.object({
  legal_name: s.min(1),
  short_name: s.min(1),
  tagline: s.default(""),
  locality: s,
  county: s,
  state: s,
  founded: z.number().int(),
  office: z.object({
    street: s,
    city: s,
    state: s,
    zip: s,
    mailing: s,
    phone: s,
    phone_e164: s,
    fax: s.default(""),
    email: z.email(),
    hours: z.array(z.object({ days: s, open: s, close: s })),
  }),
  emails: z.record(s, z.email()),
  dues: z.object({
    year: z.number().int(),
    annual: z.number(),
    quarterly: z.number(),
    due_dates: z.array(s),
    pay_in_full_note: s.default(""),
    late_penalty: s.default(""),
    water_plant_fee: z.number(),
    water_bill_due: s.default(""),
    zelle: z.object({
      enabled: z.boolean(),
      recipient: s.default(""),
      identifier: s.default(""),
      memo_instruction: s.default(""),
    }),
    no_cash_dropbox: z.boolean().default(true),
  }),
  meetings: z.object({
    board: z.object({
      rule: s,
      ordinal: Ordinal,
      weekday: Weekday,
      time: meetingTime,
      location: s,
      open_to: s.default(""),
    }),
    pool_rec: z.object({ rule: s, time: s, location: s }),
  }),
  external: z.object({
    payhoa: z.object({
      enabled: z.boolean(),
      portal_url: url,
      help_text: s.default(""),
      features: z.array(s),
      registration_steps: z.array(s),
      fees: z.array(z.object({ method: s, amount: s })),
      fees_note: s.default(""),
      offline_note: s.default(""),
      minutes_note: s.default(""),
    }),
    pool_registration: z.object({ label: s, url, vendor: s.default("") }),
    county_recycling: z.object({ label: s, url }),
    water_bill: z.object({ label: s, url }),
  }),
});

/** What a marker on the parks map stands for. */
export const MAP_PLACE_KINDS = ["park", "amenity"] as const;

/**
 * One marker on the parks map.
 *
 * The positions are estimates worked out from the association's hand-drawn
 * park map, the surveyed street geometry and aerial photography, by
 * `apps/site/scripts/park-positions.mjs`. They are good to something like a
 * house's width, which is why they are settings the board can correct rather
 * than numbers baked into the page.
 */
export const MapPlace = z.object({
  kind: z.enum(MAP_PLACE_KINDS).default("park"),
  label: s.min(1),
  /** Shown inside the marker. 0 for an amenity, which gets a dot instead. */
  number: z.number().int().min(0).default(0),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  /** Where it is, in the way a resident would say it: "Off Treasure Avenue". */
  where: s.default(""),
  /** What is there: "Swing set (3 seats), Slide". */
  what: s.default(""),
});
export type MapPlace = z.infer<typeof MapPlace>;

export const Parks = z.object({
  count: z.number().int(),
  inspection_note: s.default(""),
  report_note: s.default(""),
  places: z.array(MapPlace).default([]),
});

export const Problems = z.object({
  entries: z.array(
    z.object({
      issue: s.min(1),
      contact: s,
      phone: s.default(""),
      phone_key: z.enum(["", "office"]).default(""),
      email_key: s.default(""),
      note: s.default(""),
      urgent: z.boolean().default(false),
      category: s.default(""),
    }),
  ),
});

export const Trash = z.object({
  collections: z.array(
    z.object({ service: s, schedule: s, zone: s.default("") }),
  ),
  setout_rule: s,
  bring_in_rule: s.default(""),
  container_rule: s.default(""),
  yard_waste: z.object({
    season: s,
    accepted: z.array(s),
    not_accepted: z.array(s),
    bundling: s.default(""),
  }),
  tipping_fee_note: s.default(""),
  contacts: z.array(
    z.object({
      name: s,
      address: s.default(""),
      url,
      phones: z.array(z.object({ label: s, number: s })),
    }),
  ),
});

export const Links = z.object({
  categories: z.array(
    z.object({
      category: s.min(1),
      links: z.array(
        z.object({
          name: s.min(1),
          phone: s.default(""),
          address: s.default(""),
          hours: s.default(""),
          url,
          note: s.default(""),
        }),
      ),
    }),
  ),
});

export const Pool = z.object({
  season: z.object({
    year: z.number().int(),
    opens: z.iso.date(),
    closes: z.iso.date(),
    closed_weekday: s.default(""),
    open_days: s.default(""),
    registration_note: s.default(""),
    prerequisite: s.default(""),
    no_cash: z.boolean().default(true),
  }),
  hours: z.array(z.object({ period: s, time: s })),
  fees_resident: z.array(Fee),
  fees_nonresident: z.array(Fee),
  rules: z.array(s),
  guest_passes: s.default(""),
});

export const RecreationCenter = z.object({
  capacity: z.number().int(),
  notice_days: z.number().int(),
  deposit: s,
  rental_fees: z.array(Fee),
  eligibility: s.default(""),
  rules: z.array(s),
  before_leaving: z.array(s),
});

export const RvLot = z.object({
  fees: z.object({
    effective: s,
    monthly: s,
    monthly_note: s.default(""),
    quarterly: s,
    quarterly_note: s.default(""),
    payment: s.default(""),
  }),
  registration_requirements: z.array(s),
  rules: z.array(s),
  planned_improvements: s.default(""),
});

export const Projects = z.object({
  projects: z.array(
    z.object({
      name: s.min(1),
      status: z.enum(["in-progress", "ongoing", "exploring", "done"]),
      timing: s.default(""),
      summary: s.default(""),
      streets: z.array(s).default([]),
    }),
  ),
});

export const ArchitecturalControl = z.object({
  requires_approval: z.array(s),
  bylaw_excerpts: z.array(z.object({ cite: s, text: s })),
});

/** Which item kinds need a second person's approval before they are published. */
export const Approvals = z.object({
  news: z.boolean().default(true),
  event: z.boolean().default(false),
  document: z.boolean().default(true),
  page: z.boolean().default(true),
});

/**
 * What goes on an agenda before anyone types anything, per kind of meeting.
 * The secretary starts from this and edits; nothing here is compulsory.
 */
const AgendaTemplateItem = z.object({
  title: s.min(1).max(200),
  detail: s.max(2000).default(""),
});
const template = z.array(AgendaTemplateItem).max(40).default([]);

export const AgendaTemplates = z.object({
  board: template,
  annual: template,
  special: template,
  "pool-rec": template,
});

export const SETTINGS = {
  organization: Organization,
  parks: Parks,
  problems: Problems,
  trash: Trash,
  links: Links,
  pool: Pool,
  "recreation-center": RecreationCenter,
  "rv-lot": RvLot,
  projects: Projects,
  "architectural-control": ArchitecturalControl,
  approvals: Approvals,
  "agenda-templates": AgendaTemplates,
} as const;
/**
 * Settings the board edits but the public site never reads. They are left out
 * of the snapshot entirely rather than published and ignored: the agenda
 * templates are the board's working notes, not something residents need, and
 * every key in the snapshot is a key the site has to keep parsing. Approvals
 * are a workflow switch the site never reads either; leaving them in the
 * snapshot meant an edit to them (which skips the site version bump, since it
 * changes nothing public) still left a stale value sitting in a snapshot that
 * claimed to be current.
 */
export const ADMIN_ONLY_SETTINGS = ["agenda-templates", "approvals"] as const;

export const PUBLIC_SETTINGS = Object.fromEntries(
  Object.entries(SETTINGS).filter(
    ([k]) => !(ADMIN_ONLY_SETTINGS as readonly string[]).includes(k),
  ),
) as Omit<typeof SETTINGS, (typeof ADMIN_ONLY_SETTINGS)[number]>;

export type SettingsKey = keyof typeof SETTINGS;
export type Settings = { [K in SettingsKey]: z.infer<(typeof SETTINGS)[K]> };
export const SETTINGS_KEYS = Object.keys(SETTINGS) as SettingsKey[];
