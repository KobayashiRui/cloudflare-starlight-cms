#!/usr/bin/env node

import { constants } from 'node:fs';
import { access, copyFile, lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upgradeProject } from '../lib/upgrade.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(packageRoot, 'template');
const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));

const usage = `Usage: npx create-starlight-cms@latest <directory>\n       npx create-starlight-cms@latest upgrade [directory] [--apply]\n\nCreate a self-hosted Astro Starlight CMS project. Use . for the current directory.\nThe destination must be new or empty (apart from .git and .DS_Store).\n\nUpgrade compares the project with its recorded template version. It shows a safe plan by\ndefault; use --apply only after the plan reports no conflicts.\n\nOptions:\n  --apply      Apply a conflict-free upgrade\n  --help       Show this help message\n  --version    Show the CLI version\n`;

function projectNameFromDirectory(directory) {
  const normalized = basename(directory)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
  return normalized && /^[a-z0-9]/.test(normalized) ? normalized : 'my-docs';
}

function workerNameFromProjectName(projectName) {
  const workerName = projectName
    .replace(/[._]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
  return workerName || 'my-docs';
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

async function assertDirectoryIsReady(destination) {
  if (!await exists(destination)) return;
  const stats = await lstat(destination);
  if (stats.isSymbolicLink()) throw new Error('The destination cannot be a symbolic link.');
  if (!stats.isDirectory()) throw new Error('The destination must be a directory.');

  const unexpected = (await readdir(destination)).filter((entry) => entry !== '.git' && entry !== '.DS_Store');
  if (unexpected.length > 0) throw new Error(`The destination is not empty: ${unexpected[0]}`);
}

async function assertNoSymlink(path) {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) throw new Error(`The packaged template contains a symbolic link: ${path}`);
  if (!stats.isDirectory()) return;
  for (const entry of await readdir(path)) await assertNoSymlink(join(path, entry));
}

async function assertDoesNotExist(path) {
  if (await exists(path)) throw new Error(`Refusing to overwrite ${path}`);
}

async function copyDirectory(source, destination, isRoot = false) {
  await mkdir(destination, { recursive: true });
  for (const name of await readdir(source)) {
    const restoredName = name.endsWith('.test.template.ts') ? name.replace('.test.template.ts', '.test.ts') : name;
    const targetName = isRoot && restoredName === '_gitignore'
      ? '.gitignore'
      : isRoot && restoredName === 'package-lock.json.template'
        ? 'package-lock.json'
        : isRoot && restoredName === 'test-files'
          ? 'tests'
        : restoredName;
    const sourcePath = join(source, name);
    const destinationPath = join(destination, targetName);
    const stats = await lstat(sourcePath);
    if (stats.isSymbolicLink()) throw new Error(`The packaged template contains a symbolic link: ${sourcePath}`);
    if (stats.isDirectory()) {
      await assertDoesNotExist(destinationPath);
      await copyDirectory(sourcePath, destinationPath);
    } else {
      await assertDoesNotExist(destinationPath);
      await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
    }
  }
}

async function configurePackage(destination, projectName) {
  const packagePath = join(destination, 'package.json');
  const projectPackage = JSON.parse(await readFile(packagePath, 'utf8'));
  projectPackage.name = projectName;
  await writeFile(packagePath, `${JSON.stringify(projectPackage, null, 2)}\n`);

  const lockPath = join(destination, 'package-lock.json');
  const lockfile = JSON.parse(await readFile(lockPath, 'utf8'));
  lockfile.name = projectName;
  if (lockfile.packages?.['']) lockfile.packages[''].name = projectName;
  await writeFile(lockPath, `${JSON.stringify(lockfile, null, 2)}\n`);
}

async function configureWrangler(destination, workerName) {
  const wranglerPath = join(destination, 'wrangler.jsonc');
  const wranglerConfig = await readFile(wranglerPath, 'utf8');
  const configured = wranglerConfig.replace(
    /("name"\s*:\s*)"[^"]+"/,
    `$1"${workerName}"`,
  );
  if (!/"name"\s*:\s*"[^"]+"/.test(wranglerConfig)) throw new Error('The packaged template has no Worker name to configure.');
  await writeFile(wranglerPath, configured);
}

