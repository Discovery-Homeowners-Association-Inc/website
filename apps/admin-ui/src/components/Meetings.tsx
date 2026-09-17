import { useEffect, useState } from "preact/hooks";
import {
  api,
  can,
  longDate,
  type MeetingListItem,
  type MeetingType,
  statusLabel,
  typeLabel,
} from "../lib/api.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Loading } from "./Notice.tsx";

const blank = {
  type: "board" as MeetingType,
  date: "",
  time: "7:00 pm",
  location: "Discovery Recreation Center",
};

export default function Meetings() {
  const { me } = useMe();
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  const load = () =>
    api<MeetingListItem[]>("GET", "/meetings").then(setMeetings, (e: Error) =>
      setError(e.message),
    );
  useEffect(() => void load(), []);

  async function create(event: Event) {
    event.preventDefault();
    setError("");
    try {
      const m = await api<{ id: string }>("POST", "/meetings", form);
      location.assign(`/meeting/?id=${m.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!meetings) return error ? <ErrorNotice message={error} /> : <Loading />;
  const seesMinutes = can(me, "admin", "secretary", "board", "reviewer");

  return (
    <>
      <h1>Meetings</h1>
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
          <tbody>
            {meetings.map((m) => (
              <tr>
                <td>
                  <a href={`/meeting/?id=${m.id}`}>{longDate(m.date)}</a>
                  {m.status === "cancelled" && (
                    <span class="status status--none"> Cancelled</span>
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
                        : "Not started"}
                  </span>
                </td>
                {seesMinutes && (
                  <td>
                    <a href={`/minutes/?id=${m.id}`}>
                      <span
                        class={`status status--${m.minutes_status ?? "none"}`}
                      >
                        {m.minutes_status
                          ? statusLabel[m.minutes_status]
                          : "Not started"}
                      </span>
                    </a>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meetings.length === 0 && <p>No meetings yet.</p>}
    </>
  );
}
