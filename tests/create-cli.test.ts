import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
let temporaryRoot = '';
const cli = resolve('packages/create-starlight-cms/bin/index.js');

beforeAll(async () => {
  await execute(process.execPath, ['scripts/prepare-create-template.mjs']);
  temporaryRoot = await mkdtemp(join(tmpdir(), 'create-cms-test-'));
});

afterAll(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});

it('creates an en-only project without overwriting an existing directory', async () => {
  const destination = join(temporaryRoot, 'My Documentation');
  const { stdout } = await execute(process.execPath, [cli, destination]);
  expect(stdout).toContain('npm install');

  const projectPackage = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'));
  const lockfile = JSON.parse(await readFile(join(destination, 'package-lock.json'), 'utf8'));
  const siteConfig = await readFile(join(destination, 'src', 'site.config.ts'), 'utf8');
  const wranglerConfig = await readFile(join(destination, 'wrangler.jsonc'), 'utf8');
  expect(projectPackage.name).toBe('my-documentation');
  expect(lockfile.packages[''].name).toBe('my-documentation');
  expect(siteConfig).toContain("title: 'My Docs'");
  expect(siteConfig).not.toContain("code: 'ja'");
  expect(wranglerConfig).toContain('"name": "my-documentation"');
  expect(wranglerConfig).toContain('"binding": "DB"');
  expect(wranglerConfig).toContain('"binding": "MEDIA"');
  expect(wranglerConfig).not.toMatch(/database_(?:id|name)|bucket_name/);
  expect(await readFile(join(destination, 'tests', 'content.test.ts'), 'utf8')).toContain("published build boundary");

  await expect(execute(process.execPath, [cli, destination])).rejects.toMatchObject({ stderr: expect.stringContaining('not empty') });
});

it('allows . inside a Git worktree with no project files', async () => {
  const destination = join(temporaryRoot, 'current-directory');
  await mkdir(join(destination, '.git'), { recursive: true });
  await execute(process.execPath, [cli, '.'], { cwd: destination });
  expect(await readFile(join(destination, '.gitignore'), 'utf8')).toContain('node_modules');
  await writeFile(join(destination, 'sentinel.txt'), 'keep');
  await expect(execute(process.execPath, [cli, '.'], { cwd: destination })).rejects.toMatchObject({ stderr: expect.stringContaining('not empty') });
  expect(await readFile(join(destination, 'sentinel.txt'), 'utf8')).toBe('keep');
});

it('accepts the template Worker name and includes the generated check script', async () => {
  const destination = join(temporaryRoot, 'cloudflare-starlight-cms');
  await execute(process.execPath, [cli, destination]);
  expect(await readFile(join(destination, 'wrangler.jsonc'), 'utf8')).toContain('"name": "cloudflare-starlight-cms"');
  await execute(process.execPath, ['scripts/check-linux-bindings.mjs'], { cwd: destination });
});
