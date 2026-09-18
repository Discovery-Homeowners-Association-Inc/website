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
const cell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "string"
      ? value
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
