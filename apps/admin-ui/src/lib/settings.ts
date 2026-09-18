import type { SettingsKey } from "@dhoa/shared";
import type { Field } from "./fields.ts";

/** Settings groups as the admin shows them: a name, an explanation, and their fields. */
export type SettingsGroup = {
  key: SettingsKey;
  title: string;
  intro: string;
  fields: Field[];
};

const fee: Field[] = [
  { key: "label", label: "What", kind: "text", required: true },
  {
    key: "amount",
    label: "Amount",
    kind: "text",
    required: true,
    placeholder: "$35.00",
  },
  { key: "unit", label: "Per", kind: "text", placeholder: "per person" },
  { key: "note", label: "Note", kind: "text" },
];
const label = (r: Record<string, unknown>) =>
  String(
    r.label ??
      r.name ??
      r.service ??
      r.days ??
      r.period ??
      r.category ??
      r.issue ??
      "",
  );

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: "organization",
    title: "Organization",
    intro:
      "Contact details, office hours, dues, meeting schedule and the outside services the site links to. Change a value here and it changes everywhere on the site.",
    fields: [
      { key: "legal_name", label: "Legal name", kind: "text", required: true },
      { key: "short_name", label: "Short name", kind: "text", required: true },
      { key: "tagline", label: "Tagline", kind: "text" },
      { key: "locality", label: "Town", kind: "text" },
      { key: "county", label: "County", kind: "text" },
      { key: "state", label: "State", kind: "text" },
      {
        key: "founded",
        label: "Year founded",
        kind: "number",
        min: 1800,
        max: 2100,
        step: 1,
      },
      {
        key: "office",
        label: "The office",
        kind: "group",
        fields: [
          { key: "street", label: "Street address", kind: "text" },
          { key: "city", label: "City", kind: "text" },
          { key: "state", label: "State", kind: "text" },
          { key: "zip", label: "ZIP", kind: "text" },
          {
            key: "mailing",
            label: "Mailing address",
            kind: "text",
            help: "Where checks go.",
          },
          {
            key: "phone",
            label: "Phone",
            kind: "phone",
            help: "As people should read it, like 301-845-2050.",
          },
          {
            key: "phone_e164",
            label: "Phone for tap-to-call",
            kind: "phone",
            help: "Digits only with the country code, like +13018452050.",
          },
          { key: "fax", label: "Fax", kind: "phone" },
          { key: "email", label: "Email", kind: "email" },
          {
            key: "hours",
            label: "Office hours",
            kind: "list",
            itemLabel: "Hours",
            summary: label,
            fields: [
              {
                key: "days",
                label: "Days",
                kind: "text",
                placeholder: "Monday, Wednesday, Friday",
              },
              {
                key: "open",
                label: "Opens",
                kind: "text",
                placeholder: "9:00 am",
              },
              {
                key: "close",
                label: "Closes",
                kind: "text",
                placeholder: "1:30 pm",
              },
            ],
          },
        ],
      },
      {
        key: "emails",
        label: "Email addresses by role",
        kind: "record",
        keyLabel: "Role key",
        valueLabel: "Email address",
        valueKind: "email",
        help: "Pages refer to these by key (general, acc, pool_rec) so an address is changed in one place.",
      },
      {
        key: "dues",
        label: "Dues",
        kind: "group",
        fields: [
          { key: "year", label: "Year", kind: "number", step: 1 },
          { key: "annual", label: "Annual amount", kind: "number", step: 1 },
          {
            key: "quarterly",
            label: "Quarterly amount",
            kind: "number",
            step: 1,
          },
          {
            key: "due_dates",
            label: "Due dates",
            kind: "strings",
            itemLabel: "Date",
            placeholder: "January 1",
          },
          { key: "pay_in_full_note", label: "Pay-in-full note", kind: "text" },
          { key: "late_penalty", label: "Late penalty", kind: "text" },
          {
            key: "water_plant_fee",
            label: "Water plant fee",
            kind: "number",
            step: 1,
          },
          { key: "water_bill_due", label: "Water bill due", kind: "text" },
          {
            key: "zelle",
            label: "Zelle",
            kind: "group",
            fields: [
              { key: "enabled", label: "Accept Zelle", kind: "boolean" },
              { key: "recipient", label: "Recipient name", kind: "text" },
              {
                key: "identifier",
                label: "Zelle email or phone",
                kind: "text",
              },
              {
                key: "memo_instruction",
                label: "Memo instruction",
                kind: "text",
              },
            ],
          },
          {
            key: "no_cash_dropbox",
            label: "Tell people not to put cash in the drop box",
            kind: "boolean",
          },
        ],
      },
      {
        key: "meetings",
        label: "Regular meetings",
        kind: "group",
        fields: [
          {
            key: "board",
            label: "Board meetings",
            kind: "group",
            fields: [
              {
                key: "rule",
                label: "In words",
                kind: "text",
                placeholder: "Third Tuesday of every month",
              },
              {
                key: "ordinal",
                label: "Which week",
                kind: "select",
                numeric: true,
                options: [
                  { value: "1", label: "First" },
                  { value: "2", label: "Second" },
                  { value: "3", label: "Third" },
                  { value: "4", label: "Fourth" },
                ],
              },
              {
                key: "weekday",
                label: "Day of the week",
                kind: "select",
                numeric: true,
                options: [
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((d, i) => ({ value: String(i), label: d })),
              },
              {
                key: "time",
                label: "Time",
                kind: "text",
                placeholder: "7:00 pm",
              },
              { key: "location", label: "Place", kind: "text" },
              { key: "open_to", label: "Who may attend", kind: "text" },
            ],
          },
          {
            key: "pool_rec",
            label: "Pool & Recreation Committee",
            kind: "group",
            fields: [
              { key: "rule", label: "In words", kind: "text" },
              { key: "time", label: "Time", kind: "text" },
              { key: "location", label: "Place", kind: "text" },
            ],
          },
        ],
      },
      {
        key: "external",
        label: "Outside services",
        kind: "group",
        fields: [
          {
            key: "payhoa",
            label: "PayHOA resident portal",
            kind: "group",
            fields: [
              {
                key: "enabled",
                label: "Show the portal on the site",
                kind: "boolean",
              },
              { key: "portal_url", label: "Sign-in address", kind: "url" },
              {
                key: "help_text",
                label: "What residents can do there",
                kind: "text",
              },
              {
                key: "features",
                label: "Features",
                kind: "strings",
                itemLabel: "Feature",
              },
              {
                key: "registration_steps",
                label: "How to sign up",
                kind: "strings",
                itemLabel: "Step",
              },
              {
                key: "fees",
                label: "Processing fees",
                kind: "list",
                itemLabel: "Fee",
                summary: (r) => String(r.method ?? ""),
                fields: [
                  { key: "method", label: "Payment method", kind: "text" },
                  { key: "amount", label: "Fee", kind: "text" },
                ],
              },
              { key: "fees_note", label: "Note about fees", kind: "text" },
              { key: "offline_note", label: "Other ways to pay", kind: "text" },
              { key: "minutes_note", label: "Where minutes are", kind: "text" },
            ],
          },
          {
            key: "pool_registration",
            label: "Pool pass registration",
            kind: "group",
            fields: [
              { key: "label", label: "Link text", kind: "text" },
              { key: "url", label: "Address", kind: "url" },
              { key: "vendor", label: "Company", kind: "text" },
            ],
          },
          {
            key: "county_recycling",
            label: "County recycling lookup",
            kind: "group",
            fields: [
              { key: "label", label: "Link text", kind: "text" },
              { key: "url", label: "Address", kind: "url" },
            ],
          },
          {
            key: "water_bill",
            label: "Town water bill",
            kind: "group",
            fields: [
              { key: "label", label: "Link text", kind: "text" },
              { key: "url", label: "Address", kind: "url" },
            ],
          },
        ],
      },
      {
        key: "newsletter",
        label: "Email newsletter",
        kind: "group",
        fields: [
          {
            key: "enabled",
            label: "Show the sign-up form",
            kind: "boolean",
            help: "Turn on once the newsletter service is connected.",
          },
        ],
      },
    ],
  },
  {
    key: "agenda-templates",
    title: "Agenda templates",
    intro:
      "What goes on an agenda before anyone types anything. The secretary starts from this and edits; nothing here is compulsory.",
    fields: (
      [
        ["board", "Board meeting"],
        ["annual", "Annual meeting"],
        ["special", "Special meeting"],
        ["pool-rec", "Pool & Recreation Committee"],
      ] as const
    ).map(([key, label]) => ({
      key,
      label,
      kind: "list" as const,
      itemLabel: "Item",
      summary: (r: Record<string, unknown>) => String(r.title ?? ""),
      fields: [
        { key: "title", label: "Title", kind: "text" as const },
        {
          key: "detail",
          label: "Note",
          kind: "textarea" as const,
          rows: 2,
          help: "Shown under the item on the published agenda.",
        },
      ],
    })),
  },
  {
    key: "approvals",
    title: "Approvals",
    intro:
      "Which kinds of content need a second person to approve them before they go on the site. Editors always submit for approval; this decides whether admins and the secretary can publish directly.",
    fields: [
      { key: "news", label: "News posts need approval", kind: "boolean" },
      { key: "event", label: "Events need approval", kind: "boolean" },
      { key: "document", label: "Documents need approval", kind: "boolean" },
      { key: "page", label: "Page text needs approval", kind: "boolean" },
    ],
  },
  {
    key: "pool",
    title: "Pool",
    intro: "Season dates, hours, fees and rules on the pool page.",
    fields: [
      {
        key: "season",
        label: "Season",
        kind: "group",
        fields: [
          { key: "year", label: "Year", kind: "number", step: 1 },
          { key: "opens", label: "Opens", kind: "date" },
          { key: "closes", label: "Closes", kind: "date" },
          {
            key: "closed_weekday",
            label: "Closed on",
            kind: "text",
            placeholder: "Mondays",
          },
          { key: "open_days", label: "Open days, in words", kind: "text" },
          {
            key: "registration_note",
            label: "How to register",
            kind: "textarea",
          },
          { key: "prerequisite", label: "Requirement", kind: "text" },
          { key: "no_cash", label: "No cash at the pool", kind: "boolean" },
        ],
      },
      {
        key: "hours",
        label: "Hours",
        kind: "list",
        itemLabel: "Period",
        summary: label,
        fields: [
          { key: "period", label: "Period", kind: "text" },
          { key: "time", label: "Hours", kind: "text" },
        ],
      },
      {
        key: "fees_resident",
        label: "Resident fees",
        kind: "list",
        itemLabel: "Fee",
        summary: label,
        fields: fee,
      },
      {
        key: "fees_nonresident",
        label: "Non-resident fees",
        kind: "list",
        itemLabel: "Fee",
        summary: label,
        fields: fee,
      },
      { key: "rules", label: "Rules", kind: "strings", itemLabel: "Rule" },
      { key: "guest_passes", label: "Guest passes", kind: "textarea" },
    ],
  },
  {
    key: "recreation-center",
    title: "Recreation Center",
    intro:
      "Rental fees, rules and the checklist on the Recreation Center page.",
    fields: [
      { key: "capacity", label: "Capacity (people)", kind: "number", step: 1 },
      {
        key: "notice_days",
        label: "Days' notice to book",
        kind: "number",
        step: 1,
      },
      { key: "deposit", label: "Deposit", kind: "text" },
      {
        key: "rental_fees",
        label: "Rental fees",
        kind: "list",
        itemLabel: "Fee",
        summary: label,
        fields: fee,
      },
      { key: "eligibility", label: "Who can rent", kind: "textarea" },
      {
        key: "rules",
        label: "House rules",
        kind: "strings",
        itemLabel: "Rule",
      },
      {
        key: "before_leaving",
        label: "Before you leave",
        kind: "strings",
        itemLabel: "Step",
      },
    ],
  },
  {
    key: "rv-lot",
    title: "RV lot",
    intro: "Fees, registration and rules on the RV lot page.",
    fields: [
      {
        key: "fees",
        label: "Fees",
        kind: "group",
        fields: [
          { key: "effective", label: "In effect from", kind: "text" },
          { key: "monthly", label: "Monthly", kind: "text" },
          { key: "monthly_note", label: "Monthly note", kind: "text" },
          { key: "quarterly", label: "Quarterly", kind: "text" },
          { key: "quarterly_note", label: "Quarterly note", kind: "text" },
          { key: "payment", label: "How to pay", kind: "text" },
        ],
      },
      {
        key: "registration_requirements",
        label: "To register, send",
        kind: "strings",
        itemLabel: "Item",
      },
      { key: "rules", label: "Lot rules", kind: "strings", itemLabel: "Rule" },
      {
        key: "planned_improvements",
        label: "What the fee pays for",
        kind: "textarea",
      },
    ],
  },
  {
    key: "parks",
    title: "Parks",
    intro: "The parks page.",
    fields: [
      { key: "count", label: "Number of parks", kind: "number", step: 1 },
      { key: "inspection_note", label: "Inspections", kind: "textarea" },
      { key: "report_note", label: "Reporting a problem", kind: "textarea" },
      {
        key: "places",
        label: "Map markers",
        help:
          "Where each park and amenity sits on the parks map. The positions " +
          "are estimates read off the association's hand-drawn map; correct " +
          "one by nudging its latitude and longitude.",
        kind: "list",
        itemLabel: "Marker",
        summary: label,
        fields: [
          { key: "label", label: "Name", kind: "text", required: true },
          {
            key: "kind",
            label: "Shown as",
            kind: "select",
            options: [
              { value: "park", label: "Numbered park" },
              { value: "amenity", label: "Amenity" },
            ],
          },
          {
            key: "number",
            label: "Park number",
            kind: "number",
            step: 1,
            help: "Shown inside the marker. Leave at 0 for an amenity.",
          },
          { key: "lat", label: "Latitude", kind: "number", step: 0.000001 },
          { key: "lon", label: "Longitude", kind: "number", step: 0.000001 },
          {
            key: "where",
            label: "Where it is",
            kind: "text",
            placeholder: "Off Treasure Avenue",
          },
          {
            key: "what",
            label: "What is there",
            kind: "text",
            placeholder: "Swing set (3 seats), slide",
          },
        ],
      },
    ],
  },
  {
    key: "trash",
    title: "Trash and recycling",
    intro: "Collection days, rules and county contacts.",
    fields: [
      {
        key: "collections",
        label: "Collections",
        kind: "list",
        itemLabel: "Service",
        summary: label,
        fields: [
          { key: "service", label: "Service", kind: "text" },
          { key: "schedule", label: "When", kind: "text" },
          { key: "zone", label: "Zone", kind: "text" },
        ],
      },
      { key: "setout_rule", label: "When bins go out", kind: "text" },
      { key: "bring_in_rule", label: "Bringing bins in", kind: "text" },
      { key: "container_rule", label: "Containers", kind: "textarea" },
      {
        key: "yard_waste",
        label: "Yard waste",
        kind: "group",
        fields: [
          { key: "season", label: "Season", kind: "text" },
          {
            key: "accepted",
            label: "Accepted",
            kind: "strings",
            itemLabel: "Item",
          },
          {
            key: "not_accepted",
            label: "Not accepted",
            kind: "strings",
            itemLabel: "Item",
          },
          { key: "bundling", label: "Bundling", kind: "textarea" },
        ],
      },
      {
        key: "tipping_fee_note",
        label: "Why recycling matters",
        kind: "textarea",
      },
      {
        key: "contacts",
        label: "County contacts",
        kind: "list",
        itemLabel: "Contact",
        summary: label,
        fields: [
          { key: "name", label: "Name", kind: "text" },
          { key: "address", label: "Address", kind: "text" },
          { key: "url", label: "Website", kind: "url" },
          {
            key: "phones",
            label: "Phone numbers",
            kind: "list",
            itemLabel: "Number",
            summary: label,
            fields: [
              { key: "label", label: "Label", kind: "text" },
              { key: "number", label: "Number", kind: "phone" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "problems",
    title: "Who to call",
    intro: "The Report a problem page, most urgent first.",
    fields: [
      {
        key: "entries",
        label: "Problems",
        kind: "list",
        itemLabel: "Problem",
        summary: label,
        fields: [
          { key: "issue", label: "The problem", kind: "text", required: true },
          { key: "contact", label: "Who handles it", kind: "text" },
          {
            key: "phone_key",
            label: "Phone",
            kind: "select",
            options: [
              { value: "", label: "A number typed below" },
              { value: "office", label: "The office phone" },
            ],
          },
          { key: "phone", label: "Phone number", kind: "phone" },
          {
            key: "email_key",
            label: "Email role key",
            kind: "text",
            help: "general, acc or pool_rec, or leave blank.",
          },
          { key: "note", label: "Note", kind: "textarea" },
          { key: "urgent", label: "Urgent", kind: "boolean" },
          { key: "category", label: "Category", kind: "text" },
        ],
      },
    ],
  },
  {
    key: "links",
    title: "Community links",
    intro: "Schools, utilities, county services and more, grouped by category.",
    fields: [
      {
        key: "categories",
        label: "Categories",
        kind: "list",
        itemLabel: "Category",
        summary: label,
        fields: [
          {
            key: "category",
            label: "Category name",
            kind: "text",
            required: true,
          },
          {
            key: "links",
            label: "Links",
            kind: "list",
            itemLabel: "Link",
            summary: label,
            fields: [
              { key: "name", label: "Name", kind: "text", required: true },
              { key: "url", label: "Website", kind: "url" },
              { key: "phone", label: "Phone", kind: "phone" },
              { key: "address", label: "Address", kind: "text" },
              { key: "hours", label: "Hours", kind: "text" },
              { key: "note", label: "Note", kind: "text" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    intro: "What the board is working on, shown on the Projects page.",
    fields: [
      {
        key: "projects",
        label: "Projects",
        kind: "list",
        itemLabel: "Project",
        summary: (r) => String(r.name ?? ""),
        fields: [
          { key: "name", label: "Name", kind: "text", required: true },
          {
            key: "status",
            label: "Status",
            kind: "select",
            options: [
              { value: "in-progress", label: "In progress" },
              { value: "ongoing", label: "Ongoing" },
              { value: "exploring", label: "Being explored" },
              { value: "done", label: "Done" },
            ],
          },
          { key: "timing", label: "Timing", kind: "text" },
          { key: "summary", label: "Summary", kind: "textarea" },
          {
            key: "streets",
            label: "Streets affected",
            kind: "strings",
            itemLabel: "Street",
          },
        ],
      },
    ],
  },
  {
    key: "architectural-control",
    title: "Exterior changes (ACC)",
    intro:
      "The lists on the Architectural Control page. The page's text is under Pages.",
    fields: [
      {
        key: "requires_approval",
        label: "Changes that need approval",
        kind: "strings",
        itemLabel: "Item",
      },
      {
        key: "bylaw_excerpts",
        label: "Passages from the governing documents",
        kind: "list",
        itemLabel: "Passage",
        summary: (r) => String(r.cite ?? ""),
        fields: [
          { key: "cite", label: "Where it is from", kind: "text" },
          { key: "text", label: "The passage", kind: "textarea", rows: 4 },
        ],
      },
    ],
  },
];
