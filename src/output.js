function normalizeRows(data) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.map(row => row && typeof row === 'object' ? row : { value: row });
}

function adapterLabel(options) {
  return [options.site, options.command].filter(Boolean).join(' ');
}

function validateOutputFields(adapter, options) {
  const fields = adapter?.output?.fields;

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    const label = adapterLabel(options);
    throw new Error(
      `Adapter${label ? ` "${label}"` : ''} must define output.fields for JSON output.`
    );
  }

  const entries = Object.entries(fields);
  if (!entries.length) throw new Error('Adapter output.fields must declare at least one field.');

  for (const [name, field] of entries) {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      throw new Error(`Adapter output.fields.${name} must be an object.`);
    }
    if (typeof field.type !== 'string' || !field.type) {
      throw new Error(`Adapter output.fields.${name}.type must be a non-empty string.`);
    }
    if (typeof field.description !== 'string' || !field.description) {
      throw new Error(`Adapter output.fields.${name}.description must be a non-empty string.`);
    }
  }

  return fields;
}

export function validateJsonOutputSchema(adapter, options = {}) {
  validateOutputFields(adapter, options);
}

function buildSchema(output, fields) {
  return {
    type: 'array',
    itemName: output?.itemName,
    items: {
      type: 'object',
      properties: fields,
    },
  };
}

function projectRows(rows, fields) {
  const fieldNames = Object.keys(fields);
  const warnings = [];
  const missing = new Set();
  const dropped = new Set();

  const items = rows.map(row => {
    const item = {};
    for (const name of fieldNames) {
      if (Object.prototype.hasOwnProperty.call(row, name)) {
        item[name] = row[name];
      } else {
        item[name] = null;
        missing.add(name);
      }
    }

    for (const name of Object.keys(row)) {
      if (!fields[name]) dropped.add(name);
    }

    return item;
  });

  if (missing.size) warnings.push(`Missing declared field(s): ${[...missing].join(', ')}`);
  if (dropped.size) warnings.push(`Dropped undeclared field(s): ${[...dropped].join(', ')}`);

  return { items, warnings };
}

function formatJsonEnvelope(data, options) {
  const adapter = options.adapter ?? {};
  const fields = validateOutputFields(adapter, options);
  const rows = normalizeRows(data);
  const { items, warnings } = projectRows(rows, fields);

  const meta = {
    site: options.site,
    command: options.command,
    resultType: adapter.output?.type ?? 'list',
    generatedAt: new Date().toISOString(),
    args: options.args ?? {},
  };
  if (warnings.length) meta.warnings = warnings;

  return {
    meta,
    schema: buildSchema(adapter.output, fields),
    items,
  };
}

export function printOutput(data, format, options = {}) {
  const rows = normalizeRows(data);

  if (format === 'json') {
    console.log(JSON.stringify(formatJsonEnvelope(data, options), null, 2));
    return;
  }

  const cols = options.columns ?? options.adapter?.columns ?? Object.keys(rows[0] ?? {});
  const widths = cols.map(c =>
    Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length))
  );

  console.log(cols.map((c, i) => c.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w + 2)).join('+'));
  for (const row of rows)
    console.log(cols.map((c, i) => String(row[c] ?? '').padEnd(widths[i])).join(' | '));
}
