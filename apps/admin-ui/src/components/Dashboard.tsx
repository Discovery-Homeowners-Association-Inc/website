import { capitalize, todayInNewYork } from "@dhoa/shared";
import type { Item } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import {
  api,
  can,
  longDate,
  messageFrom,
  statusLabel,
  type MeetingListItem,
  typeLabel,
} from "../lib/api.ts";
import { KINDS } from "../lib/content.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";

export default function Dashboard() {
  const { me, error: meError } = useMe();
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null);
  const [pendingItems, setPendingItems] = useState<
    (Item & { author: string | null })[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<MeetingListItem[]>("GET", "/meetings").then(setMeetings, (e: unknown) =>
      setError(messageFrom(e)),
    );
    void Promise.all(
      Object.keys(KINDS).map((k) =>
        api<(Item & { author: string | null })[]>("GET", `/items?kind=${k}`),
      ),
    ).then(
      (lists) =>
        setPendingItems(lists.flat().filter((i) => i.status === "pending")),
      () => {},
    );
  }, []);

  if (meError || error) return <ErrorNotice message={meError || error} />;
  if (!me || !meetings) return <Loading />;

  const today = todayInNewYork();
  const upcoming = meetings
    .filter((m) => m.date >= today && m.status !== "canceled")
    .toSorted((a, b) => a.date.localeCompare(b.date));
  const inReview = meetings.filter(
    (m) =>
      m.minutes_status === "in_review" || m.minutes_status === "ready_for_vote",
  );
  const toFile = meetings.filter((m) => m.minutes_status === "approved");
  const seesMinutes = can(me, "admin", "secretary", "board", "reviewer");

  return (
    <>
      <PageHead title={`Hello, ${me.name.split(" ")[0]}`} />
      <p class="meta">
        Your roles:{" "}
        {me.grants
          .map((g) => (g.scope ? `${g.role} (${g.scope})` : g.role))
          .join(", ")}
      </p>

      {can(me, "admin", "secretary", "board") && pendingItems.length > 0 && (
        <section>
          <h2>Waiting for approval</h2>
          <ul class="tasks">
            {pendingItems.map((i) => (
              <li key={i.id}>
                <a href={`${KINDS[i.kind].path}edit/?id=${i.id}`}>
                  <strong>{i.body.title}</strong>
                  <span>
                    {capitalize(KINDS[i.kind].one)}
                    {i.author && ` by ${i.author}`}. Read it, then approve or
                    send it back.
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {seesMinutes && (
        <section>
          <h2>Minutes waiting on the board</h2>
          {inReview.length === 0 ? (
            <p>Nothing is in review right now.</p>
          ) : (
            <ul class="tasks">
              {inReview.map((m) => (
                <li key={m.id}>
                  <a href={`/minutes/?id=${m.id}`}>
                    <strong>
                      {typeLabel[m.type]}, {longDate(m.date)}
                    </strong>
                    <span>
                      {m.minutes_status ? statusLabel[m.minutes_status] : ""}.
                      Read, comment, and mark as reviewed.
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {can(me, "admin", "secretary") && toFile.length > 0 && (
        <section>
          <h2>Approved, not yet uploaded to PayHOA</h2>
          <ul class="tasks">
            {toFile.map((m) => (
              <li key={m.id}>
                <a href={`/minutes/?id=${m.id}`}>
                  <strong>
                    {typeLabel[m.type]}, {longDate(m.date)}
                  </strong>
                  <span>Export the PDF, upload it, then mark it filed.</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Coming up</h2>
        {upcoming.length === 0 ? (
          <p>
            No meetings are scheduled.{" "}
            {can(me, "admin", "secretary") && (
              <a href="/meetings/">Add a meeting</a>
            )}
          </p>
        ) : (
          <ul class="tasks">
            {upcoming.slice(0, 4).map((m) => (
              <li key={m.id}>
                <a href={`/meeting/?id=${m.id}`}>
                  <strong>
                    {typeLabel[m.type]}, {longDate(m.date)}
                  </strong>
                  <span>
                    {m.time}, {m.location}. Agenda:{" "}
                    {m.agenda_status === "published"
                      ? "published"
                      : m.agenda_status === "draft"
                        ? "draft"
                        : "not started"}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Update the site</h2>
        <ul class="tasks">
          {Object.values(KINDS).map((k) => (
            <li key={k.kind}>
              <a href={k.path}>
                <strong>{k.many}</strong>
                <span>{k.intro}</span>
              </a>
            </li>
          ))}
          <li>
            <a href="/roster/">
              <strong>The roster</strong>
              <span>Who serves on the board and committees.</span>
            </a>
          </li>
          {can(me, "admin") && (
            <li>
              <a href="/settings/">
                <strong>Site settings</strong>
                <span>
                  Phone numbers, hours, dues, fees and other facts shown across
                  the site.
                </span>
              </a>
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
