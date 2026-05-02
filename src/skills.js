import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { BUNDLED_SKILLS } from './bundled-skills.js';

const SKILL_NAME = 'tap-adapter-author';
const PACKAGE_ROOT_ENV = 'TAP_PACKAGE_ROOT';
const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

const PROVIDERS = {
  'claude-code': {
    label: 'Claude Code',
    defaultDir: () => join(homedir(), '.claude', 'skills'),
  },
  codex: {
    label: 'Codex',
    defaultDir: () => join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'skills'),
  },
};

function expandHome(path) {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function copyDir(src, dest, { overwrite }) {
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, { overwrite });
    } else if (overwrite || !existsSync(destPath)) {
      copyFileSync(srcPath, destPath);
    }
  }
}

function copyBundledSkill(skillName, dest, { overwrite }) {
  const files = BUNDLED_SKILLS[skillName];
  if (!files) return false;

  mkdirSync(dest, { recursive: true });

  for (const [relativePath, contents] of Object.entries(files)) {
    const destPath = join(dest, relativePath);
    mkdirSync(dirname(destPath), { recursive: true });

    if (overwrite || !existsSync(destPath)) {
      writeFileSync(destPath, contents);
    }
  }

  return true;
}

function assetRootCandidates() {
  const execDir = dirname(process.execPath);
  return [
    process.env[PACKAGE_ROOT_ENV],
    ROOT_DIR,
    execDir,
  ].filter(Boolean);
}

function packagedSkillCandidates() {
  return assetRootCandidates().map(root => join(root, 'skills', SKILL_NAME));
}

function findSkillSource() {
  return packagedSkillCandidates().map(path => resolvePath(path)).find(isDirectory);
}

export function skillHelp(command) {
  if (command === 'install') {
    return [
      'Usage: tap skill install <claude-code|codex> [--target dir] [--force]',
      '',
      'Installs the bundled tap-adapter-author skill explicitly.',
      '',
      'Options:',
      '  --target dir       Install into a custom skills directory',
      '  --force            Overwrite existing files in the target skill directory',
      '',
      'Examples:',
      '  tap skill install claude-code',
      '  tap skill install codex',
      '  tap skill install codex --target ~/.codex/skills',
    ].join('\n');
  }

  return [
    'Usage: tap skill <command>',
    '',
    'Commands:',
    '  install           Install the bundled tap-adapter-author skill',
    '',
    'Run `tap skill install --help` for details.',
  ].join('\n');
}

export function installSkill(providerName, options = {}) {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    const supported = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Unknown skill target: ${providerName}\nSupported targets: ${supported}`);
  }

  const skillsDir = resolvePath(expandHome(options.target ?? provider.defaultDir()));
  const target = join(skillsDir, SKILL_NAME);

  if (existsSync(target) && !options.force) {
    throw new Error(`Skill already exists: ${target}\nUse --force to overwrite existing files.`);
  }

  const source = findSkillSource();
  if (source) {
    copyDir(source, target, { overwrite: Boolean(options.force) });
  } else if (!copyBundledSkill(SKILL_NAME, target, { overwrite: Boolean(options.force) })) {
    const searched = packagedSkillCandidates().map(path => `  - ${resolvePath(path)}`).join('\n');
    throw new Error(`Bundled skill not found: ${SKILL_NAME}\nSearched:\n${searched}`);
  }

  return {
    provider: provider.label,
    skill: SKILL_NAME,
    target,
  };
}
