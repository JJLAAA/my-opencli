import { AdapterLoadError, listAdapters, loadAdapter } from './adapters.js';

const SCHEMA_VERSION = 1;

const MANAGEMENT_COMMANDS = {
  doctor: {
    description: 'Diagnose local TAP setup.',
    args: [],
  },
  'browser status': {
    description: 'Show Chrome browser status.',
    args: [],
  },
  'browser start': {
    description: 'Start the Chrome browser for automation.',
    args: [
      { name: 'headless', type: 'boolean', description: 'Run Chrome in headless mode.' },
      { name: 'foreground', type: 'boolean', description: 'Run Chrome in a visible window.' },
    ],
  },
  'browser stop': {
    description: 'Stop the running Chrome browser.',
    args: [],
  },
  setup: {
    description: 'Initialize local TAP files explicitly.',
    args: [
      { name: 'force', type: 'boolean', description: 'Overwrite existing configuration.' },
    ],
  },
  'skill install': {
    description: 'Install bundled AI assistant skills.',
    args: [
      { name: 'force', type: 'boolean', description: 'Force reinstallation.' },
      { name: 'target', type: 'string', description: 'Installation target directory.' },
    ],
  },
  'adapter install': {
    description: 'Install an adapter pack from a remote source.',
    args: [
      { name: 'source', type: 'string', description: 'Source to install from (github:<owner>/<repo>, url:<https-url>, or git:<git-url>).' },
      { name: 'force', type: 'boolean', description: 'Overwrite existing adapter files.' },
    ],
  },
  'adapter list': {
    description: 'List installed adapter packs.',
    args: [],
  },
  'adapter remove': {
    description: 'Remove an installed adapter pack.',
    args: [
      { name: 'name', type: 'string', description: 'Name of the adapter pack to remove.' },
    ],
  },
};

export function inferType(def) {
  if (def.type) return def.type;
  if (def.default === true || def.default === false) return 'boolean';
  if (typeof def.default === 'number') return Number.isInteger(def.default) ? 'integer' : 'number';
  return 'string';
}

export function normalizeArg(def) {
  const type = inferType(def);
  return {
    name: def.name,
    flag: `--${def.name}`,
    type,
    required: def.required ?? false,
    description: def.description ?? null,
    default: def.default ?? null,
    enum: def.enum ?? null,
    minimum: def.minimum ?? null,
    maximum: def.maximum ?? null,
    format: def.format ?? null,
    examples: def.examples ?? null,
  };
}

function buildOutputSchema(adapter) {
  if (!adapter.output) return null;
  return {
    type: adapter.output.type ?? 'array',
    itemName: adapter.output.itemName ?? null,
    items: adapter.output.fields
      ? {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(adapter.output.fields).map(([name, field]) => [
              name,
              { type: field.type ?? 'string', description: field.description ?? null },
            ])
          ),
        }
      : null,
  };
}

export async function buildSiteSchema(site) {
  const adapters = listAdapters();
  const siteEntry = adapters.find(entry => entry.site === site);
  if (!siteEntry) return null;

  const commands = [];

  for (const command of siteEntry.commands) {
    const entry = {
      kind: 'adapter',
      site,
      command,
      name: `${site} ${command}`,
      schemaCommand: `tap schema ${site} ${command}`,
    };

    try {
      const loaded = await loadAdapter(site, command);
      entry.description = loaded?.adapter?.description ?? null;
    } catch (error) {
      if (!(error instanceof AdapterLoadError)) throw error;
      entry.description = null;
      entry.loadError = {
        code: 'adapter_load_error',
        message: error.message,
        suggestion: error.suggestion,
        details: error.details,
      };
    }

    commands.push(entry);
  }

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      kind: 'site',
      site,
      generatedAt: new Date().toISOString(),
    },
    commands,
  };
}

export async function buildGlobalSchema() {
  const adapters = listAdapters();
  const commands = [];

  for (const { site, commands: cmds } of adapters) {
    for (const command of cmds) {
      const entry = {
        kind: 'adapter',
        site,
        command,
        name: `${site} ${command}`,
        schemaCommand: `tap schema ${site} ${command}`,
      };

      try {
        const loaded = await loadAdapter(site, command);
        entry.description = loaded?.adapter?.description ?? null;
      } catch (error) {
        if (!(error instanceof AdapterLoadError)) throw error;
        entry.description = null;
        entry.loadError = {
          code: 'adapter_load_error',
          message: error.message,
          suggestion: error.suggestion,
          details: error.details,
        };
      }

      commands.push(entry);
    }
  }

  for (const [name, meta] of Object.entries(MANAGEMENT_COMMANDS)) {
    commands.push({
      kind: 'management',
      name,
      description: meta.description,
      schemaCommand: `tap schema ${name}`,
    });
  }

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
    },
    commands,
  };
}

export function buildAdapterCommandSchema(site, command, adapter) {
  const args = (adapter.args ?? []).map(normalizeArg);
  const warnings = [];
  for (const arg of args) {
    if (!arg.description) warnings.push(`Arg "${arg.name}" has no description.`);
  }

  const result = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      kind: 'adapter',
      site,
      command,
      name: `${site} ${command}`,
    },
    description: adapter.description ?? null,
    args,
    output: buildOutputSchema(adapter),
  };

  if (warnings.length) result.meta.warnings = warnings;
  return result;
}

export function buildManagementCommandSchema(name) {
  const meta = MANAGEMENT_COMMANDS[name];
  if (!meta) return null;

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      kind: 'management',
      name,
    },
    description: meta.description,
    args: meta.args.map(normalizeArg),
  };
}

export function getManagementCommandNames() {
  return Object.keys(MANAGEMENT_COMMANDS);
}
