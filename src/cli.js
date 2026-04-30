import { openSession, closeTab } from './cdp.js';
import { listAdapters, loadAdapter } from './adapters.js';
import { executePipeline } from './executor.js';
import { commandHelp, globalHelp, siteHelp } from './help.js';
import { printOutput } from './output.js';
import { installSkill, skillHelp } from './skills.js';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isHelpToken(value) {
  return value === 'help' || value === '--help' || value === '-h';
}

function parseArgs(rest) {
  const args = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const val = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
      args[key] = isNaN(Number(val)) || val === true ? val : Number(val);
    }
  }

  return args;
}

function parseSkillInstallArgs(rest) {
  const [provider, ...flags] = rest;
  const options = {};

  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--force') {
      options.force = true;
    } else if (flags[i] === '--target') {
      if (!flags[i + 1] || flags[i + 1].startsWith('--')) fail('Missing value for --target');
      options.target = flags[++i];
    } else {
      fail(`Unknown option: ${flags[i]}\n\n${skillHelp('install')}`);
    }
  }

  return { provider, options };
}

function printHelp(text) {
  console.log(text);
  process.exit(0);
}

function findSite(adapters, site) {
  return adapters.find(entry => entry.site === site);
}

async function printCommandHelp(site, command, siteEntry) {
  const loaded = await loadAdapter(site, command);
  if (!loaded) fail(`Unknown command: ${site} ${command}\n\n${siteHelp(site, siteEntry.commands)}`);
  printHelp(commandHelp(site, command, loaded.adapter));
}

function runSkillCommand(tokens) {
  const [command, ...rest] = tokens;
  if (!command || isHelpToken(command)) printHelp(skillHelp());
  if (command !== 'install') fail(`Unknown skill command: ${command}\n\n${skillHelp()}`);
  if (rest.some(isHelpToken)) printHelp(skillHelp('install'));

  const { provider, options } = parseSkillInstallArgs(rest);
  if (!provider) printHelp(skillHelp('install'));

  let result;
  try {
    result = installSkill(provider, options);
  } catch (error) {
    fail(error.message);
  }

  console.log(`Installed ${result.skill} for ${result.provider}: ${result.target}`);
  process.exit(0);
}

export async function runCli(argv = process.argv.slice(2)) {
  const tokens = argv;
  if (tokens[0] === 'skill') runSkillCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'skill') printHelp(skillHelp(tokens[2]));

  const adapters = listAdapters();

  if (!tokens.length || isHelpToken(tokens[0])) {
    const [, site, command] = tokens;
    if (!site) printHelp(globalHelp());

    const siteEntry = findSite(adapters, site);
    if (!siteEntry) fail(`Unknown site: ${site}\n\n${globalHelp()}`);
    if (!command) printHelp(siteHelp(site, siteEntry.commands));

    await printCommandHelp(site, command, siteEntry);
  }

  const [site, command, ...rest] = tokens;
  const siteEntry = findSite(adapters, site);
  if (!siteEntry) fail(`Unknown site: ${site}\n\n${globalHelp()}`);

  if (!command) printHelp(siteHelp(site, siteEntry.commands));

  if (isHelpToken(command)) {
    const helpCommand = rest[0];
    if (!helpCommand) printHelp(siteHelp(site, siteEntry.commands));
    await printCommandHelp(site, helpCommand, siteEntry);
  }

  const loaded = await loadAdapter(site, command);
  if (!loaded) fail(`Unknown command: ${site} ${command}\n\n${siteHelp(site, siteEntry.commands)}`);
  if (rest.some(isHelpToken)) printHelp(commandHelp(site, command, loaded.adapter));

  const args = parseArgs(rest);
  const format = args.format ?? 'json';
  delete args.format;

  const { adapter } = loaded;
  for (const def of adapter.args ?? [])
    if (args[def.name] === undefined) args[def.name] = def.default;

  const needsBrowser = adapter.pipeline.some(step =>
    'navigate' in step || 'evaluate' in step || 'intercept' in step
  );

  let session = null, targetId = null, base = null;
  try {
    if (needsBrowser) ({ session, targetId, base } = await openSession());
    const result = await executePipeline(adapter.pipeline, args, session);
    printOutput(result, format, adapter.columns);
  } finally {
    session?.close();
    if (targetId) await closeTab(base, targetId);
  }
}
