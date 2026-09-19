import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { recordVote } from "../src/routes/minutes.ts";
import { call, makeUser } from "./helpers.ts";

const body = (discussion: string) => ({
  called_to_order: "7:02 pm",
  presiding: "Valentina Duk",
  present: ["Valentina Duk", "Doug Shoemaker"],
  quorum: true,
  items: [
    {
      id: "budget",
      title: "2027 budget",
      discussion,
      motions: [
        {
          text: "Adopt the budget",
          moved_by: "Doug Shoemaker",
          seconded_by: "Valentina Duk",
          result: "carried",
          yes: 5,
        },
      ],
    },
  ],
  adjourned_at: "8:15 pm",
});

let secretary: string, director: string, reviewer: string, meeting: string;
let meetingsMade = 0;

beforeEach(async () => {
  secretary = await makeUser(["secretary"], "Secretary");
  director = await makeUser(["board"], "Director");
  reviewer = await makeUser(["reviewer"], "Counsel");
  // A different day for every test, so two tests never ask for the same
  // meeting: a duplicate would be refused and leave the test without one.
  const day = new Date(Date.UTC(2026, 0, 1 + meetingsMade++));
  const date = day.toISOString().slice(0, 10);
  const created = await call(secretary, "POST", "/api/meetings", {
    type: "special",
    date,
    time: "7:00 pm",
    location: "Recreation Center",
  });
  expect(created.status, `could not create the meeting for ${date}`).toBe(201);
  meeting = created.json.id;
});

const path = (suffix = "") => `/api/meetings/${meeting}/minutes${suffix}`;

