/**
 * Every organisational fact the site shows comes from src/data/*.json, parsed
 * here. A missing or misspelled key fails the build instead of shipping a blank.
 */
import { z } from "astro/zod";
import organizationJson from "../data/organization.json";
import boardJson from "../data/board.json";
import committeesJson from "../data/committees.json";
import parksJson from "../data/parks.json";
import problemsJson from "../data/problems.json";
import trashJson from "../data/trash.json";
import linksJson from "../data/links.json";
import meetingsJson from "../data/meetings.json";

const url = z.url();

const Organization = z.object({
  legal_name: z.string(),
  short_name: z.string(),
  tagline: z.string(),
  locality: z.string(),
  county: z.string(),
  state: z.string(),
  founded: z.number(),
  office: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    mailing: z.string(),
    phone: z.string(),
    phone_e164: z.string(),
    fax: z.string(),
    email: z.email(),
    hours: z.array(
      z.object({ days: z.string(), open: z.string(), close: z.string() }),
    ),
  }),
  emails: z.record(z.string(), z.email()),
  dues: z.object({
    year: z.number(),
    annual: z.number(),
    quarterly: z.number(),
    due_dates: z.array(z.string()),
    pay_in_full_note: z.string(),
    late_penalty: z.string(),
    water_plant_fee: z.number(),
    water_bill_due: z.string(),
    zelle: z.object({
      enabled: z.boolean(),
      recipient: z.string(),
      identifier: z.string(),
      memo_instruction: z.string(),
    }),
    no_cash_dropbox: z.boolean(),
  }),
  meetings: z.object({
    board: z.object({
      rule: z.string(),
      ordinal: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ]),
      weekday: z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
      ]),
      time: z.string(),
      location: z.string(),
      open_to: z.string(),
    }),
    pool_rec: z.object({
      rule: z.string(),
      time: z.string(),
      location: z.string(),
    }),
  }),
  external: z.object({
    payhoa: z.object({
      enabled: z.boolean(),
      portal_url: url,
      help_text: z.string(),
      features: z.array(z.string()),
      registration_steps: z.array(z.string()),
      fees: z.array(z.object({ method: z.string(), amount: z.string() })),
      fees_note: z.string(),
      offline_note: z.string(),
      minutes_note: z.string(),
    }),
    pool_registration: z.object({ label: z.string(), url, vendor: z.string() }),
    county_recycling: z.object({ label: z.string(), url }),
    water_bill: z.object({ label: z.string(), url }),
  }),
});

const Board = z.object({
  term_note: z.string(),
  members: z.array(
    z.object({
      order: z.number(),
      name: z.string(),
      role: z.string(),
      committees: z.array(z.string()).optional(),
      note: z.string().optional(),
    }),
  ),
});

const Committees = z.object({
  committees: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      email_key: z.string(),
      purpose: z.string(),
      meets: z.string().optional(),
      page: z.string(),
      volunteers_wanted: z.boolean(),
      members: z.array(
        z.object({ name: z.string(), role: z.string().optional() }),
      ),
    }),
  ),
});

const Parks = z.object({
  count: z.number(),
  inspection_note: z.string(),
  report_note: z.string(),
});

const Problems = z.object({
  entries: z.array(
    z.object({
      order: z.number(),
      issue: z.string(),
      contact: z.string(),
      phone: z.string().optional(),
      phone_key: z.literal("office").optional(),
      email_key: z.string().optional(),
      note: z.string().optional(),
      urgent: z.boolean().optional(),
      category: z.string(),
    }),
  ),
});

const Trash = z.object({
  collections: z.array(
    z.object({ service: z.string(), schedule: z.string(), zone: z.string() }),
  ),
  setout_rule: z.string(),
  bring_in_rule: z.string(),
  container_rule: z.string(),
  yard_waste: z.object({
    season: z.string(),
    accepted: z.array(z.string()),
    not_accepted: z.array(z.string()),
    bundling: z.string(),
  }),
  tipping_fee_note: z.string(),
  contacts: z.array(
    z.object({
      name: z.string(),
      address: z.string().optional(),
      url: url.optional(),
      phones: z.array(z.object({ label: z.string(), number: z.string() })),
    }),
  ),
});

