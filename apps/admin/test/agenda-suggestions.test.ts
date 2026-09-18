import { expect, test } from "vitest";
import { call, makeUser, seedSettings } from "./helpers.ts";

/**
 * Building an agenda should not be a memory test. The suggestions are the
 * meeting type's template plus whatever the last meeting left open, each
 * carrying where it came from so nothing is a black box.
 */
const meeting = async (user: string, date: string) => {
  const res = await call(user, "POST", "/api/meetings", {
    type: "board",
    date,
    time: "7:00 pm",
    location: "Discovery Recreation Center",
  });
  expect(res.status).toBe(201);
  return res.json.id as string;
};

test("suggests the template for the meeting's type", async () => {
  await seedSettings();
  const secretary = await makeUser(["secretary"]);
  const id = await meeting(secretary, "2028-03-21");

  const res = await call(
    secretary,
    "GET",
    `/api/meetings/${id}/agenda/suggestions`,
  );
  expect(res.status).toBe(200);
  const titles = res.json.template.map((t: { title: string }) => t.title);
  expect(titles).toContain("Call to order");
  expect(titles).toContain("Treasurer's report");
});

test("suggests what the previous meeting left open, and says where it came from", async () => {
  await seedSettings();
  const secretary = await makeUser(["secretary"]);
  const earlier = await meeting(secretary, "2028-04-18");
  const later = await meeting(secretary, "2028-05-16");

  await call(secretary, "PUT", `/api/meetings/${earlier}/minutes`, {
    base_version: 0,
    change_note: "Draft",
    body: {
      items: [
        {
          id: "a",
          title: "Elm Street drainage",
          outcome: "follow_up",
          follow_up_owner: "Bob Thornton",
          follow_up_note: "Waiting on a second quote",
        },
        { id: "b", title: "Pool furniture", outcome: "deferred" },
        { id: "c", title: "Treasurer's report", outcome: "closed" },
      ],
    },
  });

  const res = await call(
    secretary,
    "GET",
    `/api/meetings/${later}/agenda/suggestions`,
  );
  expect(res.status).toBe(200);
  const open = res.json.open as {
    title: string;
    outcome: string;
    from_date: string;
    owner: string;
    note: string;
  }[];
  expect(open.map((o) => o.title).sort()).toEqual([
    "Elm Street drainage",
    "Pool furniture",
  ]);
  const drainage = open.find((o) => o.title === "Elm Street drainage")!;
  expect(drainage.outcome).toBe("follow_up");
  expect(drainage.owner).toBe("Bob Thornton");
  expect(drainage.note).toBe("Waiting on a second quote");
  // Where it came from, so the secretary can check it rather than trust it.
  expect(drainage.from_date).toBe("2028-04-18");
});

test("a meeting with nothing before it suggests only the template", async () => {
  await seedSettings();
  const secretary = await makeUser(["secretary"]);
  const id = await meeting(secretary, "2020-01-21");
  const res = await call(
    secretary,
    "GET",
    `/api/meetings/${id}/agenda/suggestions`,
  );
  expect(res.status).toBe(200);
  expect(res.json.open).toEqual([]);
  expect(res.json.template.length).toBeGreaterThan(0);
});

test("an editor cannot read what the last meeting left open", async () => {
  // The suggestions carry titles, named follow-up owners and notes out of
  // minutes that have not been approved, let alone published. An editor writes
  // news posts and is refused the minutes themselves, so they must be refused
  // this too -- see access.test.ts, "never shows minutes to an editor".
  await seedSettings();
  const secretary = await makeUser(["secretary"]);
  const editor = await makeUser(["editor"]);
  const earlier = await meeting(secretary, "2028-06-20");
  const later = await meeting(secretary, "2028-07-18");

  await call(secretary, "PUT", `/api/meetings/${earlier}/minutes`, {
    base_version: 0,
    change_note: "Draft",
    body: {
      items: [
        {
          id: "a",
          title: "Complaint about the Nguyen family's fence",
          outcome: "follow_up",
          follow_up_owner: "Bob Thornton",
          follow_up_note: "Counsel says do not put this in writing",
        },
      ],
    },
  });

  const res = await call(
    editor,
    "GET",
    `/api/meetings/${later}/agenda/suggestions`,
  );
  expect(res.status).toBe(403);
  expect(JSON.stringify(res.json)).not.toContain("Nguyen");
});

test("the audit log pages backwards, so nothing can be pushed out of reach", async () => {
  const admin = await makeUser(["admin"]);
  // Enough to need more than one page.
  for (let i = 0; i < 6; i++)
    await call(admin, "POST", "/api/audit/export", {
      datasets: ["roster"],
      format: "json",
    });

  const first = await call(admin, "GET", "/api/audit?limit=3");
  expect(first.status).toBe(200);
  expect(first.json.length).toBe(3);
  const oldest = first.json[2].id as number;

  const next = await call(admin, "GET", `/api/audit?before=${oldest}&limit=3`);
  expect(next.json.length).toBe(3);
  // Strictly older, and no overlap with the page before it.
  expect((next.json[0].id as number) < oldest).toBe(true);

  // An export record cannot be an unbounded array.
  const huge = await call(admin, "POST", "/api/audit/export", {
    datasets: Array.from({ length: 5000 }, () => "roster"),
    format: "json",
  });
  expect(huge.status).toBe(400);
});
