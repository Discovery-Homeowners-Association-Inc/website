/**
 * Rows to CSV, for the exports a treasurer opens in a spreadsheet.
 *
 * RFC 4180: fields containing a comma, a quote, a line break or surrounding
 * space are quoted, and a quote inside a field is doubled. Lines end CRLF,
 * which is what the RFC says and what Excel is happiest with.
 *
 * A spreadsheet is a rectangle and the data is not, so anything that is not a
 * string or a number is written as JSON in the cell. That keeps the value
 * readable and, more importantly, keeps it -- a CSV export that silently drops
 * the nested half of a record is worse than one that looks a bit technical.
 */

/**
 * Text a spreadsheet would run instead of showing.
 *
 * Excel, LibreOffice and Sheets treat a cell beginning with =, +, - or @ as a
 * formula, and a leading tab or carriage return can smuggle one in. That
 * matters here because the data is typed by people: an editor chooses the
 * title of a news item, and an administrator is the one who later exports
 * content to CSV and opens it. Without this, an editor could write a formula
 * into a title and have it run on someone else's machine.
 */
const FORMULA = /^[=+\-@\t\r]/;

const cell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  // Numbers are not guarded: a number cannot be a formula, and "-5" has to
  // stay a negative five rather than become text.
  const text =
    typeof value === "string"
      ? FORMULA.test(value)
        ? `'${value}`
        : value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  return /[",\r\n]|^\s|\s$/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
};

/**
 * @param rows objects with any shape; the columns are the union of their keys,
 *   in the order each key is first seen, so the first row's shape leads.
 */
export function toCsv(rows: readonly Record<string, unknown>[]): string {
  const columns: string[] = [];
  for (const row of rows)
    for (const key of Object.keys(row))
      if (!columns.includes(key)) columns.push(key);
  if (columns.length === 0) return "";
  const lines = [columns.map(cell).join(",")];
  for (const row of rows)
    lines.push(columns.map((c) => cell(row[c])).join(","));
  return lines.join("\r\n");
}
