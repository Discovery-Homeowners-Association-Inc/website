import {
  canExport,
  canTransition,
  contentHash,
  MinutesBody,
  type MinutesState,
} from "@dhoa/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { hasRole, requireRole, rolesOf } from "../access.ts";
import { auditStatement, batchOr409, nowIso, type Guard } from "../db.ts";
import { Note, readJson } from "../inputs.ts";
import type { AppEnv } from "../types.ts";
import { meetingOr404 } from "./meetings.ts";

type MinutesRow = {
  meeting_id: string;
  status: MinutesState;
  current_version: number;
  filed_at: string | null;
  filed_note: string | null;
};
type VersionRow = {
  version: number;
  body: string;
  sha256: string;
  change_note: string | null;
  author_id: string | null;
  created_at: string;
};

const EDITABLE: MinutesState[] = ["draft", "in_review", "ready_for_vote"];

/** Who wrote a row, with former members still named. Three queries share it. */
const AUTHOR = `u.name as author, f.user_id is not null as author_former`;
const AUTHOR_JOIN = (col: string) =>
  `left join "user" u on u.id = ${col} left join former_members f on f.user_id = ${col}`;

async function loadMaybe(db: D1Database, meetingId: string) {
  const minutes = await db
    .prepare("select * from minutes where meeting_id = ?")
    .bind(meetingId)
    .first<MinutesRow>();
  if (!minutes) return null;
  const current = await db
    .prepare(
      "select * from minutes_versions where meeting_id = ? and version = ?",
    )
    .bind(meetingId, minutes.current_version)
    .first<VersionRow>();
  if (!current)
    throw new HTTPException(500, {
      message: "The current version of these minutes is missing.",
    });
  return { minutes, current };
}

async function load(db: D1Database, meetingId: string) {
  const loaded = await loadMaybe(db, meetingId);
  if (!loaded)
    throw new HTTPException(404, {
      message: "No minutes have been started for this meeting.",
    });
  return loaded;
}

export type VoteInput = {
  meetingId: string;
  version: number;
  sha256: string;
  voted_on: string;
  motion_by: string;
  seconded_by: string;
  yes: number;
  no: number;
  abstain: number;
  actorId: string;
};

/**
 * Records the vote and approves the minutes, or does neither.
 *
 * Every statement is conditional on the same guard: the minutes are still
 * ready for a vote at the version the board saw. The update is last, so the
 * inserts before it test the state as it was. A guard that fails changes no
 * rows anywhere -- the earlier version inserted the vote unconditionally and
 * relied on a thrown error to roll it back, but a zero-row update is not an
 * error, so the vote row stayed and every later vote hit its primary key.
 */
export async function recordVote(
  db: D1Database,
  input: VoteInput,
): Promise<boolean> {
  const ready: Guard = {
    sql: "select 1 from minutes where meeting_id = ? and status = 'ready_for_vote' and current_version = ?",
    binds: [input.meetingId, input.version],
  };
  const done = await db.batch([
    db
      .prepare(
        `insert into votes (meeting_id, version, sha256, voted_on, motion_by, seconded_by, yes, no, abstain, recorded_by, recorded_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? where exists (${ready.sql})`,
      )
      .bind(
        input.meetingId,
        input.version,
        input.sha256,
        input.voted_on,
        input.motion_by,
        input.seconded_by,
        input.yes,
        input.no,
        input.abstain,
        input.actorId,
        nowIso(),
        ...ready.binds,
      ),
    auditStatement(
      db,
      input.actorId,
      "approve",
      "minutes",
      input.meetingId,
      {
        version: input.version,
        sha256: input.sha256,
        yes: input.yes,
        no: input.no,
        abstain: input.abstain,
      },
      ready,
    ),
    db
      .prepare(
        "update minutes set status = 'approved' where meeting_id = ? and status = 'ready_for_vote' and current_version = ?",
      )
      .bind(input.meetingId, input.version),
  ]);
  return done[2]?.meta.changes === 1;
}

