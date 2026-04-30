import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const SKILL_NAME = 'tap-adapter-author';
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

function packagedSkillCandidates() {
  return [
    join(ROOT_DIR, '.claude', 'skills', SKILL_NAME),
    join(dirname(process.execPath), '..', 'skills', SKILL_NAME),
  ];
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

  const source = findSkillSource();
  if (!source) {
    throw new Error(`Bundled skill not found: ${SKILL_NAME}`);
  }

  const skillsDir = resolvePath(expandHome(options.target ?? provider.defaultDir()));
  const target = join(skillsDir, SKILL_NAME);

  if (existsSync(target) && !options.force) {
    throw new Error(`Skill already exists: ${target}\nUse --force to overwrite existing files.`);
  }

  copyDir(source, target, { overwrite: Boolean(options.force) });

  return {
    provider: provider.label,
    skill: SKILL_NAME,
    target,
  };
}
