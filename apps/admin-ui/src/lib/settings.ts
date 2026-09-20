import type { FieldLabels, SettingsKey } from "@dhoa/shared";

/**
 * The words for each settings group's form: a title, an explanation, and a
 * label for every field the schema in @dhoa/shared has. Everything about
 * *which* fields exist, their order, and their kind comes from the schema
 * itself (see `fieldsFrom` in @dhoa/shared) -- this file only supplies what a
 * person has to choose: labels, help text, placeholders, option wording,
 * rows, steps, and how a list row summarizes itself.
 */
export type SettingsLabels = {
  title: string;
  intro: string;
  fields: FieldLabels;
};

const fee: FieldLabels = {
  label: { label: "What" },
  amount: { label: "Amount", placeholder: "$35.00" },
  unit: { label: "Per", placeholder: "per person" },
  note: { label: "Note" },
};

const agendaItem: FieldLabels = {
  title: { label: "Title" },
  detail: {
    label: "Note",
    kind: "textarea",
    rows: 2,
    help: "Shown under the item on the published agenda.",
  },
};

export const SETTINGS_LABELS: Record<SettingsKey, SettingsLabels> = {
  organization: {
    title: "Organization",
    intro:
      "Contact details, office hours, dues, meeting schedule and the outside services the site links to. Change a value here and it changes everywhere on the site.",
    fields: {
      legal_name: { label: "Legal name" },
      short_name: { label: "Short name" },
      tagline: { label: "Tagline" },
      locality: { label: "Town" },
      county: { label: "County" },
      state: { label: "State" },
      founded: { label: "Year founded", step: 1, min: 1800, max: 2100 },
      office: {
        label: "The office",
        fields: {
          street: { label: "Street address" },
          city: { label: "City" },
          state: { label: "State" },
          zip: { label: "ZIP" },
          mailing: { label: "Mailing address", help: "Where checks go." },
          phone: {
            label: "Phone",
            kind: "phone",
            help: "As people should read it, like 301-845-2050.",
          },
          phone_e164: {
            label: "Phone for tap-to-call",
            kind: "phone",
            help: "Digits only with the country code, like +13018452050.",
          },
          fax: { label: "Fax", kind: "phone" },
          email: { label: "Email" },
          hours: {
            label: "Office hours",
            itemLabel: "Hours",
            summary: "days",
            fields: {
              days: { label: "Days", placeholder: "Monday, Wednesday, Friday" },
              open: { label: "Opens", placeholder: "9:00 am" },
              close: { label: "Closes", placeholder: "1:30 pm" },
            },
          },
        },
      },
      emails: {
        label: "Email addresses by role",
        keyLabel: "Role key",
        valueLabel: "Email address",
        help: "Pages refer to these by key (general, acc, pool_rec) so an address is changed in one place.",
      },
      dues: {
        label: "Dues",
        fields: {
          year: { label: "Year", step: 1 },
          annual: { label: "Annual amount", step: 1 },
          quarterly: { label: "Quarterly amount", step: 1 },
          due_dates: {
            label: "Due dates",
            itemLabel: "Date",
            placeholder: "January 1",
          },
          pay_in_full_note: { label: "Pay-in-full note" },
          late_penalty: { label: "Late penalty" },
          water_plant_fee: { label: "Water plant fee", step: 1 },
          water_bill_due: { label: "Water bill due" },
          zelle: {
            label: "Zelle",
            fields: {
              enabled: { label: "Accept Zelle" },
              recipient: { label: "Recipient name" },
              identifier: { label: "Zelle email or phone" },
              memo_instruction: { label: "Memo instruction" },
            },
          },
          no_cash_dropbox: {
            label: "Tell people not to put cash in the drop box",
          },
        },
      },
      meetings: {
        label: "Regular meetings",
        fields: {
          board: {
            label: "Board meetings",
            fields: {
              rule: {
                label: "In words",
                placeholder: "Third Tuesday of every month",
              },
              ordinal: {
                label: "Which week",
                options: {
                  "1": "First",
                  "2": "Second",
                  "3": "Third",
                  "4": "Fourth",
                },
              },
              weekday: {
                label: "Day of the week",
                options: {
                  "0": "Sunday",
                  "1": "Monday",
                  "2": "Tuesday",
                  "3": "Wednesday",
                  "4": "Thursday",
                  "5": "Friday",
                  "6": "Saturday",
                },
              },
              time: { label: "Time", placeholder: "7:00 pm" },
              location: { label: "Place" },
              open_to: { label: "Who may attend" },
            },
          },
          pool_rec: {
            label: "Pool & Recreation Committee",
            fields: {
              rule: { label: "In words" },
              time: { label: "Time" },
              location: { label: "Place" },
            },
          },
        },
      },
      external: {
        label: "Outside services",
        fields: {
          payhoa: {
            label: "PayHOA resident portal",
            fields: {
              enabled: { label: "Show the portal on the site" },
              portal_url: { label: "Sign-in address" },
              help_text: { label: "What residents can do there" },
              features: { label: "Features", itemLabel: "Feature" },
              registration_steps: {
                label: "How to sign up",
                itemLabel: "Step",
              },
              fees: {
                label: "Processing fees",
                itemLabel: "Fee",
                summary: "method",
                fields: {
                  method: { label: "Payment method" },
                  amount: { label: "Fee" },
                },
              },
              fees_note: { label: "Note about fees" },
              offline_note: { label: "Other ways to pay" },
              minutes_note: { label: "Where minutes are" },
            },
          },
          pool_registration: {
            label: "Pool pass registration",
            fields: {
              label: { label: "Link text" },
              url: { label: "Address" },
              vendor: { label: "Company" },
            },
          },
          county_recycling: {
            label: "County recycling lookup",
            fields: {
              label: { label: "Link text" },
              url: { label: "Address" },
            },
          },
          water_bill: {
            label: "Town water bill",
            fields: {
              label: { label: "Link text" },
              url: { label: "Address" },
            },
          },
        },
      },
    },
  },

  "agenda-templates": {
    title: "Agenda templates",
    intro:
      "What goes on an agenda before anyone types anything. The secretary starts from this and edits; nothing here is compulsory.",
    fields: {
      board: {
        label: "Board meeting",
        itemLabel: "Item",
        summary: "title",
        fields: agendaItem,
      },
      annual: {
        label: "Annual meeting",
        itemLabel: "Item",
        summary: "title",
        fields: agendaItem,
      },
      special: {
        label: "Special meeting",
        itemLabel: "Item",
        summary: "title",
        fields: agendaItem,
      },
      "pool-rec": {
        label: "Pool & Recreation Committee",
        itemLabel: "Item",
        summary: "title",
        fields: agendaItem,
      },
    },
  },

  approvals: {
    title: "Approvals",
    intro:
      "Which kinds of content need a second person to approve them before they go on the site. Editors always submit for approval; this decides whether admins and the secretary can publish directly.",
    fields: {
      news: { label: "News posts need approval" },
      event: { label: "Events need approval" },
      document: { label: "Documents need approval" },
      page: { label: "Page text needs approval" },
    },
  },

  pool: {
    title: "Pool",
    intro: "Season dates, hours, fees and rules on the pool page.",
    fields: {
      season: {
        label: "Season",
        fields: {
          year: { label: "Year", step: 1 },
          opens: { label: "Opens" },
          closes: { label: "Closes" },
          closed_weekday: { label: "Closed on", placeholder: "Mondays" },
          open_days: { label: "Open days, in words" },
          registration_note: { label: "How to register", kind: "textarea" },
          prerequisite: { label: "Requirement" },
          no_cash: { label: "No cash at the pool" },
        },
      },
      hours: {
        label: "Hours",
        itemLabel: "Period",
        summary: "period",
        fields: {
          period: { label: "Period" },
          time: { label: "Hours" },
        },
      },
      fees_resident: {
        label: "Resident fees",
        itemLabel: "Fee",
        summary: "label",
        fields: fee,
      },
      fees_nonresident: {
        label: "Non-resident fees",
        itemLabel: "Fee",
        summary: "label",
        fields: fee,
      },
      rules: { label: "Rules", itemLabel: "Rule" },
      guest_passes: { label: "Guest passes", kind: "textarea" },
    },
  },

  "recreation-center": {
    title: "Recreation Center",
    intro:
      "Rental fees, rules and the checklist on the Recreation Center page.",
    fields: {
      capacity: { label: "Capacity (people)", step: 1 },
      notice_days: { label: "Days' notice to book", step: 1 },
      deposit: { label: "Deposit" },
      rental_fees: {
        label: "Rental fees",
        itemLabel: "Fee",
        summary: "label",
        fields: fee,
      },
      eligibility: { label: "Who can rent", kind: "textarea" },
      rules: { label: "House rules", itemLabel: "Rule" },
      before_leaving: { label: "Before you leave", itemLabel: "Step" },
    },
  },

  "rv-lot": {
    title: "RV lot",
    intro: "Fees, registration and rules on the RV lot page.",
    fields: {
      fees: {
        label: "Fees",
        fields: {
          effective: { label: "In effect from" },
          monthly: { label: "Monthly" },
          monthly_note: { label: "Monthly note" },
          quarterly: { label: "Quarterly" },
          quarterly_note: { label: "Quarterly note" },
          payment: { label: "How to pay" },
        },
      },
      registration_requirements: {
        label: "To register, send",
        itemLabel: "Item",
      },
      rules: { label: "Lot rules", itemLabel: "Rule" },
      planned_improvements: {
        label: "What the fee pays for",
        kind: "textarea",
      },
    },
  },

  parks: {
    title: "Parks",
    intro: "The parks page.",
    fields: {
      count: { label: "Number of parks", step: 1 },
      inspection_note: { label: "Inspections", kind: "textarea" },
      report_note: { label: "Reporting a problem", kind: "textarea" },
      places: {
        label: "Map markers",
        help:
          "Where each park and amenity sits on the parks map. The positions " +
          "are estimates read off the association's hand-drawn map; correct " +
          "one by nudging its latitude and longitude.",
        itemLabel: "Marker",
        summary: "label",
        fields: {
          kind: {
            label: "Shown as",
            options: { park: "Numbered park", amenity: "Amenity" },
          },
          label: { label: "Name" },
          number: {
            label: "Park number",
            step: 1,
            help: "Shown inside the marker. Leave at 0 for an amenity.",
          },
          lat: { label: "Latitude", step: 0.000001 },
          lon: { label: "Longitude", step: 0.000001 },
          where: { label: "Where it is", placeholder: "Off Treasure Avenue" },
          what: {
            label: "What is there",
            placeholder: "Swing set (3 seats), slide",
          },
        },
      },
    },
  },

  trash: {
    title: "Trash and recycling",
    intro: "Collection days, rules and county contacts.",
    fields: {
      collections: {
        label: "Collections",
        itemLabel: "Service",
        summary: "service",
        fields: {
          service: { label: "Service" },
          schedule: { label: "When" },
          zone: { label: "Zone" },
        },
      },
      setout_rule: { label: "When bins go out" },
      bring_in_rule: { label: "Bringing bins in" },
      container_rule: { label: "Containers", kind: "textarea" },
      yard_waste: {
        label: "Yard waste",
        fields: {
          season: { label: "Season" },
          accepted: { label: "Accepted", itemLabel: "Item" },
          not_accepted: { label: "Not accepted", itemLabel: "Item" },
          bundling: { label: "Bundling", kind: "textarea" },
        },
      },
      tipping_fee_note: { label: "Why recycling matters", kind: "textarea" },
      contacts: {
        label: "County contacts",
        itemLabel: "Contact",
        summary: "name",
        fields: {
          name: { label: "Name" },
          address: { label: "Address" },
          url: { label: "Website" },
          phones: {
            label: "Phone numbers",
            itemLabel: "Number",
            summary: "label",
            fields: {
              label: { label: "Label" },
              number: { label: "Number", kind: "phone" },
            },
          },
        },
      },
    },
  },

  problems: {
    title: "Who to call",
    intro: "The Report a problem page, most urgent first.",
    fields: {
      entries: {
        label: "Problems",
        itemLabel: "Problem",
        summary: "issue",
        fields: {
          issue: { label: "The problem" },
          contact: { label: "Who handles it" },
          phone: { label: "Phone number", kind: "phone" },
          phone_key: {
            label: "Phone",
            options: { "": "A number typed below", office: "The office phone" },
          },
          email_key: {
            label: "Email role key",
            help: "A key from Organization › Email addresses by role, or leave blank.",
          },
          note: { label: "Note", kind: "textarea" },
          urgent: { label: "Urgent" },
          category: { label: "Category" },
        },
      },
    },
  },

  links: {
    title: "Community links",
    intro: "Schools, utilities, county services and more, grouped by category.",
    fields: {
      categories: {
        label: "Categories",
        itemLabel: "Category",
        summary: "category",
        fields: {
          category: { label: "Category name" },
          links: {
            label: "Links",
            itemLabel: "Link",
            summary: "name",
            fields: {
              name: { label: "Name" },
              phone: { label: "Phone", kind: "phone" },
              address: { label: "Address" },
              hours: { label: "Hours" },
              url: { label: "Website" },
              note: { label: "Note" },
            },
          },
        },
      },
    },
  },

  projects: {
    title: "Projects",
    intro: "What the board is working on, shown on the Projects page.",
    fields: {
      projects: {
        label: "Projects",
        itemLabel: "Project",
        summary: "name",
        fields: {
          name: { label: "Name" },
          status: {
            label: "Status",
            options: {
              "in-progress": "In progress",
              ongoing: "Ongoing",
              exploring: "Being explored",
              done: "Done",
            },
          },
          timing: { label: "Timing" },
          summary: { label: "Summary", kind: "textarea" },
          streets: { label: "Streets affected", itemLabel: "Street" },
        },
      },
    },
  },

  "architectural-control": {
    title: "Exterior changes (ACC)",
    intro:
      "The lists on the Architectural Control page. The page's text is under Pages.",
    fields: {
      requires_approval: {
        label: "Changes that need approval",
        itemLabel: "Item",
      },
      bylaw_excerpts: {
        label: "Passages from the governing documents",
        itemLabel: "Passage",
        summary: "cite",
        fields: {
          cite: { label: "Where it is from" },
          text: { label: "The passage", kind: "textarea", rows: 4 },
        },
      },
    },
  },
};