export function minutesRoutes() {
  // Editors and scoped roles never see minutes; only these roles do.
  const app = new Hono<AppEnv>();
  app.use("*", requireRole("admin", "secretary", "board", "reviewer"));

  app.get("/:id/minutes", async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const loaded = await loadMaybe(c.env.DB, m.id);
    if (!loaded) return c.json({ meeting: m, minutes: null });
    const { minutes: row, current } = loaded;
    const [versions, comments, reviews, vote] = await Promise.all([
      c.env.DB.prepare(
        `select v.version, v.sha256, v.change_note, v.created_at, ${AUTHOR}
           from minutes_versions v ${AUTHOR_JOIN("v.author_id")}
          where v.meeting_id = ? order by v.version desc`,
      )
        .bind(m.id)
        .all(),
      c.env.DB.prepare(
        `select c.*, ${AUTHOR}
           from review_comments c ${AUTHOR_JOIN("c.author_id")}
          where c.meeting_id = ? order by c.created_at`,
      )
        .bind(m.id)
        .all(),
      c.env.DB.prepare(
        `select r.user_id, u.name, r.reviewed_at, f.user_id is not null as former
           from reviews r join "user" u on u.id = r.user_id left join former_members f on f.user_id = r.user_id
          where r.meeting_id = ? and r.version = ?`,
      )
        .bind(m.id, row.current_version)
        .all(),
      c.env.DB.prepare("select * from votes where meeting_id = ?")
        .bind(m.id)
        .first(),
    ]);
    return c.json({
      meeting: m,
      minutes: row,
      current: { ...current, body: JSON.parse(current.body) },
      versions: versions.results,
      comments: comments.results,
      reviewed_by: reviews.results,
      vote,
    });
  });

  /** Save a new version. Allowed until the vote. `base_version` guards against overwriting someone else's save. */
  app.put("/:id/minutes", requireRole("secretary", "admin"), async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const input = z
      .object({
        base_version: z.number().int().min(0),
        body: MinutesBody,
        change_note: z.string().trim().max(500).optional(),
      })
      .parse(await readJson(c));
    const row = await c.env.DB.prepare(
      "select * from minutes where meeting_id = ?",
    )
      .bind(m.id)
      .first<MinutesRow>();
    if (row && !EDITABLE.includes(row.status)) {
      throw new HTTPException(409, {
        message:
          "These minutes have been approved and can no longer be changed.",
      });
    }
    const current = row?.current_version ?? 0;
    if (input.base_version !== current)
      throw new HTTPException(409, {
        message:
          "Someone else saved these minutes. Reload to see their changes.",
      });
    const sha = await contentHash(input.body);
    if (row) {
      const prev = await c.env.DB.prepare(
        "select sha256 from minutes_versions where meeting_id = ? and version = ?",
      )
        .bind(m.id, current)
        .first<{ sha256: string }>();
      if (prev?.sha256 === sha)
        return c.json({ version: current, sha256: sha, unchanged: true });
    }
    const version = current + 1;
    const actor = c.get("user").id;
    await batchOr409(
      c.env.DB,
      [
        c.env.DB.prepare(
          "insert into minutes_versions (meeting_id, version, body, sha256, change_note, author_id, created_at) values (?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          m.id,
          version,
          JSON.stringify(input.body),
          sha,
          input.change_note ?? null,
          actor,
          nowIso(),
        ),
        c.env.DB.prepare(
          "insert into minutes (meeting_id, current_version) values (?, ?) on conflict (meeting_id) do update set current_version = excluded.current_version",
        ).bind(m.id, version),
        auditStatement(c.env.DB, actor, "save", "minutes", m.id, {
          version,
          sha256: sha,
        }),
      ],
      "Someone else saved these minutes. Reload to see their changes.",
    );
    return c.json({ version, sha256: sha });
  });

  /** Move between draft, review and ready-for-vote. Approval and filing have their own endpoints. */
  app.post("/:id/minutes/transition", async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const { to } = z
      .object({ to: z.enum(["draft", "in_review", "ready_for_vote"]) })
      .parse(await readJson(c));
    const { minutes } = await load(c.env.DB, m.id);
    const user = c.get("user");
    if (!canTransition(minutes.status, to, rolesOf(user.grants))) {
      throw new HTTPException(409, {
        message: `Minutes that are ${minutes.status.replaceAll("_", " ")} cannot be moved to ${to.replaceAll("_", " ")}.`,
      });
    }
    /*
     * The status is checked above and set here, in two statements. The update
     * is conditional on the status not having moved in between, so the way to
     * find out whether it did is to ask how many rows changed -- reporting the
     * transition without asking told the caller a move had happened when the
     * database had refused it. The audit statement is guarded by the same
     * condition and runs first, so a refused update leaves no log entry
     * behind.
     */
    const still: Guard = {
      sql: "select 1 from minutes where meeting_id = ? and status = ?",
      binds: [m.id, minutes.status],
    };
    const moved = await c.env.DB.batch([
      auditStatement(
        c.env.DB,
        user.id,
        "transition",
        "minutes",
        m.id,
        { from: minutes.status, to },
        still,
      ),
      c.env.DB.prepare(
        "update minutes set status = ? where meeting_id = ? and status = ?",
      ).bind(to, m.id, minutes.status),
    ]);
    if (moved[1]?.meta.changes !== 1)
      throw new HTTPException(409, {
        message:
          "Someone else moved these minutes while you were looking. Reload to see where they are now.",
      });
    return c.json({ status: to });
  });

  app.post("/:id/minutes/comments", async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const input = z
      .object({
        anchor: z.string().trim().max(80).default(""),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(await readJson(c));
    const { minutes } = await load(c.env.DB, m.id);
    if (!EDITABLE.includes(minutes.status))
      throw new HTTPException(409, {
        message: "Comments are closed once minutes are approved.",
      });
    const id = crypto.randomUUID();
    const actor = c.get("user").id;
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into review_comments (id, meeting_id, version, anchor, body, author_id, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        id,
        m.id,
        minutes.current_version,
        input.anchor,
        input.body,
        actor,
        nowIso(),
      ),
      auditStatement(c.env.DB, actor, "comment", "minutes", m.id, {
        comment: id,
      }),
    ]);
    return c.json({ id, version: minutes.current_version }, 201);
  });

  app.post("/:id/minutes/comments/:commentId/resolve", async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const user = c.get("user");
    const comment = await c.env.DB.prepare(
      "select author_id, resolved_at from review_comments where id = ? and meeting_id = ?",
    )
      .bind(c.req.param("commentId"), m.id)
      .first<{ author_id: string; resolved_at: string | null }>();
    if (!comment)
      throw new HTTPException(404, { message: "That comment does not exist." });
    if (
      comment.author_id !== user.id &&
      !hasRole(user.grants, "secretary", "admin")
    ) {
      throw new HTTPException(403, {
        message:
          "Only the secretary or the person who wrote the comment can resolve it.",
      });
    }
    await c.env.DB.batch([
      c.env.DB.prepare(
        "update review_comments set resolved_at = ?, resolved_by = ? where id = ?",
      ).bind(nowIso(), user.id, c.req.param("commentId")),
      auditStatement(c.env.DB, user.id, "resolve_comment", "minutes", m.id, {
        comment: c.req.param("commentId"),
      }),
    ]);
    return c.body(null, 204);
  });

  /** A board member confirms they have read the current version. */
  app.post(
    "/:id/minutes/reviewed",
    requireRole("board", "secretary", "admin"),
    async (c) => {
      const m = await meetingOr404(c.env.DB, c.req.param("id"));
      const { minutes } = await load(c.env.DB, m.id);
      if (
        minutes.status !== "in_review" &&
        minutes.status !== "ready_for_vote"
      ) {
        throw new HTTPException(409, {
          message:
            "Minutes can be marked as reviewed only while they are in review.",
        });
      }
      const user = c.get("user");
      await c.env.DB.batch([
        auditStatement(
          c.env.DB,
          user.id,
          "review",
          "minutes",
          m.id,
          { version: minutes.current_version },
          {
            sql: "select 1 where not exists (select 1 from reviews where meeting_id = ? and version = ? and user_id = ?)",
            binds: [m.id, minutes.current_version, user.id],
          },
        ),
        c.env.DB.prepare(
          "insert into reviews (meeting_id, version, user_id, reviewed_at) values (?, ?, ?, ?) on conflict do nothing",
        ).bind(m.id, minutes.current_version, user.id, nowIso()),
      ]);
      return c.json({ version: minutes.current_version });
    },
  );

  /**
   * Record the board's vote. The request names the exact version and hash the
   * board saw; if the minutes changed since, the vote is refused.
   */
  app.post(
    "/:id/minutes/vote",
    requireRole("board", "secretary", "admin"),
    async (c) => {
      const m = await meetingOr404(c.env.DB, c.req.param("id"));
      const input = z
        .object({
          version: z.number().int().min(1),
          sha256: z.string().regex(/^[0-9a-f]{64}$/),
          voted_on: z.iso.date(),
          motion_by: z.string().trim().min(1).max(120),
          seconded_by: z.string().trim().min(1).max(120),
          yes: z.number().int().min(0),
          no: z.number().int().min(0),
          abstain: z.number().int().min(0),
        })
        .parse(await readJson(c));
      const { minutes, current } = await load(c.env.DB, m.id);
      const user = c.get("user");
      if (!canTransition(minutes.status, "approved", rolesOf(user.grants))) {
        throw new HTTPException(409, {
          message:
            "Minutes must be ready for a vote before the vote is recorded.",
        });
      }
      if (
        input.version !== current.version ||
        input.sha256 !== current.sha256
      ) {
        throw new HTTPException(409, {
          message:
            "The minutes changed after you opened them. Reload and check the latest version before voting.",
        });
      }
      if (input.yes <= input.no)
        throw new HTTPException(422, {
          message:
            "The motion to approve did not carry, so the minutes stay ready for a vote.",
        });
      const approved = await recordVote(c.env.DB, {
        ...input,
        meetingId: m.id,
        version: current.version,
        sha256: current.sha256,
        actorId: user.id,
      });
      if (!approved)
        throw new HTTPException(409, {
          message:
            "Someone else moved these minutes while you were looking. Reload to see where they are now.",
        });
      return c.json({
        status: "approved",
        version: current.version,
        sha256: current.sha256,
      });
    },
  );

  /** The approved minutes, for the browser to render as a PDF for PayHOA. Drafts cannot be exported. */
  app.get("/:id/minutes/export", async (c) => {
    const m = await meetingOr404(c.env.DB, c.req.param("id"));
    const { minutes, current } = await load(c.env.DB, m.id);
    if (!canExport(minutes.status))
      throw new HTTPException(409, {
        message: "Only approved minutes can be exported.",
      });
    const vote = await c.env.DB.prepare(
      "select * from votes where meeting_id = ?",
    )
      .bind(m.id)
      .first<{ sha256: string }>();
    if (!vote || vote.sha256 !== current.sha256)
      throw new HTTPException(500, {
        message:
          "The approved version does not match the vote. Contact an administrator.",
      });
    return c.json({
      meeting: m,
      body: JSON.parse(current.body),
      version: current.version,
      sha256: current.sha256,
      vote,
    });
  });

  /** Record that the approved PDF was uploaded to PayHOA. */
  app.post(
    "/:id/minutes/file",
    requireRole("secretary", "admin"),
    async (c) => {
      const m = await meetingOr404(c.env.DB, c.req.param("id"));
      const { note } = Note.parse(await readJson(c));
      const { minutes, current } = await load(c.env.DB, m.id);
      const user = c.get("user");
      if (!canTransition(minutes.status, "filed", rolesOf(user.grants))) {
        throw new HTTPException(409, {
          message: "Only approved minutes can be marked as uploaded to PayHOA.",
        });
      }
      const stillApproved: Guard = {
        sql: "select 1 from minutes where meeting_id = ? and status = 'approved'",
        binds: [m.id],
      };
      const filed = await c.env.DB.batch([
        auditStatement(
          c.env.DB,
          user.id,
          "file",
          "minutes",
          m.id,
          { version: current.version, sha256: current.sha256, note },
          stillApproved,
        ),
        c.env.DB.prepare(
          "update minutes set status = 'filed', filed_at = ?, filed_by = ?, filed_note = ? where meeting_id = ? and status = 'approved'",
        ).bind(nowIso(), user.id, note, m.id),
      ]);
      if (filed[1]?.meta.changes !== 1)
        throw new HTTPException(409, {
          message:
            "Someone else moved these minutes while you were looking. Reload to see where they are now.",
        });
      return c.json({ status: "filed" });
    },
  );

  return app;
}
