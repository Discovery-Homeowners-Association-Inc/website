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
