import { todayInNewYork, type ExportDataset } from "@dhoa/shared";
import { api } from "./api.ts";

/**
 * Gathering the association's data, in the browser.
 *
 * The Worker gets 10 ms of CPU per request and the site snapshot alone spends
 * 22 to 35 ms of it, so a full export cannot be assembled there. It is
 * assembled here instead, from the endpoints that already own each piece --
 * which is also what enforces who may take what: the server refuses in the
 * same place it always does, rather than trusting a hidden checkbox.
 */
export type Rows = Record<string, unknown>[];

/**
 * One dataset, in two shapes on purpose. `json` keeps each thing's own shape,
 * which is what an association walking away with its data wants. `tables` is
 * the same thing flattened into rectangles, because that is the only shape a
 * spreadsheet has.
 */
export type Collected = { json: unknown; tables: Record<string, Rows> };

type Meeting = { id: string; date: string };

/** A few at a time: enough to be quick, not enough to flood a small Worker. */
async function each<T, R>(
  items: readonly T[],
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let at = 0; at < items.length; at += 4)
    out.push(...(await Promise.all(items.slice(at, at + 4).map(run))));
  return out;
}

/** Settings are an object of objects; a spreadsheet wants one row per field. */
const settingsRows = (settings: Record<string, unknown>): Rows =>
  Object.entries(settings).flatMap(([group, value]) =>
    Object.entries(value as Record<string, unknown>).map(([field, v]) => ({
      group,
      field,
      value: v,
    })),
  );

const KINDS = ["news", "event", "page", "document"] as const;

export async function collect(key: ExportDataset): Promise<Collected> {
  switch (key) {
    case "roster": {
      const [people, committees] = await Promise.all([
        api<Rows>("GET", "/roster/people"),
        api<Rows>("GET", "/roster/committees"),
      ]);
      return { json: { people, committees }, tables: { people, committees } };
    }
    case "meetings": {
      const meetings = await api<Meeting[]>("GET", "/meetings");
      const agendas = await each(meetings, async (m) => ({
        meeting_id: m.id,
        date: m.date,
        ...(await api<Record<string, unknown>>(
          "GET",
          `/meetings/${m.id}/agenda`,
        )),
      }));
      return {
        json: { meetings, agendas },
        tables: { meetings: meetings as Rows, agendas },
      };
    }
    case "minutes": {
      const meetings = await api<Meeting[]>("GET", "/meetings");
      const minutes = await each(meetings, async (m) => ({
        meeting_id: m.id,
        date: m.date,
        ...(await api<Record<string, unknown>>(
          "GET",
          `/meetings/${m.id}/minutes`,
        )),
      }));
      return { json: minutes, tables: { minutes } };
    }
    case "content": {
      const lists = await each(KINDS, (kind) =>
        api<Rows>("GET", `/items?kind=${kind}`),
      );
      const items = lists.flat();
      return { json: items, tables: { content: items } };
    }
    case "settings": {
      const settings = await api<Record<string, unknown>>("GET", "/settings");
      return { json: settings, tables: { settings: settingsRows(settings) } };
    }
    case "accounts": {
      const accounts = await api<Rows>("GET", "/users");
      return { json: accounts, tables: { accounts } };
    }
    case "audit": {
      // Paged: the endpoint answers one page at a time so that nothing can
      // push older entries out of reach, which means an export that wants the
      // whole log has to walk it. The browser is the right place for that loop.
      const rows: Rows = [];
      // A stop, so a log far larger than anyone expects cannot spin the tab.
      for (let page = 0; page < 500; page++) {
        const last = rows.at(-1);
        const got = await api<Rows>(
          "GET",
          last ? `/audit?before=${String(last.id)}` : "/audit",
        );
        if (got.length === 0) break;
        rows.push(...got);
      }
      const audit = rows.map((r) => ({
        ...r,
        detail:
          typeof r.detail === "string" && r.detail
            ? (JSON.parse(r.detail) as unknown)
            : null,
      }));
      return { json: audit, tables: { audit } };
    }
  }
}

/** Hands the browser a file. Nothing is uploaded; the bytes never leave. */
export function download(name: string, type: string, text: string) {
  // A BOM, so Excel reads the UTF-8 rather than guessing at it.
  const body = type.startsWith("text/csv") ? `﻿${text}` : text;
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // In the document and revoked a beat later: a detached anchor and an
  // immediately revoked URL both have browsers where the download never
  // starts, and this app is used in whatever the board has.
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * The date to put in the file name, as the association reckons it.
 *
 * `toISOString()` would be UTC, so an export taken on a Tuesday evening in
 * Maryland would be filed under Wednesday. The rest of the site already
 * decides dates this way.
 */
export const stamp = () => todayInNewYork();
