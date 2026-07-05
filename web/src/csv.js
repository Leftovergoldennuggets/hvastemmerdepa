// CSV export for journalists. Semicolon-separated with a UTF-8 BOM so files
// open correctly in Norwegian Excel; values quoted only when needed.
function esc(v) {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

export function downloadCsv(filename, headers, rows) {
  const text = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
