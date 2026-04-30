import { openSession, closeTab } from './cdp.js';
import { listAdapters, loadAdapter } from './adapters.js';
import { executePipeline } from './executor.js';
import { commandHelp, globalHelp, siteHelp } from './help.js';
import { printOutput } from './output.js';
import { installSkill, skillHelp } from './skills.js';
import { formatSetupResult, runSetup, setupHelp } from './setup.js';
import {
  browserHelp,
  browserStatus,
  formatBrowserStart,
  formatBrowserStatus,
  formatBrowserStop,
  startBrowser,
  stopBrowser,
} from './browser.js';
import { doctorHelp, formatDoctorResult, runDoctor } from './doctor.js';

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

function parseBooleanFlags(rest, allowed, helpText) {
  const options = {};
  for (const token of rest) {
    if (!token.startsWith('--')) fail(`Unknown argument: ${token}\n\n${helpText}`);

    const key = token.slice(2);
    if (!allowed.includes(key)) fail(`Unknown option: ${token}\n\n${helpText}`);
    options[key] = true;
  }
  return options;
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

function runSetupCommand(tokens) {
  if (tokens.some(isHelpToken)) printHelp(setupHelp());
  const options = parseBooleanFlags(tokens, ['force'], setupHelp());

  let result;
  try {
    result = runSetup(options);
  } catch (error) {
    fail(error.message);
  }

  console.log(formatSetupResult(result));
  process.exit(0);
}

async function runBrowserCommand(tokens) {
  const [command, ...rest] = tokens;
  if (!command || isHelpToken(command)) printHelp(browserHelp());
  if (rest.some(isHelpToken)) printHelp(browserHelp(command));

  try {
    if (command === 'status') {
      if (rest.length) fail(`Unknown argument: ${rest[0]}\n\n${browserHelp('status')}`);
      const status = await browserStatus();
      console.log(formatBrowserStatus(status));
      process.exit(status.ok ? 0 : 1);
    }

    if (command === 'start') {
      const options = parseBooleanFlags(rest, ['headless'], browserHelp('start'));
      console.log(formatBrowserStart(await startBrowser(options)));
      process.exit(0);
    }

    if (command === 'stop') {
      if (rest.length) fail(`Unknown argument: ${rest[0]}\n\n${browserHelp('stop')}`);
      console.log(formatBrowserStop(await stopBrowser()));
      process.exit(0);
    }

    fail(`Unknown browser command: ${command}\n\n${browserHelp()}`);
  } catch (error) {
    fail(error.message);
  }
}

async function runDoctorCommand(tokens) {
  if (tokens.some(isHelpToken)) printHelp(doctorHelp());
  if (tokens.length) fail(`Unknown argument: ${tokens[0]}\n\n${doctorHelp()}`);

  const result = await runDoctor();
  console.log(formatDoctorResult(result));
  process.exit(result.ok ? 0 : 1);
}

export async function runCli(argv = process.argv.slice(2)) {
  const tokens = argv;
  if (tokens[0] === 'skill') runSkillCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'skill') printHelp(skillHelp(tokens[2]));
  if (tokens[0] === 'setup') runSetupCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'setup') printHelp(setupHelp());
  if (tokens[0] === 'browser') await runBrowserCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'browser') printHelp(browserHelp(tokens[2]));
  if (tokens[0] === 'doctor') await runDoctorCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'doctor') printHelp(doctorHelp());

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
