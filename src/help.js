import { listAdapters } from './adapters.js';

function formatArgUsage(arg) {
  return arg.required ? ` --${arg.name} <value>` : ` [--${arg.name} value]`;
}

function formatOptionLine(arg) {
  const label = `--${arg.name}`;
  const details = [];
  if (arg.description) details.push(arg.description);
  if (arg.default !== undefined) details.push(`default: ${JSON.stringify(arg.default)}`);
  if (arg.required) details.push('required');
  return `  ${label.padEnd(18)}${details.join(' | ')}`.trimEnd();
}

function sectionTitle(text) {
  return `${text}:`;
}

export function globalHelp() {
  const adapters = listAdapters();
  const lines = [
    'Usage: tap <site> <command> [--key value] [--format json|table]',
    '       tap help [site] [command]',
    '',
    'Default output is JSON for agent-friendly parsing. Use --format table for human-readable output.',
    '',
    sectionTitle('Commands'),
    '  help              Show global, site, or command help',
    '  setup             Initialize local TAP files explicitly',
    '  browser           Manage the agent Chrome runtime',
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
    `Usage: tap ${site} <command> [--key value] [--format json|table]`,
    `       tap help ${site} <command>`,
    '',
    'Default output is JSON. Use --format table for human-readable output.',
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
    `Usage: tap ${site} ${command}${usageSuffix} [--format json|table]`,
  ];

  if (adapter.description) lines.push('', adapter.description);

  lines.push('', 'Default output is JSON. Use --format table for human-readable output.');

  if (args.length) {
    lines.push('', sectionTitle('Options'));
    for (const arg of args) lines.push(formatOptionLine(arg));
  }

  if (adapter.columns?.length) {
    lines.push('', sectionTitle('Output Columns'), `  ${adapter.columns.join(', ')}`);
  }

  return lines.join('\n');
}
