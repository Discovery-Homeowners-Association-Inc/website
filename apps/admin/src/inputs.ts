import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

/** A short free-text note: on a rejection, a removal, a filing. */
export const Note = z.object({ note: z.string().trim().max(500).default("") });

/** The request body as JSON, or a 400 that says so. Other SyntaxErrors stay server errors. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HTTPException(400, {
      message: "The request body is not valid JSON.",
    });
  }
}
