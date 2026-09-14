import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { applyUpgradePlan, buildUpgradePlan } from '../packages/create-starlight-cms/lib/upgrade.js';

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
  expect(projectPackage.scripts).not.toHaveProperty('release:check');
  expect(projectPackage.scripts).not.toHaveProperty('release:dry-run');
  expect(projectPackage.scripts).not.toHaveProperty('publish:cli');
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

it('recognizes a project created by the current CLI as already current', async () => {
  const destination = join(temporaryRoot, 'already-current');
  await execute(process.execPath, [cli, destination]);
  const { stdout } = await execute(process.execPath, [cli, 'upgrade', destination]);
  const cliPackage = JSON.parse(await readFile('packages/create-starlight-cms/package.json', 'utf8'));
  expect(stdout).toContain(`already on template ${cliPackage.version}`);
});

async function writeFixture(root: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    const target = join(root, file);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, content);
  }
}

const oldPackage = JSON.stringify({
  name: 'my-docs',
  scripts: { dev: 'old-dev' },
  dependencies: { base: '1.0.0' },
  devDependencies: {},
  optionalDependencies: {},
  engines: { node: '>=22' },
  cloudflareStarlightCms: { templateVersion: '0.9.0' },
}, null, 2);

const targetPackage = JSON.stringify({
  name: 'my-docs',
  scripts: { dev: 'new-dev', check: 'new-check' },
  dependencies: { base: '2.0.0', added: '1.0.0' },
  devDependencies: {},
  optionalDependencies: {},
  engines: { node: '>=22.19.0' },
  cloudflareStarlightCms: { templateVersion: '0.10.0' },
}, null, 2);

it('applies only unchanged template files and preserves project settings', async () => {
  const oldTemplate = join(temporaryRoot, 'old-template');
  const targetTemplate = join(temporaryRoot, 'target-template');
  const project = join(temporaryRoot, 'upgrade-project');
  await writeFixture(oldTemplate, {
    'package.json': oldPackage,
    'src/core.ts': 'export const version = "old";\n',
    'src/obsolete.ts': 'export const obsolete = true;\n',
    'src/site.config.ts': 'export const title = "My Docs";\n',
    'wrangler.jsonc': '{ "name": "my-docs" }\n',
  });
  await writeFixture(targetTemplate, {
    'package.json': targetPackage,
    'src/core.ts': 'export const version = "new";\n',
    'src/site.config.ts': 'export const title = "My Docs";\n',
    'src/new-file.ts': 'export const added = true;\n',
    'wrangler.jsonc': '{ "name": "my-docs", "compatibility_date": "2026-09-14" }\n',
  });
  await writeFixture(project, {
    'package.json': JSON.stringify({
      ...JSON.parse(oldPackage),
      name: 'team-docs',
      scripts: { dev: 'old-dev', custom: 'team-command' },
      dependencies: { base: '1.0.0', team: '3.0.0' },
    }, null, 2),
    'src/core.ts': 'export const version = "old";\n',
    'src/obsolete.ts': 'export const obsolete = false;\n',
    'src/site.config.ts': 'export const title = "Team Docs";\n',
    'wrangler.jsonc': '{ "name": "team-docs" }\n',
  });

  const plan = await buildUpgradePlan({ projectRoot: project, oldTemplateRoot: oldTemplate, targetTemplateRoot: targetTemplate, fromVersion: '0.9.0', toVersion: '0.10.0' });
  expect(plan.conflicts).toEqual([]);
  expect(plan.dependenciesChanged).toBe(true);
  expect(plan.changes.map((change) => change.file)).toEqual(expect.arrayContaining(['src/core.ts', 'src/new-file.ts', 'wrangler.jsonc', 'package.json']));

  await applyUpgradePlan(project, plan);
  expect(await readFile(join(project, 'src/core.ts'), 'utf8')).toContain('"new"');
  expect(await readFile(join(project, 'src/new-file.ts'), 'utf8')).toContain('added');
  expect(await readFile(join(project, 'src/obsolete.ts'), 'utf8')).toContain('false');
  expect(await readFile(join(project, 'src/site.config.ts'), 'utf8')).toContain('Team Docs');
  expect(await readFile(join(project, 'wrangler.jsonc'), 'utf8')).toContain('"name": "team-docs"');
  const updated = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  expect(updated.scripts).toMatchObject({ dev: 'new-dev', check: 'new-check', custom: 'team-command' });
  expect(updated.dependencies).toMatchObject({ base: '2.0.0', added: '1.0.0', team: '3.0.0' });
  expect(updated.cloudflareStarlightCms.templateVersion).toBe('0.10.0');
});

it('refuses to apply a file changed by both the project and target template', async () => {
  const oldTemplate = join(temporaryRoot, 'conflict-old-template');
  const targetTemplate = join(temporaryRoot, 'conflict-target-template');
  const project = join(temporaryRoot, 'conflict-project');
  await writeFixture(oldTemplate, { 'package.json': oldPackage, 'src/core.ts': 'old\n' });
  await writeFixture(targetTemplate, { 'package.json': targetPackage, 'src/core.ts': 'target\n' });
  await writeFixture(project, {
    'package.json': JSON.stringify({ ...JSON.parse(oldPackage), name: 'team-docs' }, null, 2),
    'src/core.ts': 'local\n',
  });

  const plan = await buildUpgradePlan({ projectRoot: project, oldTemplateRoot: oldTemplate, targetTemplateRoot: targetTemplate, fromVersion: '0.9.0', toVersion: '0.10.0' });
  expect(plan.conflicts).toContain('src/core.ts');
  await expect(applyUpgradePlan(project, plan)).rejects.toThrow('conflicts');
  expect(await readFile(join(project, 'src/core.ts'), 'utf8')).toBe('local\n');
});
