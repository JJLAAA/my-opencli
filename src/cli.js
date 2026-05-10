import { openSession, closeTab } from './cdp.js';
import { AdapterLoadError, listAdapters, loadAdapter } from './adapters.js';
import { executePipeline } from './executor.js';
import { commandHelp, globalHelp, siteHelp } from './help.js';
import { printOutput, validateJsonOutputSchema } from './output.js';
import { installSkill, skillHelp } from './skills.js';
import { runSetup, setupHelp } from './setup.js';
import {
  browserHelp,
  restartBrowser,
  browserStatus,
  startBrowser,
  stopBrowser,
} from './browser.js';
import { doctorHelp, runDoctor } from './doctor.js';
import { versionText } from './version.js';
import {
  buildGlobalSchema,
  buildSiteSchema,
  buildAdapterCommandSchema,
  buildManagementCommandSchema,
  getManagementCommandNames,
  inferType,
} from './schema.js';
import { adapterHelp, installAdapter, listInstalledAdapters, removeAdapter } from './adapter-manager.js';

// Exit codes
const EXIT_USAGE = 2;
const EXIT_CONFIG = 3;
const EXIT_BROWSER = 4;
const EXIT_UPSTREAM = 5;
const EXIT_ADAPTER = 6;

function fail(message, { code = 'general_error', exitCode = 1, suggestion = null, retryable = false, details = {} } = {}) {
  console.error(JSON.stringify({ error: { code, message, suggestion, retryable, details } }, null, 2));
  process.exit(exitCode);
}

function isHelpToken(value) {
  return value === 'help' || value === '--help' || value === '-h';
}

function isVersionToken(value) {
  return value === 'version' || value === '--version' || value === '-v';
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

function peekFields(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '--fields') {
      const val = tokens[i + 1];
      if (!val || val.startsWith('--')) return '';
      return val;
    }
  }
  return null;
}

