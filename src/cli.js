import { openSession, closeTab } from './cdp.js';
import { listAdapters, loadAdapter } from './adapters.js';
import { executePipeline } from './executor.js';
import { commandHelp, globalHelp, siteHelp } from './help.js';
import { printOutput, validateJsonOutputSchema } from './output.js';
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

// Exit codes
const EXIT_USAGE = 2;
const EXIT_CONFIG = 3;
const EXIT_BROWSER = 4;
const EXIT_UPSTREAM = 5;
const EXIT_ADAPTER = 6;

let _jsonMode = false;

export function isJsonMode() { return _jsonMode; }

function fail(message, { code = 'general_error', exitCode = 1, suggestion = null, retryable = false, details = {} } = {}) {
  if (_jsonMode) {
    console.error(JSON.stringify({ error: { code, message, suggestion, retryable, details } }, null, 2));
  } else {
    console.error(message);
  }
  process.exit(exitCode);
}

function isHelpToken(value) {
  return value === 'help' || value === '--help' || value === '-h';
}

function peekFormat(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '--format') {
      const val = tokens[i + 1];
      if (!val || val.startsWith('--')) return '';
      return val;
    }
  }
  return null;
}

function stripFormat(tokens) {
  return tokens.filter((t, i) => {
    if (t === '--format') return false;
    if (i > 0 && tokens[i - 1] === '--format' && !t.startsWith('--')) return false;
    return true;
  });
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

function isMissingArgValue(value) {
  return value === undefined || value === true || value === '';
}

function validateRequiredArgs(adapter, args) {
  const missing = (adapter.args ?? [])
    .filter(def => def.required && isMissingArgValue(args[def.name]))
    .map(def => `--${def.name}`);

  if (!missing.length) return;
  throw new Error(`Missing required argument${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
}

function parseSkillInstallArgs(rest) {
  const [provider, ...flags] = rest;
  const options = {};

  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--force') {
      options.force = true;
    } else if (flags[i] === '--target') {
      if (!flags[i + 1] || flags[i + 1].startsWith('--'))
        fail('Missing value for --target', { code: 'missing_option_value', exitCode: EXIT_USAGE });
      options.target = flags[++i];
    } else {
      fail(`Unknown option: ${flags[i]}\n\n${skillHelp('install')}`, { code: 'unknown_option', exitCode: EXIT_USAGE });
    }
  }

  return { provider, options };
}

function parseBooleanFlags(rest, allowed, helpText) {
  const options = {};
  for (const token of rest) {
    if (!token.startsWith('--'))
      fail(`Unknown argument: ${token}\n\n${helpText}`, { code: 'unknown_argument', exitCode: EXIT_USAGE });

    const key = token.slice(2);
    if (!allowed.includes(key))
      fail(`Unknown option: ${token}\n\n${helpText}`, { code: 'unknown_option', exitCode: EXIT_USAGE });
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

function needsBrowserSession(pipeline = []) {
  return pipeline.some(step => {
    if ('navigate' in step || 'evaluate' in step || 'intercept' in step || 'browserFetch' in step) {
      return true;
    }
    return 'foreach' in step && needsBrowserSession(step.foreach?.steps);
  });
}

async function printCommandHelp(site, command, siteEntry) {
  const loaded = await loadAdapter(site, command);
  if (!loaded)
    fail(`Unknown command: ${site} ${command}\n\n${siteHelp(site, siteEntry.commands)}`, {
      code: 'unknown_command', exitCode: EXIT_USAGE,
    });
  printHelp(commandHelp(site, command, loaded.adapter));
}

function runSkillCommand(tokens) {
  const [command, ...rest] = tokens;
  if (!command || isHelpToken(command)) printHelp(skillHelp());
  if (command !== 'install')
    fail(`Unknown skill command: ${command}\n\n${skillHelp()}`, { code: 'unknown_command', exitCode: EXIT_USAGE });
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
    fail(error.message, { code: 'setup_error', exitCode: EXIT_CONFIG });
  }

  if (_jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatSetupResult(result));
  }
  process.exit(0);
}

async function runBrowserCommand(tokens) {
  const [command, ...rest] = tokens;
  if (!command || isHelpToken(command)) printHelp(browserHelp());
  if (rest.some(isHelpToken)) printHelp(browserHelp(command));

  try {
    if (command === 'status') {
      if (rest.length)
        fail(`Unknown argument: ${rest[0]}\n\n${browserHelp('status')}`, { code: 'unknown_argument', exitCode: EXIT_USAGE });
      const status = await browserStatus();
      const output = _jsonMode && !status.ok
        ? { ...status, suggestions: ['tap browser start'] }
        : status;
      if (_jsonMode) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(formatBrowserStatus(status));
      }
      process.exit(status.ok ? 0 : EXIT_BROWSER);
    }

    if (command === 'start') {
      const options = parseBooleanFlags(rest, ['headless', 'foreground'], browserHelp('start'));
      const result = await startBrowser(options);
      if (_jsonMode) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatBrowserStart(result));
      }
      process.exit(0);
    }

    if (command === 'stop') {
      if (rest.length)
        fail(`Unknown argument: ${rest[0]}\n\n${browserHelp('stop')}`, { code: 'unknown_argument', exitCode: EXIT_USAGE });
      const result = await stopBrowser();
      if (_jsonMode) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatBrowserStop(result));
      }
      process.exit(0);
    }

    fail(`Unknown browser command: ${command}\n\n${browserHelp()}`, { code: 'unknown_command', exitCode: EXIT_USAGE });
  } catch (error) {
    fail(error.message, { code: 'browser_error', exitCode: EXIT_BROWSER });
  }
}

function classifyDoctorExitCode(result) {
  const failed = result.checks.filter(c => !c.ok);
  if (failed.some(c => c.label.includes('Chrome') || c.label.includes('CDP'))) return EXIT_BROWSER;
  return EXIT_CONFIG;
}

async function runDoctorCommand(tokens) {
  if (tokens.some(isHelpToken)) printHelp(doctorHelp());
  if (tokens.length)
    fail(`Unknown argument: ${tokens[0]}\n\n${doctorHelp()}`, { code: 'unknown_argument', exitCode: EXIT_USAGE });

  const result = await runDoctor();
  if (_jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatDoctorResult(result));
  }
  process.exit(result.ok ? 0 : classifyDoctorExitCode(result));
}

export async function runCli(argv = process.argv.slice(2)) {
  const rawFormat = peekFormat(argv);
  if (rawFormat === '') {
    fail('Missing value for --format', { code: 'missing_format_value', exitCode: EXIT_USAGE });
  }
  _jsonMode = rawFormat !== null;
  if (rawFormat !== null && rawFormat !== 'json') {
    fail(`Unsupported format: ${rawFormat}`, {
      code: 'unsupported_format',
      exitCode: EXIT_USAGE,
      suggestion: 'Use --format json or omit --format for human-readable text.',
      details: { format: rawFormat, supported: ['json'] },
    });
  }
  const tokens = stripFormat(argv);

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
    if (!siteEntry)
      fail(`Unknown site: ${site}\n\n${globalHelp()}`, { code: 'unknown_site', exitCode: EXIT_USAGE });
    if (!command) printHelp(siteHelp(site, siteEntry.commands));

    await printCommandHelp(site, command, siteEntry);
  }

  const [site, command, ...rest] = tokens;
  const siteEntry = findSite(adapters, site);
  if (!siteEntry)
    fail(`Unknown site: ${site}\n\n${globalHelp()}`, { code: 'unknown_site', exitCode: EXIT_USAGE });

  if (!command) printHelp(siteHelp(site, siteEntry.commands));

  if (isHelpToken(command)) {
    const helpCommand = rest[0];
    if (!helpCommand) printHelp(siteHelp(site, siteEntry.commands));
    await printCommandHelp(site, helpCommand, siteEntry);
  }

  const loaded = await loadAdapter(site, command);
  if (!loaded)
    fail(`Unknown command: ${site} ${command}\n\n${siteHelp(site, siteEntry.commands)}`, {
      code: 'unknown_command', exitCode: EXIT_USAGE,
    });
  if (rest.some(isHelpToken)) printHelp(commandHelp(site, command, loaded.adapter));

  const args = parseArgs(rest);
  const { adapter } = loaded;

  for (const def of adapter.args ?? [])
    if (args[def.name] === undefined) args[def.name] = def.default;
  try {
    validateRequiredArgs(adapter, args);
  } catch (error) {
    fail(`${error.message}\n\n${commandHelp(site, command, adapter)}`, {
      code: 'missing_required_arg', exitCode: EXIT_USAGE,
      suggestion: `Run: tap ${site} ${command} --help`,
    });
  }

  try {
    validateJsonOutputSchema(adapter, { site, command });
  } catch (error) {
    fail(error.message, { code: 'adapter_contract_error', exitCode: EXIT_ADAPTER });
  }

  const needsBrowser = needsBrowserSession(adapter.pipeline);

  let session = null, targetId = null, base = null;
  try {
    if (needsBrowser) {
      try {
        ({ session, targetId, base } = await openSession());
      } catch (error) {
        fail(error.message, { code: 'cdp_unreachable', exitCode: EXIT_BROWSER, suggestion: 'Run: tap browser start' });
      }
    }
    const result = await executePipeline(adapter.pipeline, args, session);
    printOutput(result, 'json', {
      site,
      command,
      args,
      adapter,
    });
  } catch (error) {
    const isBrowserError = /cdp|chrome|browser|devtools|websocket/i.test(error.message);
    fail(error.message, {
      code: isBrowserError ? 'browser_error' : 'upstream_error',
      exitCode: isBrowserError ? EXIT_BROWSER : EXIT_UPSTREAM,
      retryable: !isBrowserError,
    });
  } finally {
    session?.close();
    if (targetId) await closeTab(base, targetId);
  }
}
