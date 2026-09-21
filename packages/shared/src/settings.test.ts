import { describe, expect, it } from "vitest";
import { Organization } from "./settings.ts";

/** A minimal but valid organization record, filling only the fields with no default. */
function validOrganization() {
  return {
    legal_name: "Discovery Homeowners Association, Inc.",
    short_name: "Discovery HOA",
    locality: "Walkersville",
    county: "Frederick County",
    state: "Maryland",
    founded: 1972,
    office: {
      street: "8740 Stauffer Road",
      city: "Walkersville",
      state: "MD",
      zip: "21793",
      mailing: "P.O. Box 394, Walkersville, MD 21793",
      phone: "301-845-2050",
      phone_e164: "+13018452050",
      email: "dhoa@verizon.net",
      hours: [],
    },
    emails: {},
    dues: {
      year: 2026,
      annual: 776,
      quarterly: 194,
      due_dates: ["January 1", "April 1", "July 1", "October 1"],
      water_plant_fee: 50,
      zelle: { enabled: true },
    },
    meetings: {
      board: {
        rule: "Third Tuesday of every month",
        ordinal: 3,
        weekday: 2,
        time: "7:00 pm",
        location: "Discovery Recreation Center",
      },
      pool_rec: {
        rule: "Second Tuesday of every month",
        time: "6:30 pm",
        location: "Walkersville",
      },
    },
    external: {
      payhoa: { enabled: true, features: [], registration_steps: [], fees: [] },
      pool_registration: { label: "Register for a pool pass" },
      county_recycling: { label: "Frederick County collection schedule" },
      water_bill: { label: "Pay your Walkersville water bill" },
    },
  };
}

describe("Organization meeting times", () => {
  it("accepts free-text for the pool/rec meeting time, which nothing reads", () => {
    const org = validOrganization();
    org.meetings.pool_rec.time = "6:30pm, usually";
    expect(Organization.safeParse(org).success).toBe(true);
  });

  it("still requires the board meeting time to read like '7:00 pm', since the .ics feed parses it", () => {
    const org = validOrganization();
    org.meetings.board.time = "7pm";
    expect(Organization.safeParse(org).success).toBe(false);
  });
});