function printSuccess(destination) {
  const relativeDestination = relative(process.cwd(), destination) || '.';
  const directoryForCommand = relativeDestination === '.' || relativeDestination.startsWith('..')
    ? destination
    : relativeDestination;
  const changeDirectory = relativeDestination === '.' ? '' : `\n  cd ${directoryForCommand}`;
  console.log(`\nCreated ${basename(destination)}.\n\nNext steps:${changeDirectory}\n  npm install\n  npm run dev\n\nThen edit src/site.config.ts and follow README.md for Cloudflare setup.\n`);
}

function upgradeArguments(arguments_) {
  let destination = '.';
  let apply = false;
  for (const argument of arguments_) {
    if (argument === '--apply') {
      if (apply) throw new Error('--apply was provided more than once');
      apply = true;
    } else if (argument.startsWith('-') || destination !== '.') {
      throw new Error('Expected one optional project directory');
    } else {
      destination = argument;
    }
  }
  return { destination, apply };
}

function printUpgrade(result, apply) {
  if (result.status === 'current') {
    console.log(`This project is already on template ${result.toVersion}.`);
    return;
  }
  console.log(`\nTemplate upgrade ${result.fromVersion} → ${result.toVersion}`);
  if (result.conflicts.length > 0) {
    console.log('\nNo files changed. Resolve these conflicts, then run upgrade again:');
    for (const conflict of result.conflicts) console.log(`  ${conflict}`);
    return;
  }
  if (result.changes.length === 0) {
    console.log('\nNo managed files need updating.');
  } else {
    console.log(`\n${apply ? 'Updated' : 'Would update'} managed files:`);
    for (const change of result.changes) console.log(`  ${change.type.padEnd(6)} ${change.file}`);
  }
  if (result.dependenciesChanged) console.log('\nRun npm install to update package-lock.json and dependencies.');
  if (!apply) console.log('\nReview this plan, then run the same command with --apply.');
}

const arguments_ = process.argv.slice(2);
const [argument] = arguments_;
if (argument === '--help' || argument === '-h') {
  process.stdout.write(usage);
} else if (argument === '--version' || argument === '-v') {
  console.log(packageJson.version);
} else if (argument === 'upgrade') {
  try {
    if (!await exists(templateRoot)) throw new Error('The packaged template is missing. Reinstall the CLI package.');
    await assertNoSymlink(templateRoot);
    const { destination, apply } = upgradeArguments(arguments_.slice(1));
    const result = await upgradeProject({
      projectRoot: resolve(process.cwd(), destination),
      targetTemplateRoot: templateRoot,
      targetVersion: packageJson.version,
      apply,
    });
    printUpgrade(result, apply);
    if (result.status === 'conflict') process.exitCode = 1;
  } catch (error) {
    console.error(`Could not upgrade project: ${error.message}`);
    process.exitCode = 1;
  }
} else if (!argument || argument.startsWith('-') || process.argv.length !== 3) {
  process.stderr.write(usage);
  process.exitCode = 1;
} else {
  const destination = resolve(process.cwd(), argument);
  try {
    if (!await exists(templateRoot)) throw new Error('The packaged template is missing. Reinstall the CLI package.');
    await assertNoSymlink(templateRoot);
    await assertDirectoryIsReady(destination);
    await mkdir(destination, { recursive: true });
    await copyDirectory(templateRoot, destination, true);
    const projectName = projectNameFromDirectory(destination);
    await configurePackage(destination, projectName);
    await configureWrangler(destination, workerNameFromProjectName(projectName));
    printSuccess(destination);
  } catch (error) {
    console.error(`Could not create project: ${error.message}`);
    process.exitCode = 1;
  }
}
