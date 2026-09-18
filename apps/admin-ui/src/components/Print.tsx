import { useEffect, useState } from "preact/hooks";
import {
  api,
  longDate,
  messageFrom,
  param,
  type ExportResponse,
  typeLabel,
} from "../lib/api.ts";
import { MinutesView } from "./MinutesView.tsx";
import { ErrorNotice, Loading } from "./Notice.tsx";

/**
 * The approved minutes laid out for paper. "Save as PDF" uses the browser's
 * own print-to-PDF, so the Worker does no PDF work (Workers Free allows 10 ms
 * of CPU per request).
 */
export default function Print() {
  const [data, setData] = useState<ExportResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<ExportResponse>("GET", `/meetings/${param("id")}/minutes/export`).then(
      (d) => {
        setData(d);
        document.title = `Minutes ${d.meeting.date} ${typeLabel[d.meeting.type]}`;
      },
      (e: unknown) => setError(messageFrom(e)),
    );
  }, []);

  if (!data) return error ? <ErrorNotice message={error} /> : <Loading />;
  const { meeting: m, vote } = data;
  return (
    <article class="print-doc">
      <div class="actions no-print">
        <button class="button" type="button" onClick={() => print()}>
          Save as PDF
        </button>
        <span class="meta">
          In the print dialog, choose "Save as PDF" as the destination, then
          upload the file to PayHOA.
        </span>
      </div>
      <header>
        <p class="print-org">Discovery Homeowners Association, Inc.</p>
        <h1>Minutes of the {typeLabel[m.type].toLowerCase()}</h1>
        <p>
          {longDate(m.date)}, {m.time}, {m.location}
        </p>
      </header>
      <MinutesView body={data.body} />
      <footer class="print-approval">
        <p>
          These minutes were approved by the Board of Directors on{" "}
          {longDate(vote.voted_on)}. Motion by {vote.motion_by}, seconded by{" "}
          {vote.seconded_by}; {vote.yes} in favor, {vote.no} against,{" "}
          {vote.abstain} abstaining.
        </p>
        <p class="meta">
          Approved version {data.version}. Fingerprint{" "}
          {data.sha256.slice(0, 16)}.
        </p>
      </footer>
    </article>
  );
}
