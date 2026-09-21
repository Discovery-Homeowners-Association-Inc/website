import { env } from "cloudflare:workers";
import { beforeAll, expect, test } from "vitest";
import { app, call, makeUser, seedSettings } from "./helpers.ts";

let admin: string, secretary: string;
beforeAll(async () => {
  await seedSettings();
  admin = await makeUser(["admin"]);
  secretary = await makeUser(["secretary"]);
});

test("a body that is not JSON is a 400, not a server error", async () => {
  const res = await app.request(
    "/api/items",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": secretary },
      body: "{not json",
    },
    env,
  );
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toMatch(/JSON/);
});

test("grants for someone who does not exist is a 404", async () => {
  const res = await call(admin, "PUT", "/api/users/nobody/grants", {
    grants: [{ role: "board" }],
  });
  expect(res.status).toBe(404);
});

test("moving a meeting onto a date that already has one is a 409", async () => {
  await call(secretary, "POST", "/api/meetings", {
    type: "special",
    date: "2030-01-10",
    time: "7:00 pm",
    location: "Rec Center",
  });
  const other = await call(secretary, "POST", "/api/meetings", {
    type: "special",
    date: "2030-01-11",
    time: "7:00 pm",
    location: "Rec Center",
  });
  const moved = await call(
    secretary,
    "PATCH",
    `/api/meetings/${other.json.id}`,
    {
      date: "2030-01-10",
    },
  );
  expect(moved.status).toBe(409);
});
