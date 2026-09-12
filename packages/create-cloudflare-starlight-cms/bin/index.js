#!/usr/bin/env node

import { constants } from 'node:fs';
import { access, copyFile, lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(packageRoot, 'template');
const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));

const usage = `Usage: npm create cloudflare-starlight-cms@latest <directory>\n       npx create-cloudflare-starlight-cms@latest <directory>\n\nCreate a self-hosted Astro Starlight CMS project. Use . for the current directory.\nThe destination must be new or empty (apart from .git and .DS_Store).\n\nOptions:\n  --help       Show this help message\n  --version    Show the CLI version\n`;

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
  if (configured === wranglerConfig) throw new Error('The packaged template has no Worker name to configure.');
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

const [argument] = process.argv.slice(2);
if (argument === '--help' || argument === '-h') {
  process.stdout.write(usage);
} else if (argument === '--version' || argument === '-v') {
  console.log(packageJson.version);
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
