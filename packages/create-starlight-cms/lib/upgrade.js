import { constants } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const ignoredTemplateFiles = new Set(['package-lock.json']);
const managedPackageFields = ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'engines'];

function templatePath(name, root) {
  const restored = name.endsWith('.test.template.ts') ? name.replace('.test.template.ts', '.test.ts') : name;
  if (root && restored === '_gitignore') return '.gitignore';
  if (root && restored === 'package-lock.json.template') return 'package-lock.json';
  if (root && restored === 'test-files') return 'tests';
  return restored;
}

function same(left, right) {
  if (Buffer.isBuffer(left) && Buffer.isBuffer(right)) return left.equals(right);
  return JSON.stringify(left) === JSON.stringify(right);
}

function versionParts(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new Error(`Unsupported template version: ${String(version)}`);
  return match.slice(1, 4).map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function assertDirectory(path, label) {
  if (!await exists(path)) throw new Error(`${label} does not exist: ${path}`);
  const stats = await lstat(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`${label} must be a real directory: ${path}`);
}

async function assertProjectPath(projectRoot, target) {
  const root = resolve(projectRoot);
  let current = resolve(target);
  const route = relative(root, current);
  if (route === '..' || route.startsWith(`..${sep}`) || isAbsolute(route)) throw new Error(`Refusing to access a path outside the project: ${target}`);
  while (current !== root) {
    if (await exists(current)) {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) throw new Error(`Refusing to follow a symbolic link in the project: ${relative(root, current)}`);
    }
    current = dirname(current);
  }
}

export async function templateFiles(templateRoot) {
  await assertDirectory(templateRoot, 'Template directory');
  const files = new Map();

  async function visit(directory, prefix = '', root = false) {
    for (const name of await readdir(directory)) {
      const source = join(directory, name);
      const stats = await lstat(source);
      if (stats.isSymbolicLink()) throw new Error(`Template contains a symbolic link: ${source}`);
      const outputName = templatePath(name, root);
      const outputPath = prefix ? `${prefix}/${outputName}` : outputName;
      if (stats.isDirectory()) await visit(source, outputPath, false);
      else if (!ignoredTemplateFiles.has(outputPath)) files.set(outputPath, await readFile(source));
    }
  }

  await visit(templateRoot, '', true);
  return files;
}

async function projectFile(projectRoot, file) {
  const path = join(projectRoot, file);
  await assertProjectPath(projectRoot, path);
  if (!await exists(path)) return undefined;
  const stats = await lstat(path);
  if (!stats.isFile()) throw new Error(`Expected a file in the project: ${file}`);
  return readFile(path);
}

function normalizedWrangler(value) {
  return value?.toString('utf8').replace(/("name"\s*:\s*)"[^"]+"/, '$1"__CMS_WORKER_NAME__"');
}

function workerName(value) {
  return /"name"\s*:\s*"([^"]+)"/.exec(value.toString('utf8'))?.[1];
}

