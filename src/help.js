import { listAdapters } from './adapters.js';
import { inferType } from './schema.js';

function formatArgUsage(arg) {
  const type = arg.type ?? inferType(arg);
  if (type === 'boolean') return arg.required ? ` --${arg.name}` : ` [--${arg.name}]`;
  return arg.required ? ` --${arg.name} <value>` : ` [--${arg.name} value]`;
}

function formatOptionLine(arg) {
  const type = arg.type ?? inferType(arg);
  const label = arg.enum
    ? `--${arg.name} <${arg.enum.map(v => JSON.stringify(v)).join('|')}>`
    : type === 'boolean'
      ? `--${arg.name}`
      : `--${arg.name} <${type}>`;
  const details = [];
  if (arg.description) details.push(arg.description);
  if (arg.default !== undefined) details.push(`default: ${JSON.stringify(arg.default)}`);
  if (arg.required) details.push('required');
  return `  ${label.padEnd(24)}${details.join(' | ')}`.trimEnd();
}

function sectionTitle(text) {
  return `${text}:`;
}

export function globalHelp() {
  const adapters = listAdapters();
  const lines = [
    'Usage: tap <site> <command> [--key value]',
    '       tap help [site] [command]',
    '',
    'Output is JSON by default. --format json is accepted but optional.',
    '',
    sectionTitle('Commands'),
    '  help              Show global, site, or command help',
    '  schema            Show command schemas',
    '  setup             Initialize local TAP files explicitly',
    '  browser           Manage the agent Chrome runtime',
    '  adapter           Install, list, or remove adapter packs',
    '  doctor            Diagnose local TAP setup',
    '  skill             Install bundled AI assistant skills',
  ];

  if (adapters.length) {
    lines.push('', sectionTitle('Available Sites'));
    for (const { site, commands } of adapters)
      lines.push(`  ${site.padEnd(16)}${commands.join(', ')}`);
  } else {
    lines.push('', 'No adapters found.');
  }

  return lines.join('\n');
}

export function siteHelp(site, commands) {
  const lines = [
    `Usage: tap ${site} <command> [--key value]`,
    `       tap help ${site} <command>`,
    '',
    'Output is JSON by default. --format json is accepted but optional.',
    '',
    sectionTitle(`Commands for ${site}`),
  ];

  for (const command of commands) lines.push(`  ${command}`);
  return lines.join('\n');
}

export function commandHelp(site, command, adapter) {
  const args = adapter.args ?? [];
  const usageSuffix = args.map(formatArgUsage).join('');
  const lines = [
    `Usage: tap ${site} ${command}${usageSuffix}`,
  ];

  if (adapter.description) lines.push('', adapter.description);

  lines.push('', 'Output is a JSON envelope with meta, schema, and items. --format json is accepted but optional.');

  if (args.length) {
    lines.push('', sectionTitle('Options'));
    for (const arg of args) lines.push(formatOptionLine(arg));
  }

  if (adapter.output?.fields) {
    lines.push('', sectionTitle('Output Schema'));
    for (const [name, field] of Object.entries(adapter.output.fields)) {
      const details = [field.type, field.description].filter(Boolean).join(' - ');
      lines.push(`  ${name}${details ? `: ${details}` : ''}`);
    }
  }

  return lines.join('\n');
}
