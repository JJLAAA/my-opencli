export function printOutput(data, format, columns) {
  const rows = Array.isArray(data) ? data : [data];

  if (format === 'json') {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const cols = columns ?? Object.keys(rows[0] ?? {});
  const widths = cols.map(c =>
    Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length))
  );

  console.log(cols.map((c, i) => c.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w + 2)).join('+'));
  for (const row of rows)
    console.log(cols.map((c, i) => String(row[c] ?? '').padEnd(widths[i])).join(' | '));
}