const Links = z.object({
  categories: z.array(
    z.object({
      category: z.string(),
      order: z.number(),
      links: z.array(
        z.object({
          name: z.string(),
          phone: z.string().optional(),
          address: z.string().optional(),
          hours: z.string().optional(),
          url: url.optional(),
          note: z.string().optional(),
        }),
      ),
    }),
  ),
});

const Meetings = z.object({
  overrides: z.array(
    z.discriminatedUnion("status", [
      z.object({
        date: z.string(),
        status: z.literal("cancelled"),
        note: z.string().optional(),
      }),
      z.object({
        date: z.string(),
        status: z.literal("moved"),
        moved_to: z.string(),
        time: z.string().optional(),
        location: z.string().optional(),
        note: z.string().optional(),
      }),
    ]),
  ),
});

export const org = Organization.parse(organizationJson);
export const board = Board.parse(boardJson);
export const committees = Committees.parse(committeesJson).committees;
export const parks = Parks.parse(parksJson);
export const problems = Problems.parse(problemsJson).entries.toSorted(
  (a, b) => a.order - b.order,
);
export const trash = Trash.parse(trashJson);
export const links = Links.parse(linksJson).categories.toSorted(
  (a, b) => a.order - b.order,
);
export const meetingOverrides = Meetings.parse(meetingsJson).overrides;

/** Resolve an email role key. Throws on an unknown key so the build fails. */
export function email(key: string): string {
  const address = org.emails[key];
  if (!address)
    throw new Error(
      `Unknown email key "${key}". Add it to src/data/organization.json.`,
    );
  return address;
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

import pagesJson from "../data/pages.json";

const Fee = z.object({
  label: z.string(),
  amount: z.string(),
  unit: z.string().optional(),
  note: z.string().optional(),
});

const Pages = z.object({
  pool: z.object({
    season: z.object({
      year: z.number(),
      opens: z.string(),
      closes: z.string(),
      closed_weekday: z.string(),
      open_days: z.string(),
      registration_note: z.string(),
      prerequisite: z.string(),
      no_cash: z.boolean(),
    }),
    hours: z.array(z.object({ period: z.string(), time: z.string() })),
    fees_resident: z.array(Fee),
    fees_nonresident: z.array(Fee),
    rules: z.array(z.string()),
    guest_passes: z.string(),
  }),
  "recreation-center": z.object({
    capacity: z.number(),
    notice_days: z.number(),
    deposit: z.string(),
    rental_fees: z.array(Fee),
    eligibility: z.string(),
    rules: z.array(z.string()),
    before_leaving: z.array(z.string()),
  }),
  "rv-lot": z.object({
    fees: z.object({
      effective: z.string(),
      monthly: z.string(),
      monthly_note: z.string(),
      quarterly: z.string(),
      quarterly_note: z.string(),
      payment: z.string(),
    }),
    registration_requirements: z.array(z.string()),
    rules: z.array(z.string()),
    planned_improvements: z.string(),
  }),
  projects: z.object({
    projects: z.array(
      z.object({
        name: z.string(),
        status: z.enum(["in-progress", "ongoing", "exploring", "done"]),
        timing: z.string().optional(),
        summary: z.string(),
        streets: z.array(z.string()).optional(),
      }),
    ),
  }),
  "architectural-control": z.object({
    requires_approval: z.array(z.string()),
    bylaw_excerpts: z.array(z.object({ cite: z.string(), text: z.string() })),
  }),
});

export const pageData = Pages.parse(pagesJson);
export const newsletter = z
  .object({ enabled: z.boolean(), provider: z.literal("sender") })
  .parse(organizationJson.newsletter);
