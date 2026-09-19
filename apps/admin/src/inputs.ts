import { z } from "zod";

/** A short free-text note: on a rejection, a removal, a filing. */
export const Note = z.object({ note: z.string().trim().max(500).default("") });
