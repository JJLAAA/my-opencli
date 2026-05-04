import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, cpSync } from 'node:fs';
import { join, resolve, relative, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { request } from 'node:http';
import https from 'node:https';
import { createWriteStream } from 'node:fs';
import { tapDir, userAdaptersDir, installedAdaptersPath } from './config.js';

// --- Manifest helpers ---

function readManifest() {
  const path = installedAdaptersPath();
  if (!existsSync(path)) return { packs: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    throw new Error(`Failed to read installed-adapters.json: ${error.message}`);
  }
}

function writeManifest(manifest) {
  const path = installedAdaptersPath();
  mkdirSync(tapDir(), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2), 'utf-8');
}

// --- Source parsing ---

function parseSource(source) {
  if (source.startsWith('github:')) {
    const ref = source.slice('github:'.length);
    const parts = ref.split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw { code: 'unsupported_adapter_source', message: `Invalid github source format: ${source}. Expected github:<owner>/<repo>` };
    }
    const owner = parts[0];
    const repo = parts[1];
    return { type: 'github', owner, repo, raw: source };
  }

  if (source.startsWith('url:')) {
    const url = source.slice('url:'.length);
    if (!url.startsWith('https://')) {
      throw { code: 'unsupported_adapter_source', message: `Invalid url source: must use https. Got: ${source}` };
    }
    return { type: 'url', url, raw: source };
  }

  if (source.startsWith('git:')) {
    const gitUrl = source.slice('git:'.length);
    if (!gitUrl) {
      throw { code: 'unsupported_adapter_source', message: `Invalid git source format: ${source}. Expected git:<url>` };
    }
    return { type: 'git', url: gitUrl, raw: source };
  }

  throw { code: 'unsupported_adapter_source', message: `Unsupported source format: ${source}. Use github:<owner>/<repo>, url:<https-url>, or git:<git-url>` };
}

// --- Sanitize URLs for error messages ---

function sanitizeUrl(url) {
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = '***';
      u.password = '***';
    }
    return u.toString();
  } catch {
    return url.replace(/\/\/[^@]+@/, '//***@');
  }
}

// --- Temp directory ---