function stripFields(tokens) {
  return tokens.filter((t, i) => {
    if (t === '--fields') return false;
    if (i > 0 && tokens[i - 1] === '--fields' && !t.startsWith('--')) return false;
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

function printVersion() {
  console.log(versionText());
  process.exit(0);
}

function findSite(adapters, site) {
  return adapters.find(entry => entry.site === site);
}

function failAdapterLoad(error) {
  fail(error.message, {
    code: 'adapter_load_error',
    exitCode: EXIT_ADAPTER,
    suggestion: error.suggestion,
    details: error.details,
  });
}

async function loadAdapterOrFail(site, command) {
  try {
    return await loadAdapter(site, command);
  } catch (error) {
    if (error instanceof AdapterLoadError) failAdapterLoad(error);
    throw error;
  }
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
  const loaded = await loadAdapterOrFail(site, command);
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

  console.log(JSON.stringify(result, null, 2));
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

  console.log(JSON.stringify(result, null, 2));
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
      const output = !status.ok
        ? { ...status, suggestions: ['tap browser start'] }
        : status;
      console.log(JSON.stringify(output, null, 2));
      process.exit(status.ok ? 0 : EXIT_BROWSER);
    }

    if (command === 'start') {
      const options = parseBooleanFlags(rest, ['headless', 'foreground'], browserHelp('start'));
      const result = await startBrowser(options);
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    if (command === 'stop') {
      if (rest.length)
        fail(`Unknown argument: ${rest[0]}\n\n${browserHelp('stop')}`, { code: 'unknown_argument', exitCode: EXIT_USAGE });
      const result = await stopBrowser();
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    if (command === 'restart') {
      const options = parseBooleanFlags(rest, ['headless', 'foreground'], browserHelp('restart'));
      const result = await restartBrowser(options);
      console.log(JSON.stringify(result, null, 2));
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

async function runAdapterCommand(tokens) {
  const [command, ...rest] = tokens;
  if (!command || isHelpToken(command)) printHelp(adapterHelp());

  if (command === 'install') {
    if (rest.some(isHelpToken)) printHelp(adapterHelp('install'));
    const source = rest.find(t => !t.startsWith('--'));
    const force = rest.includes('--force');
    const unknownArgs = rest.filter(t => t.startsWith('--') && t !== '--force');
    if (unknownArgs.length)
      fail(`Unknown option: ${unknownArgs[0]}\n\n${adapterHelp('install')}`, { code: 'unknown_option', exitCode: EXIT_USAGE });
    if (!source)
      fail('Source is required.\n\n' + adapterHelp('install'), { code: 'missing_adapter_source', exitCode: EXIT_USAGE });

    let result;
    try {
      result = await installAdapter(source, { force });
    } catch (error) {
      const isUpstream = error.code === 'adapter_pack_download_error' || error.code === 'adapter_pack_clone_error';
      const isContract = error.code === 'adapter_pack_contract_error' || error.code === 'adapter_file_conflict';
      const isUsage = error.code === 'unsupported_adapter_source';
      const exitCode = isUpstream ? EXIT_UPSTREAM : isUsage ? EXIT_USAGE : isContract ? EXIT_ADAPTER : EXIT_ADAPTER;

      if (error.code === 'adapter_file_conflict') {
        fail(error.message, {
          code: error.code,
          exitCode: EXIT_ADAPTER,
          suggestion: 'Rerun with --force only if you want this source to replace the listed adapter files.',
          retryable: false,
          details: error.details,
        });
      }

      fail(error.message || error.msg, {
        code: error.code || 'adapter_install_error',
        exitCode,
        suggestion: error.suggestion || null,
        retryable: isUpstream,
        details: error.details || {},
      });
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (command === 'list') {
    if (rest.some(isHelpToken)) printHelp(adapterHelp('list'));
    if (rest.length)
      fail(`Unknown argument: ${rest[0]}\n\n${adapterHelp('list')}`, { code: 'unknown_argument', exitCode: EXIT_USAGE });

    let result;
    try {
      result = listInstalledAdapters();
    } catch (error) {
      fail(error.message, { code: error.code || 'adapter_manifest_error', exitCode: EXIT_ADAPTER });
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (command === 'remove') {
    if (rest.some(isHelpToken)) printHelp(adapterHelp('remove'));
    const name = rest.find(t => !t.startsWith('--'));
    if (!name)
      fail('Pack name is required.\n\n' + adapterHelp('remove'), { code: 'missing_adapter_name', exitCode: EXIT_USAGE });
    const unknownArgs = rest.filter(t => t.startsWith('--'));
    if (unknownArgs.length)
      fail(`Unknown option: ${unknownArgs[0]}\n\n${adapterHelp('remove')}`, { code: 'unknown_option', exitCode: EXIT_USAGE });

    let result;
    try {
      result = removeAdapter(name);
    } catch (error) {
      fail(error.message, { code: error.code || 'adapter_remove_error', exitCode: EXIT_ADAPTER });
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  fail(`Unknown adapter command: ${command}\n\n${adapterHelp()}`, { code: 'unknown_adapter_command', exitCode: EXIT_USAGE });
}

async function runDoctorCommand(tokens) {
  if (tokens.some(isHelpToken)) printHelp(doctorHelp());
  if (tokens.length)
    fail(`Unknown argument: ${tokens[0]}\n\n${doctorHelp()}`, { code: 'unknown_argument', exitCode: EXIT_USAGE });

  const result = await runDoctor();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : classifyDoctorExitCode(result));
}

async function runSchemaCommand(tokens) {
  if (tokens.length === 0 || tokens.some(isHelpToken)) {
    console.log(JSON.stringify(await buildGlobalSchema(), null, 2));
    process.exit(0);
  }

  const managementNames = getManagementCommandNames();

  // Try management command match: "doctor", "browser status", etc.
  const twoWord = tokens.length >= 2 ? `${tokens[0]} ${tokens[1]}` : null;
  if (managementNames.includes(tokens[0]) && tokens.length === 1) {
    console.log(JSON.stringify(buildManagementCommandSchema(tokens[0]), null, 2));
    process.exit(0);
  }
  if (twoWord && managementNames.includes(twoWord)) {
    console.log(JSON.stringify(buildManagementCommandSchema(twoWord), null, 2));
    process.exit(0);
  }

  // Adapter command: schema <site> <command>
  const [site, command] = tokens;

  // Site-level query: schema <site> (no command)
  if (!command) {
    const siteSchema = await buildSiteSchema(site);
    if (!siteSchema)
      fail(`Unknown site: ${site}`, { code: 'unknown_site', exitCode: EXIT_USAGE, suggestion: 'Run: tap schema', details: { site } });
    console.log(JSON.stringify(siteSchema, null, 2));
    process.exit(0);
  }

  const loaded = await loadAdapterOrFail(site, command);
  if (!loaded)
    fail(`Unknown command: ${site} ${command}`, { code: 'unknown_command', exitCode: EXIT_USAGE });

  console.log(JSON.stringify(buildAdapterCommandSchema(site, command, loaded.adapter), null, 2));
  process.exit(0);
}

function coerceBool(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function validateAdapterArgs(adapter, args, site, command) {
  const definedArgs = adapter.args ?? [];
  const knownNames = new Set(definedArgs.map(def => def.name));
  knownNames.add('format');
  knownNames.add('fields');

  for (const key of Object.keys(args)) {
    if (!knownNames.has(key)) {
      fail(`Unknown option: --${key}`, {
        code: 'unknown_option', exitCode: EXIT_USAGE,
        suggestion: `Run: tap ${site} ${command} --help`,
        details: { arg: key, flag: `--${key}` },
      });
    }
  }

  for (const def of definedArgs) {
    const raw = args[def.name];
    if (raw === undefined || raw === null) continue;

    const type = inferType(def);
    const value = type === 'boolean' ? coerceBool(raw) : raw;
    args[def.name] = value;

    if (type === 'boolean' && typeof value !== 'boolean') {
      fail(`Invalid value for --${def.name}: expected boolean.`, {
        code: 'invalid_arg_type', exitCode: EXIT_USAGE,
        suggestion: `Use --${def.name}, --${def.name} true, or --${def.name} false.`,
        details: { arg: def.name, flag: `--${def.name}`, expected: 'boolean', received: raw },
      });
    }

    if (type === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        fail(`Invalid value for --${def.name}: expected integer.`, {
          code: 'invalid_arg_type', exitCode: EXIT_USAGE,
          suggestion: `Use --${def.name} with an integer value, for example: --${def.name} 10.`,
          details: { arg: def.name, flag: `--${def.name}`, expected: 'integer', received: raw },
        });
      }
    } else if (type === 'number') {
      if (typeof value !== 'number') {
        fail(`Invalid value for --${def.name}: expected number.`, {
          code: 'invalid_arg_type', exitCode: EXIT_USAGE,
          details: { arg: def.name, flag: `--${def.name}`, expected: 'number', received: raw },
        });
      }
    }

    if (def.enum && !def.enum.includes(value)) {
      fail(`Invalid value for --${def.name}: expected one of (${def.enum.map(v => JSON.stringify(v)).join(', ')}).`, {
        code: 'invalid_arg_value', exitCode: EXIT_USAGE,
        suggestion: `Use one of: ${def.enum.map(v => `--${def.name} ${JSON.stringify(v)}`).join(', ')}.`,
        details: { arg: def.name, flag: `--${def.name}`, expected: def.enum, received: value },
      });
    }

    if (typeof value === 'number') {
      if (def.minimum !== undefined && value < def.minimum) {
        fail(`Invalid value for --${def.name}: minimum is ${def.minimum}, got ${value}.`, {
          code: 'invalid_arg_value', exitCode: EXIT_USAGE,
          details: { arg: def.name, flag: `--${def.name}`, minimum: def.minimum, received: value },
        });
      }
      if (def.maximum !== undefined && value > def.maximum) {
        fail(`Invalid value for --${def.name}: maximum is ${def.maximum}, got ${value}.`, {
          code: 'invalid_arg_value', exitCode: EXIT_USAGE,
          details: { arg: def.name, flag: `--${def.name}`, maximum: def.maximum, received: value },
        });
      }
    }
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  const rawFormat = peekFormat(argv);
  if (rawFormat === '') {
    fail('Missing value for --format', { code: 'missing_format_value', exitCode: EXIT_USAGE });
  }
  if (rawFormat !== null && rawFormat !== 'json') {
    fail(`Unsupported format: ${rawFormat}`, {
      code: 'unsupported_format',
      exitCode: EXIT_USAGE,
      suggestion: 'Use --format json or omit --format. JSON is the only supported output format.',
      details: { format: rawFormat, supported: ['json'] },
    });
  }
  const rawFields = peekFields(argv);
  if (rawFields === '') {
    fail('Missing value for --fields', { code: 'missing_fields_value', exitCode: EXIT_USAGE });
  }
  const tokens = stripFields(stripFormat(argv));

  if (tokens.length === 1 && isVersionToken(tokens[0])) printVersion();
  if (tokens[0] === 'skill') runSkillCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'skill') printHelp(skillHelp(tokens[2]));
  if (tokens[0] === 'setup') runSetupCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'setup') printHelp(setupHelp());
  if (tokens[0] === 'browser') await runBrowserCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'browser') printHelp(browserHelp(tokens[2]));
  if (tokens[0] === 'adapter') await runAdapterCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'adapter') printHelp(adapterHelp(tokens[2]));
  if (tokens[0] === 'doctor') await runDoctorCommand(tokens.slice(1));
  if (tokens[0] === 'help' && tokens[1] === 'doctor') printHelp(doctorHelp());
  if (tokens[0] === 'schema') await runSchemaCommand(tokens.slice(1));

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

  const loaded = await loadAdapterOrFail(site, command);
  if (!loaded)
    fail(`Unknown command: ${site} ${command}\n\n${siteHelp(site, siteEntry.commands)}`, {
      code: 'unknown_command', exitCode: EXIT_USAGE,
    });
  if (rest.some(isHelpToken)) printHelp(commandHelp(site, command, loaded.adapter));

  const args = parseArgs(rest);
  const { adapter } = loaded;

  for (const def of adapter.args ?? [])
    if (args[def.name] === undefined) args[def.name] = def.default;
  validateAdapterArgs(adapter, args, site, command);
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
      fields: rawFields ?? undefined,
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
