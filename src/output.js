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

function maskItems(items, effectiveFields) {
  const fieldNames = Object.keys(effectiveFields);
  return items.map(item => Object.fromEntries(fieldNames.map(k => [k, item[k] ?? null])));
}

function applyFieldMask(fields, mask) {
  const requested = mask.split(',').map(s => s.trim()).filter(Boolean);
  const masked = {};
  const unknown = [];
  for (const name of requested) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) {
      masked[name] = fields[name];
    } else {
      unknown.push(name);
    }
  }
  return { masked, unknown, requested };
}

function formatJsonEnvelope(data, options) {
  const adapter = options.adapter ?? {};
  const fields = validateOutputFields(adapter, options);
  const rows = normalizeRows(data);

  let effectiveFields = fields;
  const maskWarnings = [];
  if (typeof options.fields === 'string' && options.fields.length) {
    const { masked, unknown, requested } = applyFieldMask(fields, options.fields);
    if (unknown.length) maskWarnings.push(`Unknown field(s) in --fields: ${unknown.join(', ')}`);
    if (Object.keys(masked).length) {
      effectiveFields = masked;
    } else if (requested.length) {
      maskWarnings.push('No valid fields matched --fields; falling back to full schema.');
    }
  }

  const { items: allItems, warnings } = projectRows(rows, fields);
  const items = effectiveFields === fields ? allItems : maskItems(allItems, effectiveFields);

  const meta = {
    site: options.site,
    command: options.command,
    resultType: adapter.output?.type ?? 'list',
    generatedAt: new Date().toISOString(),
    args: options.args ?? {},
  };
  const allWarnings = [...maskWarnings, ...warnings];
  if (allWarnings.length) meta.warnings = allWarnings;

  return {
    meta,
    schema: buildSchema(adapter.output, effectiveFields),
    items,
  };
}

export function printOutput(data, format, options = {}) {
  if (format === 'json') {
    console.log(JSON.stringify(formatJsonEnvelope(data, options), null, 2));
    return;
  }

  throw new Error(`Unsupported output format: ${format}`);
}