function createTempDir() {
  const dir = join(tmpdir(), `tap-adapter-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

// --- Download helpers ---

function httpsGet(url, options) {
  return new Promise((resolve, reject) => {
    https.get(url, options, resolve).on('error', reject);
  });
}

function streamResponse(res, destPath) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(destPath);
    res.pipe(stream);
    stream.on('finish', () => { stream.close(); resolve(); });
    stream.on('error', reject);
    res.on('error', reject);
  });
}

async function downloadFile(url, destPath, maxRedirects = 5) {
  if (maxRedirects <= 0) throw new Error('Too many redirects');
  const res = await httpsGet(url, { headers: { 'User-Agent': 'tap-cli' } });
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    res.resume();
    return downloadFile(res.headers.location, destPath, maxRedirects - 1);
  }
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`Download failed with status ${res.statusCode} from ${sanitizeUrl(url)}`);
  }
  return streamResponse(res, destPath);
}

async function getGithubDefaultBranch(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const res = await httpsGet(url, { headers: { 'User-Agent': 'tap-cli' } });
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    res.resume();
    const redirect = new URL(res.headers.location, url).toString();
    return getGithubDefaultBranchFromUrl(redirect);
  }
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`GitHub API returned status ${res.statusCode} for ${owner}/${repo}`);
  }
  let data = '';
  for await (const chunk of res) data += chunk;
  try {
    const json = JSON.parse(data);
    return json.default_branch || 'main';
  } catch {
    throw new Error(`Failed to parse GitHub API response for ${owner}/${repo}`);
  }
}

function getGithubDefaultBranchFromUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'tap-cli' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(getGithubDefaultBranchFromUrl(new URL(res.headers.location, url).toString()));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GitHub API redirect returned status ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).default_branch || 'main');
        } catch {
          reject(new Error('Failed to parse GitHub API response'));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// --- Archive extraction ---

function extractZip(archivePath, targetDir) {
  execFileSync('unzip', ['-o', '-q', archivePath, '-d', targetDir], { stdio: 'pipe' });
}

function extractTarGz(archivePath, targetDir) {
  execFileSync('tar', ['-xzf', archivePath, '-C', targetDir], { stdio: 'pipe' });
}

function extractArchive(archivePath, targetDir) {
  const ext = extname(archivePath).toLowerCase();
  if (ext === '.zip') {
    extractZip(archivePath, targetDir);
  } else if (ext === '.gz' || ext === '.tgz') {
    extractTarGz(archivePath, targetDir);
  } else {
    throw new Error(`Unsupported archive format: ${ext}. Expected .zip, .tar.gz, or .tgz`);
  }
}

// --- Find pack root (directory containing tap-adapter.json) ---

function findPackRoot(extractDir) {
  function search(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === 'tap-adapter.json') return dir;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const result = search(join(dir, entry.name));
        if (result) return result;
      }
    }
    return null;
  }
  return search(extractDir);
}

// --- Read pack manifest ---

function readPackManifest(packRoot) {
  const manifestPath = join(packRoot, 'tap-adapter.json');
  if (!existsSync(manifestPath)) {
    throw { code: 'adapter_pack_contract_error', message: `No tap-adapter.json found in pack root: ${packRoot}` };
  }
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    if (!raw.name) {
      throw { code: 'adapter_pack_contract_error', message: 'tap-adapter.json missing required "name" field' };
    }
    return {
      name: raw.name,
      version: raw.version || '0.0.0',
      description: raw.description || '',
    };
  } catch (error) {
    if (error.code === 'adapter_pack_contract_error') throw error;
    throw { code: 'adapter_pack_contract_error', message: `Invalid tap-adapter.json: ${error.message}` };
  }
}

// --- Collect adapter files from pack ---

function collectAdapterFiles(packRoot) {
  const adaptersDir = join(packRoot, 'adapters');
  if (!existsSync(adaptersDir)) {
    throw { code: 'adapter_pack_contract_error', message: 'Pack has no "adapters/" directory' };
  }

  const files = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(adaptersDir);
  return files;
}

// --- Fetch pack from source ---

async function fetchPack(parsedSource, tmpDir) {
  const archiveDir = join(tmpDir, 'archive');
  mkdirSync(archiveDir, { recursive: true });

  if (parsedSource.type === 'github') {
    const { owner, repo } = parsedSource;
    let branch;
    try {
      branch = await getGithubDefaultBranch(owner, repo);
    } catch (error) {
      throw { code: 'adapter_pack_download_error', message: `Failed to get default branch from GitHub: ${error.message}` };
    }
    const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    const archivePath = join(archiveDir, 'repo.zip');
    try {
      await downloadFile(archiveUrl, archivePath);
    } catch (error) {
      throw { code: 'adapter_pack_download_error', message: `Failed to download GitHub archive: ${error.message}` };
    }
    const extractDir = join(tmpDir, 'extracted');
    mkdirSync(extractDir, { recursive: true });
    extractZip(archivePath, extractDir);
    const packRoot = findPackRoot(extractDir);
    if (!packRoot) {
      throw { code: 'adapter_pack_contract_error', message: `No tap-adapter.json found in downloaded pack from github:${owner}/${repo}` };
    }
    return packRoot;
  }

  if (parsedSource.type === 'url') {
    const { url } = parsedSource;
    const urlBasename = basename(new URL(url).pathname) || 'archive';
    const archivePath = join(archiveDir, urlBasename);
    try {
      await downloadFile(url, archivePath);
    } catch (error) {
      throw { code: 'adapter_pack_download_error', message: `Failed to download from ${sanitizeUrl(url)}: ${error.message}` };
    }
    const extractDir = join(tmpDir, 'extracted');
    mkdirSync(extractDir, { recursive: true });
    extractArchive(archivePath, extractDir);
    const packRoot = findPackRoot(extractDir);
    if (!packRoot) {
      throw { code: 'adapter_pack_contract_error', message: `No tap-adapter.json found in downloaded pack from ${sanitizeUrl(url)}` };
    }
    return packRoot;
  }

  if (parsedSource.type === 'git') {
    const { url } = parsedSource;
    const cloneDir = join(tmpDir, 'clone');
    try {
      execFileSync('git', ['clone', '--depth', '1', url, cloneDir], { stdio: 'pipe' });
    } catch (error) {
      throw { code: 'adapter_pack_clone_error', message: `Failed to clone repository: ${sanitizeUrl(url)}` };
    }
    const packRoot = findPackRoot(cloneDir);
    if (!packRoot) {
      throw { code: 'adapter_pack_contract_error', message: `No tap-adapter.json found in cloned repository` };
    }
    return packRoot;
  }
}

// --- Conflict detection ---

function detectConflicts(adapterFiles, packRoot, adaptersTarget) {
  const conflicts = [];
  const packAdaptersDir = join(packRoot, 'adapters');

  for (const filePath of adapterFiles) {
    const relToAdapters = relative(packAdaptersDir, filePath);
    const targetPath = join(adaptersTarget, relToAdapters);
    if (existsSync(targetPath)) {
      conflicts.push({ relativePath: relToAdapters, targetPath });
    }
  }

  return conflicts;
}

function getOwnerForFile(manifest, relPath) {
  for (const pack of manifest.packs) {
    if (pack.files.includes(relPath)) {
      return { owner: pack.name, source: pack.source };
    }
  }
  return { owner: 'local', source: '~/.tap/adapters' };
}

// --- Install ---

export async function installAdapter(source, { force = false } = {}) {
  if (!source) {
    throw { code: 'missing_adapter_source', message: 'Source is required. Use github:<owner>/<repo>, url:<https-url>, or git:<git-url>' };
  }

  let parsedSource;
  try {
    parsedSource = parseSource(source);
  } catch (error) {
    throw error;
  }

  const adaptersTarget = userAdaptersDir();
  mkdirSync(adaptersTarget, { recursive: true });

  const tmpDir = createTempDir();
  try {
    const packRoot = await fetchPack(parsedSource, tmpDir);
    const packMeta = readPackManifest(packRoot);
    const adapterFiles = collectAdapterFiles(packRoot);

    if (adapterFiles.length === 0) {
      throw { code: 'adapter_pack_contract_error', message: 'Pack contains no adapter files in adapters/ directory' };
    }

    const packAdaptersDir = join(packRoot, 'adapters');
    const relativeFiles = adapterFiles.map(f => relative(packAdaptersDir, f));

    // Check conflicts
    const conflicts = detectConflicts(adapterFiles, packRoot, adaptersTarget);
    const manifest = readManifest();

    if (conflicts.length > 0 && !force) {
      const conflictDetails = conflicts.map(c => {
        const { owner, source: ownerSource } = getOwnerForFile(manifest, c.relativePath);
        return {
          path: c.relativePath,
          owner,
          source: ownerSource || '~/.tap/adapters',
        };
      });
      throw {
        code: 'adapter_file_conflict',
        message: `${conflicts.length} file(s) already exist. Use --force to overwrite.`,
        details: { conflicts: conflictDetails },
      };
    }

    // Copy files
    const overwritten = [];
    for (const filePath of adapterFiles) {
      const relToAdapters = relative(packAdaptersDir, filePath);
      const targetPath = join(adaptersTarget, relToAdapters);
      const targetDir = resolve(targetPath, '..');
      mkdirSync(targetDir, { recursive: true });

      if (existsSync(targetPath) && force) {
        const { owner: prevOwner, source: prevSource } = getOwnerForFile(manifest, relToAdapters);
        overwritten.push({
          path: relToAdapters,
          previousOwner: prevOwner,
          previousSource: prevSource,
        });
      }

      cpSync(filePath, targetPath, { force: true });
    }

    // Update manifest: remove old entry for this pack name if reinstalling
    const oldPack = manifest.packs.find(p => p.name === packMeta.name);
    if (oldPack) {
      const newFilesSet = new Set(relativeFiles);
      for (const oldFile of oldPack.files) {
        if (!newFilesSet.has(oldFile)) {
          const oldPath = join(adaptersTarget, oldFile);
          if (existsSync(oldPath)) rmSync(oldPath);
        }
      }
      manifest.packs = manifest.packs.filter(p => p.name !== packMeta.name);
    }

    // If force, remove file ownership from other packs for overwritten files
    if (force && overwritten.length > 0) {
      for (const ow of overwritten) {
        for (const pack of manifest.packs) {
          pack.files = pack.files.filter(f => f !== ow.path);
        }
      }
      // Keep packs with empty file lists (PRD: only remove on explicit user action)
    }

    manifest.packs.push({
      name: packMeta.name,
      version: packMeta.version,
      description: packMeta.description,
      source: parsedSource.raw,
      files: relativeFiles,
      installedAt: new Date().toISOString(),
    });

    writeManifest(manifest);

    return {
      ok: true,
      action: 'install',
      pack: {
        name: packMeta.name,
        version: packMeta.version,
        source: parsedSource.raw,
      },
      installed: relativeFiles,
      overwritten,
      target: adaptersTarget,
    };
  } finally {
    cleanupTempDir(tmpDir);
  }
}

// --- List ---

export function listInstalledAdapters() {
  const manifest = readManifest();
  return {
    packs: manifest.packs.map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      source: p.source,
      files: p.files,
      installedAt: p.installedAt,
    })),
  };
}

// --- Remove ---

export function removeAdapter(name) {
  if (!name) {
    throw { code: 'missing_adapter_name', message: 'Pack name is required.' };
  }

  const manifest = readManifest();
  const packIndex = manifest.packs.findIndex(p => p.name === name);

  if (packIndex === -1) {
    throw { code: 'adapter_pack_not_installed', message: `Pack "${name}" is not installed.` };
  }

  const pack = manifest.packs[packIndex];
  const adaptersTarget = userAdaptersDir();
  const removedFiles = [];
  const missingFiles = [];

  for (const relPath of pack.files) {
    const targetPath = join(adaptersTarget, relPath);
    if (existsSync(targetPath)) {
      rmSync(targetPath);
      removedFiles.push(relPath);
    } else {
      missingFiles.push(relPath);
    }
  }

  // Clean up empty site directories
  const siteDirs = new Set(pack.files.map(f => f.split('/')[0]));
  for (const site of siteDirs) {
    const siteDir = join(adaptersTarget, site);
    if (existsSync(siteDir)) {
      try {
        const remaining = readdirSync(siteDir);
        if (remaining.length === 0) {
          rmSync(siteDir, { recursive: true });
        }
      } catch {
        // best effort
      }
    }
  }

  manifest.packs.splice(packIndex, 1);
  writeManifest(manifest);

  const result = {
    ok: true,
    action: 'remove',
    pack: pack.name,
    removed: removedFiles,
  };

  if (missingFiles.length > 0) {
    result.missingFiles = missingFiles;
  }

  return result;
}

// --- Help text ---

export function adapterHelp(subcommand) {
  if (subcommand === 'install') {
    return [
      'Usage: tap adapter install <source> [--force]',
      '',
      'Install an adapter pack from a remote source.',
      '',
      'Sources:',
      '  github:<owner>/<repo>   Download from GitHub (default branch)',
      '  url:<https-url>         Download zip/tarball archive',
      '  git:<git-url>           Shallow clone a git repository',
      '',
      'Options:',
      '  --force                 Overwrite existing files',
    ].join('\n');
  }

  if (subcommand === 'list') {
    return [
      'Usage: tap adapter list',
      '',
      'List installed adapter packs.',
    ].join('\n');
  }

  if (subcommand === 'remove') {
    return [
      'Usage: tap adapter remove <name>',
      '',
      'Remove an installed adapter pack.',
    ].join('\n');
  }

  return [
    'Usage: tap adapter <command>',
    '',
    'Commands:',
    '  install <source>   Install adapter pack from remote source',
    '  list               List installed adapter packs',
    '  remove <name>      Remove an installed adapter pack',
  ].join('\n');
}
