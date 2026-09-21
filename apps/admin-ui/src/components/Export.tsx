import {
  EXPORT_DATASETS,
  toCsv,
  type ExportDataset,
  type ExportFormat,
} from "@dhoa/shared";
import { useState } from "preact/hooks";
import { api, can, messageFrom } from "../lib/api.ts";
import { collect, download, stamp, type Rows } from "../lib/export.ts";
import { useMe } from "../lib/use-me.ts";
import { ErrorNotice, Saved } from "./Notice.tsx";
import { PageHead } from "./PageHead.tsx";

/**
 * Taking the association's data out.
 *
 * Everything is gathered in the browser from endpoints that each enforce
 * their own roles, so this screen offering a checkbox is a convenience, not
 * the control: ticking one you may not read gets a refusal from the server.
 */
export function Export() {
  const { me } = useMe();
  const [chosen, setChosen] = useState<ExportDataset[]>(["roster"]);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [table, setTable] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const allowed = EXPORT_DATASETS.filter(
    (d) => d.roles.length === 0 || can(me, ...d.roles),
  );
  const picked = allowed.filter((d) => chosen.includes(d.key));

  const toggle = (key: ExportDataset, on: boolean) => {
    setChosen(on ? [...chosen, key] : chosen.filter((k) => k !== key));
    setSaved("");
  };

  async function take(event: Event) {
    event.preventDefault();
    if (picked.length === 0) return setError("Choose what to take.");
    setError("");
    setSaved("");
    setBusy(true);
    try {
      const gathered = await Promise.all(
        picked.map(async (d) => [d.key, await collect(d.key)] as const),
      );
      const day = stamp();
      if (format === "json") {
        download(
          `discovery-${day}.json`,
          "application/json",
          JSON.stringify(
            {
              exported_at: new Date().toISOString(),
              exported_by: me?.email ?? "",
              data: Object.fromEntries(
                gathered.map(([key, got]) => [key, got.json]),
              ),
            },
            null,
            2,
          ),
        );
      } else {
        const tables = new Map<string, Rows>();
        for (const [, got] of gathered)
          for (const [name, rows] of Object.entries(got.tables))
            tables.set(name, rows);
        const name = tables.has(table) ? table : [...tables.keys()][0];
        if (!name) throw new Error("There is nothing in what you chose.");
        download(
          `discovery-${name}-${day}.csv`,
          "text/csv;charset=utf-8",
          toCsv(tables.get(name) ?? []),
        );
      }
      // Recorded after the file is made, so the log says what was actually taken.
      await api("POST", "/audit/export", {
        datasets: picked.map((d) => d.key),
        format,
      });
      setSaved("Your file has been downloaded, and the export is in the log.");
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(false);
    }
  }

  // Only offered for CSV, where a file is one rectangle and has to be chosen.
  const tableNames = [
    ...new Set(
      picked.flatMap((d) =>
        d.key === "roster"
          ? ["people", "committees"]
          : d.key === "meetings"
            ? ["meetings", "agendas"]
            : [d.key],
      ),
    ),
  ];

  return (
    <>
      <PageHead
        title="Export"
        lede="Take a copy of the association's data. Everything here is gathered in your browser and saved straight to this device."
      />
      <ErrorNotice message={error} />
      <Saved message={saved} />
      <form class="panel" onSubmit={take}>
        <fieldset>
          <legend>What to take</legend>
          {allowed.map((d) => (
            <div class="choice" key={d.key}>
              <input
                id={`take-${d.key}`}
                type="checkbox"
                checked={chosen.includes(d.key)}
                onChange={(e) => toggle(d.key, e.currentTarget.checked)}
              />
              <label for={`take-${d.key}`}>
                <strong>{d.label}</strong>
                <span class="meta">{d.note}</span>
              </label>
            </div>
          ))}
        </fieldset>

        <div class="field">
          <label for="format">Format</label>
          <select
            id="format"
            value={format}
            onChange={(e) => {
              setFormat(e.currentTarget.value as ExportFormat);
              setSaved("");
            }}
          >
            <option value="json">JSON — everything, in its own shape</option>
            <option value="csv">CSV — one table, for a spreadsheet</option>
          </select>
          <span class="hint">
            {format === "json"
              ? "One file holding everything you ticked. This is the one to keep."
              : "A spreadsheet is one rectangle, so a CSV holds one table at a time. Text a spreadsheet would run as a formula is marked with a quote so that it shows instead; choose JSON if you need the wording untouched."}
          </span>
        </div>

        {format === "csv" && tableNames.length > 1 && (
          <div class="field">
            <label for="table">Which table</label>
            <select
              id="table"
              value={table || tableNames[0]}
              onChange={(e) => setTable(e.currentTarget.value)}
            >
              {tableNames.map((t) => (
                <option value={t} key={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        <div class="actions">
          <button class="button" type="submit" disabled={busy}>
            {busy ? "Gathering…" : "Download"}
          </button>
        </div>
      </form>

      <h2>What is not here</h2>
      <p class="prose">
        Uploaded files are not included. They are the documents themselves
        rather than a record of them, and each has its own link on the Documents
        page.
      </p>
      <p class="prose">
        Every export is written to the audit log, with who took it and what they
        took. An export of accounts is personal data about the people on it, so
        keep the file somewhere you would be willing to keep a printed roster.
      </p>
    </>
  );
}
