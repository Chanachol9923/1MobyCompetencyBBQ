/** Minimal CSV writer + browser download used by the Gap Analysis export. */

function escapeCell(value: string | number) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

/** Triggers a real file download. The BOM keeps Thai readable in Excel. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
