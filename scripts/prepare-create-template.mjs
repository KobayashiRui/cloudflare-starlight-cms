import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(repositoryRoot, 'packages', 'create-cloudflare-starlight-cms');
const templateRoot = join(packageRoot, 'template');
const packageJsonPath = join(packageRoot, 'package.json');

const entries = [
  'src',
  'migrations',
  'scripts/dev.mjs',
  'scripts/build-admin.mjs',
  'tests',
  'astro.config.mjs',
  'wrangler.jsonc',
  'tsconfig.json',
  'tsconfig.admin.json',
  'worker-configuration.d.ts',
  'package.json',
  'package-lock.json',
  '.gitignore',
  '.nvmrc',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
];

const templateSiteConfig = `/** Public site settings. Secrets belong in Cloudflare. */
export const siteConfig = {
  title: 'My Docs',
  url: '', // Set the production origin, e.g. https://docs.example.com
  defaultLocale: 'en',
  locales: [{ code: 'en', label: 'English' }],
} as const;
`;

function fail(message) {
  throw new Error(`Could not prepare create-cloudflare-starlight-cms template: ${message}`);
}

async function assertNoSymlink(path) {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) fail(`symlink found at ${path}`);
  if (!stats.isDirectory()) return;
  for (const entry of await readdir(path)) await assertNoSymlink(join(path, entry));
}

async function copyEntry(name) {
  const source = join(repositoryRoot, name);
  try {
    await assertNoSymlink(source);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  const destinationName = name === '.gitignore'
    ? '_gitignore'
    : name === 'package-lock.json'
      ? 'package-lock.json.template'
      : name === 'tests'
        ? 'test-files'
      : name;
  await cp(source, join(templateRoot, destinationName), { recursive: true, force: false, errorOnExist: true });
}

const cliPackage = JSON.parse(await readFile(packageJsonPath, 'utf8'));
await rm(templateRoot, { recursive: true, force: true });
await mkdir(templateRoot, { recursive: true });

for (const entry of entries) await copyEntry(entry);
// This test exercises the create CLI from the source repository. It has no
// meaning inside a generated CMS project and refers to the package directory.
await rm(join(templateRoot, 'test-files', 'create-cli.test.ts'), { force: true });
for (const name of await readdir(join(templateRoot, 'test-files'))) {
  if (name.endsWith('.test.ts')) await rename(join(templateRoot, 'test-files', name), join(templateRoot, 'test-files', name.replace('.test.ts', '.test.template.ts')));
}

const templatePackagePath = join(templateRoot, 'package.json');
const templatePackage = JSON.parse(await readFile(templatePackagePath, 'utf8'));
templatePackage.cloudflareStarlightCms = { templateVersion: cliPackage.version };
await writeFile(templatePackagePath, `${JSON.stringify(templatePackage, null, 2)}\n`);
await writeFile(join(templateRoot, 'src', 'site.config.ts'), templateSiteConfig);

const rootReadme = await readFile(join(repositoryRoot, 'README.md'), 'utf8');
const templateReadme = rootReadme
  .replace('# Cloudflare Starlight CMS', '# My Docs')
  .replace('[English](README.md) · [日本語](README.ja.md)\n\n', '')
  .replace(
    'A self-hosted documentation CMS for Astro Starlight, built on Cloudflare Workers, D1, R2, and Access.',
    'A documentation site created with cloudflare-starlight-cms.',
  )
  .replace(
    'Create a project after the CLI is published, or clone this repository today:\n\n```sh\nnpx create-cloudflare-starlight-cms@latest my-docs\ncd my-docs\nnpm install\nnpm run dev\n```',
    'Install dependencies and start local development:\n\n```sh\nnpm install\nnpm run dev\n```',
  )
  .replace(
    'See [Architecture](docs/ARCHITECTURE.md) for design details and [Roadmap](docs/ROADMAP.md) for implementation status. Production configuration is designed but has not yet been verified against a real Cloudflare account.',
    'Configure the site title, locales, and public URL in `src/site.config.ts`. CMS updates are not automatic; selectively bring the changes you need into this project.',
  );
await writeFile(join(templateRoot, 'README.md'), templateReadme);