function restoreWorkerName(template, current) {
  const name = workerName(current);
  if (!name) return template;
  return Buffer.from(template.toString('utf8').replace(/("name"\s*:\s*)"[^"]+"/, `$1"${name}"`));
}

function fileMatches(path, left, right) {
  if (left === undefined || right === undefined) return left === right;
  if (path === 'wrangler.jsonc') return normalizedWrangler(left) === normalizedWrangler(right);
  return same(left, right);
}

function valueMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mergePackage(projectPackage, oldPackage, targetPackage, targetVersion) {
  const output = structuredClone(projectPackage);
  const conflicts = [];
  let changed = false;
  let dependenciesChanged = false;

  for (const field of managedPackageFields) {
    const current = valueMap(projectPackage[field]);
    const oldValue = valueMap(oldPackage[field]);
    const target = valueMap(targetPackage[field]);
    const result = { ...current };
    for (const key of new Set([...Object.keys(oldValue), ...Object.keys(target)])) {
      const local = current[key];
      const previous = oldValue[key];
      const next = target[key];
      if (same(local, previous)) {
        if (next === undefined) delete result[key];
        else result[key] = next;
        if (!same(local, next)) {
          changed = true;
          if (['dependencies', 'devDependencies', 'optionalDependencies'].includes(field)) dependenciesChanged = true;
        }
      } else if (!same(previous, next) && !same(local, next)) {
        conflicts.push(`package.json: ${field}.${key}`);
      }
    }
    if (Object.keys(result).length > 0) output[field] = result;
    else delete output[field];
  }

  output.cloudflareStarlightCms = { ...valueMap(projectPackage.cloudflareStarlightCms), templateVersion: targetVersion };
  if (projectPackage.cloudflareStarlightCms?.templateVersion !== targetVersion) changed = true;
  return { content: Buffer.from(`${JSON.stringify(output, null, 2)}\n`), conflicts, changed, dependenciesChanged };
}

function parsePackage(value, label) {
  try {
    return JSON.parse(value.toString('utf8'));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

/** Build a three-way upgrade plan without changing the project. */
export async function buildUpgradePlan({ projectRoot, oldTemplateRoot, targetTemplateRoot, fromVersion, toVersion }) {
  await assertDirectory(projectRoot, 'Project directory');
  const oldFiles = await templateFiles(oldTemplateRoot);
  const targetFiles = await templateFiles(targetTemplateRoot);
  const projectPackageContent = await projectFile(projectRoot, 'package.json');
  if (!projectPackageContent) throw new Error('package.json is missing from the project');
  const oldPackage = oldFiles.get('package.json');
  const targetPackage = targetFiles.get('package.json');
  if (!oldPackage || !targetPackage) throw new Error('The CMS template package.json is missing');

  const packageUpdate = mergePackage(
    parsePackage(projectPackageContent, 'Project package.json'),
    parsePackage(oldPackage, 'Old template package.json'),
    parsePackage(targetPackage, 'Target template package.json'),
    toVersion,
  );
  const changes = [];
  const conflicts = [...packageUpdate.conflicts];

  for (const file of new Set([...oldFiles.keys(), ...targetFiles.keys()])) {
    if (file === 'package.json') continue;
    const oldContent = oldFiles.get(file);
    const targetContent = targetFiles.get(file);
    const currentContent = await projectFile(projectRoot, file);
    // File removal is deliberately manual, so it cannot create a conflict or
    // delete an otherwise working user file.
    if (!targetContent) continue;
    if (fileMatches(file, currentContent, oldContent)) {
      if (!fileMatches(file, targetContent, oldContent)) {
        changes.push({ type: currentContent ? 'update' : 'add', file, content: file === 'wrangler.jsonc' && currentContent ? restoreWorkerName(targetContent, currentContent) : targetContent });
      }
    } else if (!fileMatches(file, oldContent, targetContent) && !fileMatches(file, currentContent, targetContent)) {
      conflicts.push(file);
    }
  }
  if (packageUpdate.changed) changes.push({ type: 'update', file: 'package.json', content: packageUpdate.content });
  return { fromVersion, toVersion, changes, conflicts, dependenciesChanged: packageUpdate.dependenciesChanged };
}

/** Apply a precomputed conflict-free upgrade plan. The lockfile remains user-owned. */
export async function applyUpgradePlan(projectRoot, plan) {
  if (plan.conflicts.length > 0) throw new Error('Refusing to apply an upgrade with conflicts');
  await assertDirectory(projectRoot, 'Project directory');
  for (const change of plan.changes) {
    const target = join(projectRoot, change.file);
    await assertProjectPath(projectRoot, target);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, change.content);
  }
}

async function downloadTemplate(version) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'create-starlight-cms-upgrade-'));
  try {
    await execute(npmCommand, [
      'install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', '--prefix', temporaryRoot,
      `create-starlight-cms@${version}`,
    ], { maxBuffer: 4 * 1024 * 1024 });
    const templateRoot = join(temporaryRoot, 'node_modules', 'create-starlight-cms', 'template');
    await assertDirectory(templateRoot, `Template for ${version}`);
    return { templateRoot, cleanup: () => rm(temporaryRoot, { recursive: true, force: true }) };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    const details = error.stderr?.trim();
    throw new Error(`Could not download create-starlight-cms@${version}${details ? `: ${details}` : ''}`);
  }
}

export async function upgradeProject({ projectRoot, targetTemplateRoot, targetVersion, apply = false }) {
  await assertDirectory(projectRoot, 'Project directory');
  const packageContent = await projectFile(projectRoot, 'package.json');
  if (!packageContent) throw new Error('package.json is missing from the project');
  const projectPackage = parsePackage(packageContent, 'Project package.json');
  const fromVersion = projectPackage.cloudflareStarlightCms?.templateVersion;
  if (typeof fromVersion !== 'string') throw new Error('This project has no cloudflareStarlightCms.templateVersion. It cannot be upgraded automatically.');
  if (compareVersions(fromVersion, targetVersion) > 0) throw new Error(`This project was created by ${fromVersion}, newer than this CLI (${targetVersion}). Run npx create-starlight-cms@latest upgrade .`);
  if (compareVersions(fromVersion, targetVersion) === 0) return { status: 'current', fromVersion, toVersion: targetVersion, changes: [], conflicts: [], dependenciesChanged: false };

  const previous = await downloadTemplate(fromVersion);
  try {
    const plan = await buildUpgradePlan({ projectRoot, oldTemplateRoot: previous.templateRoot, targetTemplateRoot, fromVersion, toVersion: targetVersion });
    if (plan.conflicts.length > 0) return { status: 'conflict', ...plan };
    if (apply) await applyUpgradePlan(projectRoot, plan);
    return { status: apply ? 'applied' : 'ready', ...plan };
  } finally {
    await previous.cleanup();
  }
}
