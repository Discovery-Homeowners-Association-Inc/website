import { todayInNewYork } from "@dhoa/shared";
import { useEffect, useState } from "preact/hooks";
import {
  api,
  can,
  longDate,
  messageFrom,
  statusLabel,
  type MeetingListItem,
  type MeetingType,
  typeLabel,
} from "../lib/api.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";

const blank = {
  type: "board" as MeetingType,
  date: "",
  time: "",
  location: "",
};

export default function Meetings() {
  const { me } = useMe();
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  const load = () =>
    api<MeetingListItem[]>("GET", "/meetings").then(setMeetings, (e: unknown) =>
      setError(messageFrom(e)),
    );
  useEffect(() => void load(), []);
  useEffect(() => {
    api<{ meetings: { board: { time: string; location: string } } }>(
      "GET",
      "/settings/organization",
    ).then(
      (o) =>
        setForm((f) => ({
          ...f,
          time: o.meetings.board.time,
          location: o.meetings.board.location,
        })),
      () => {},
    );
  }, []);

  async function create(event: Event) {
    event.preventDefault();
    setError("");
    try {
      const m = await api<{ id: string }>("POST", "/meetings", form);
      location.assign(`/meeting/?id=${m.id}`);
    } catch (e) {
      setError(messageFrom(e));
    }
  }

  if (!meetings) return error ? <ErrorNotice message={error} /> : <Loading />;
  const seesMinutes = can(me, "admin", "secretary", "board", "reviewer");

  return (
    <>
      <PageHead title="Meetings" />
      <ErrorNotice message={error} />
      {can(me, "admin", "secretary") && (
        <form class="panel" onSubmit={create}>
          <h2>Add a meeting</h2>
          <div class="row">
            <div class="field">
              <label for="m-type">Type</label>
              <select
                id="m-type"
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.currentTarget.value as MeetingType,
                  })
                }
              >
                {Object.entries(typeLabel).map(([k, v]) => (
                  <option value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div class="field">
              <label for="m-date">Date</label>
              <input
                id="m-date"
                type="date"
                required
                value={form.date}
                onInput={(e) =>
                  setForm({ ...form, date: e.currentTarget.value })
                }
              />
            </div>
            <div class="field">
              <label for="m-time">Time</label>
              <input
                id="m-time"
                type="text"
                required
                pattern="\d{1,2}:\d{2} (am|pm)"
                value={form.time}
                onInput={(e) =>
                  setForm({ ...form, time: e.currentTarget.value })
                }
              />
              <span class="hint">Like 7:00 pm</span>
            </div>
            <div class="field">
              <label for="m-location">Location</label>
              <input
                id="m-location"
                type="text"
                required
                value={form.location}
                onInput={(e) =>
                  setForm({ ...form, location: e.currentTarget.value })
                }
              />
            </div>
          </div>
          <button class="button" type="submit">
            Add meeting
          </button>
        </form>
      )}
      {(() => {
        /*
         * Nearest first, in two groups. A flat list newest-first was right when
         * the table only held meetings that had happened; now the schedule
         * fills a year ahead, so it put August of next year at the top and
         * buried the meeting the board is actually working on.
         *
         * The two jobs both sit next to today: an agenda for the next meeting,
         * minutes for the one just held. So each is the first row of its group.
         */
        const today = todayInNewYork();
        const upcoming = meetings
          .filter((m) => m.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date));
        const past = meetings
          .filter((m) => m.date < today)
          .sort((a, b) => b.date.localeCompare(a.date));
        const columns = seesMinutes ? 4 : 3;

        const rows = (list: MeetingListItem[]) =>
          list.map((m) => (
            <tr key={m.id}>
              <td>
                <a href={`/meeting/?id=${m.id}`}>{longDate(m.date)}</a>
                {m.status === "canceled" && (
                  <span class="status status--none"> Canceled</span>
                )}
              </td>
              <td>{typeLabel[m.type]}</td>
              <td>
                <span class={`status status--${m.agenda_status ?? "none"}`}>
                  {m.agenda_status === "published"
                    ? m.agenda_version !== m.agenda_published_version
                      ? "Published, with unpublished changes"
                      : "Published"
                    : m.agenda_status === "draft"
                      ? "Draft"
                      : "None yet"}
                </span>
              </td>
              {seesMinutes && (
                <td>
                  <span class={`status status--${m.minutes_status ?? "none"}`}>
                    {m.minutes_status
                      ? statusLabel[m.minutes_status]
                      : "None yet"}
                  </span>
                </td>
              )}
            </tr>
          ));

        return (
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Meeting</th>
                  <th scope="col">Agenda</th>
                  {seesMinutes && <th scope="col">Minutes</th>}
                </tr>
              </thead>
              {upcoming.length > 0 && (
                <tbody>
                  <tr>
                    <th scope="rowgroup" colSpan={columns} class="group-head">
                      Upcoming
                    </th>
                  </tr>
                  {rows(upcoming)}
                </tbody>
              )}
              {past.length > 0 && (
                <tbody>
                  <tr>
                    <th scope="rowgroup" colSpan={columns} class="group-head">
                      Past
                    </th>
                  </tr>
                  {rows(past)}
                </tbody>
              )}
            </table>
          </div>
        );
      })()}
      {meetings.length === 0 && <p>No meetings yet.</p>}
    </>
  );
}