describe("minutes, from draft to filed", () => {
  it("follows the whole process and binds the vote to the exact version", async () => {
    const v1 = await call(secretary, "PUT", path(), {
      base_version: 0,
      body: body("First draft."),
    });
    expect(v1.status).toBe(200);
    expect(v1.json.version).toBe(1);

    expect(
      (
        await call(director, "PUT", path(), {
          base_version: 1,
          body: body("Director edit."),
        })
      ).status,
    ).toBe(403);
    expect(
      (await call(secretary, "POST", path("/transition"), { to: "in_review" }))
        .json.status,
    ).toBe("in_review");

    const comment = await call(reviewer, "POST", path("/comments"), {
      anchor: "budget",
      body: "Name the vendor.",
    });
    expect(comment.status).toBe(201);
    const v2 = await call(secretary, "PUT", path(), {
      base_version: 1,
      body: body("Revised: vendor is Acme."),
      change_note: "Named the vendor",
    });
    expect(v2.json.version).toBe(2);
    expect(
      (
        await call(
          secretary,
          "POST",
          path(`/comments/${comment.json.id}/resolve`),
        )
      ).status,
    ).toBe(204);
    expect((await call(director, "POST", path("/reviewed"))).json.version).toBe(
      2,
    );

    expect(
      (
        await call(secretary, "POST", path("/transition"), {
          to: "ready_for_vote",
        })
      ).json.status,
    ).toBe("ready_for_vote");
    expect((await call(secretary, "GET", path("/export"))).status).toBe(409);

    const vote = {
      version: 2,
      voted_on: "2026-11-17",
      motion_by: "Doug Shoemaker",
      seconded_by: "Valentina Duk",
      yes: 6,
      no: 0,
      abstain: 1,
    };
    expect(
      (
        await call(director, "POST", path("/vote"), {
          ...vote,
          sha256: "0".repeat(64),
        })
      ).status,
    ).toBe(409);
    const approved = await call(director, "POST", path("/vote"), {
      ...vote,
      sha256: v2.json.sha256,
    });
    expect(approved.json.status).toBe("approved");

    expect(
      (
        await call(secretary, "PUT", path(), {
          base_version: 2,
          body: body("Too late."),
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(reviewer, "POST", path("/comments"), {
          body: "One more thing",
        })
      ).status,
    ).toBe(409);

    const exported = await call(secretary, "GET", path("/export"));
    expect(exported.status).toBe(200);
    expect(exported.json.body.items[0].discussion).toBe(
      "Revised: vendor is Acme.",
    );
    expect(exported.json.sha256).toBe(v2.json.sha256);

    expect((await call(director, "POST", path("/file"), {})).status).toBe(403);
    expect(
      (
        await call(secretary, "POST", path("/file"), {
          note: "Uploaded to PayHOA documents",
        })
      ).json.status,
    ).toBe("filed");

    const final = await call(director, "GET", path());
    expect(final.json.minutes.status).toBe("filed");
    expect(final.json.versions).toHaveLength(2);
    expect(final.json.vote.sha256).toBe(v2.json.sha256);
  });

  it("refuses a vote when someone saved a newer version first", async () => {
    const v1 = await call(secretary, "PUT", path(), {
      base_version: 0,
      body: body("Draft"),
    });
    await call(secretary, "POST", path("/transition"), { to: "in_review" });
    await call(secretary, "POST", path("/transition"), {
      to: "ready_for_vote",
    });
    await call(secretary, "PUT", path(), {
      base_version: 1,
      body: body("Amended at the meeting"),
    });
    const stale = await call(director, "POST", path("/vote"), {
      version: 1,
      sha256: v1.json.sha256,
      voted_on: "2026-11-17",
      motion_by: "A",
      seconded_by: "B",
      yes: 5,
      no: 0,
      abstain: 0,
    });
    expect(stale.status).toBe(409);
  });

  it("keeps minutes ready for a vote when the motion fails", async () => {
    const v1 = await call(secretary, "PUT", path(), {
      base_version: 0,
      body: body("Draft"),
    });
    await call(secretary, "POST", path("/transition"), { to: "in_review" });
    await call(secretary, "POST", path("/transition"), {
      to: "ready_for_vote",
    });
    const failed = await call(director, "POST", path("/vote"), {
      version: 1,
      sha256: v1.json.sha256,
      voted_on: "2026-11-17",
      motion_by: "A",
      seconded_by: "B",
      yes: 2,
      no: 4,
      abstain: 1,
    });
    expect(failed.status).toBe(422);
    expect((await call(director, "GET", path())).json.minutes.status).toBe(
      "ready_for_vote",
    );
  });

  it("does not let two people overwrite each other", async () => {
    await call(secretary, "PUT", path(), {
      base_version: 0,
      body: body("One"),
    });
    expect(
      (
        await call(secretary, "PUT", path(), {
          base_version: 0,
          body: body("Two"),
        })
      ).status,
    ).toBe(409);
  });

  it("does not skip review on the way to a vote", async () => {
    await call(secretary, "PUT", path(), {
      base_version: 0,
      body: body("Draft"),
    });
    expect(
      (
        await call(secretary, "POST", path("/transition"), {
          to: "ready_for_vote",
        })
      ).status,
    ).toBe(409);
    expect(
      (await call(secretary, "POST", path("/transition"), { to: "approved" }))
        .status,
    ).toBe(400);
  });

  it("rejects malformed minutes with a clear error", async () => {
    const bad = await call(secretary, "PUT", path(), {
      base_version: 0,
      body: { items: [{ id: "x", title: "" }] },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/missing or invalid/);
  });

  it("writes nothing when the minutes stopped being ready between the check and the vote", async () => {
    const v1 = await call(secretary, "PUT", path(), {
      base_version: 0,
      body: body("Draft"),
    });
    await call(secretary, "POST", path("/transition"), { to: "in_review" });
    // The route checks the status before it writes. This calls the write on
    // its own, which is what happens when the status moves in between.
    const approved = await recordVote(env.DB, {
      meetingId: meeting,
      version: 1,
      sha256: v1.json.sha256,
      voted_on: "2026-11-17",
      motion_by: "A",
      seconded_by: "B",
      yes: 5,
      no: 0,
      abstain: 0,
      actorId: director,
    });
    expect(approved).toBe(false);
    expect(
      await env.DB.prepare("select 1 from votes where meeting_id = ?")
        .bind(meeting)
        .first(),
    ).toBeNull();
    expect(
      await env.DB.prepare(
        "select 1 from audit_log where action = 'approve' and entity_id = ?",
      )
        .bind(meeting)
        .first(),
    ).toBeNull();
    // Ready again: the same vote goes through, which the primary key used to prevent.
    await call(secretary, "POST", path("/transition"), {
      to: "ready_for_vote",
    });
    const ok = await call(director, "POST", path("/vote"), {
      version: 1,
      sha256: v1.json.sha256,
      voted_on: "2026-11-17",
      motion_by: "A",
      seconded_by: "B",
      yes: 5,
      no: 0,
      abstain: 0,
    });
    expect(ok.json.status).toBe("approved");
  });

  it("logs a review once, however many times the button is pressed", async () => {
    await call(secretary, "PUT", path(), {
      base_version: 0,
      body: body("Draft"),
    });
    await call(secretary, "POST", path("/transition"), { to: "in_review" });
    await call(director, "POST", path("/reviewed"));
    await call(director, "POST", path("/reviewed"));
    const { results } = await env.DB.prepare(
      "select 1 from audit_log where action = 'review' and entity_id = ? and actor_id = ?",
    )
      .bind(meeting, director)
      .all();
    expect(results).toHaveLength(1);
  });
});

describe("an item's outcome", () => {
  it("survives a save, so the next agenda can use it", async () => {
    const secretary = await makeUser(["secretary"]);
    const meeting = await call(secretary, "POST", "/api/meetings", {
      type: "board",
      date: "2027-05-18",
      time: "7:00 pm",
      location: "Discovery Recreation Center",
    });
    expect(meeting.status).toBe(201);
    const id = meeting.json.id;

    const saved = await call(secretary, "PUT", `/api/meetings/${id}/minutes`, {
      base_version: 0,
      change_note: "First draft",
      body: {
        items: [
          {
            id: "i1",
            title: "Elm Street drainage",
            outcome: "follow_up",
            follow_up_owner: "Bob Thornton",
            follow_up_note: "Waiting on a second quote",
          },
          { id: "i2", title: "Treasurer's report" },
        ],
      },
    });
    expect(saved.status).toBe(200);

    const read = await call(secretary, "GET", `/api/meetings/${id}/minutes`);
    const items = read.json.current.body.items;
    expect(items[0].outcome).toBe("follow_up");
    expect(items[0].follow_up_owner).toBe("Bob Thornton");
    expect(items[0].follow_up_note).toBe("Waiting on a second quote");
    // Anything not said is closed, so existing minutes are unaffected.
    expect(items[1].outcome).toBe("closed");
  });
});
