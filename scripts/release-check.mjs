import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, '..');
const packageRoot = join(repositoryRoot, 'packages', 'create-starlight-cms');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'cloudflare-starlight-cms-release-'));

async function run(command, arguments_, cwd = repositoryRoot) {
  try {
    const { stdout, stderr } = await execute(command, arguments_, { cwd, maxBuffer: 8 * 1024 * 1024 });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

try {
  await run('npm', ['run', 'check']);
  await run('npm', ['test']);
  await run('npm', ['run', 'build:empty']);
  await run('npm', ['run', 'dry-run']);

  // npm publish --dry-run propagates npm_config_dry_run to child npm commands.
  // This check needs the real tgz, so override it only for npm pack.
  const { stdout } = await execute('npm', ['pack', '--json', '--dry-run=false', '--pack-destination', temporaryRoot], {
    cwd: packageRoot,
    maxBuffer: 2 * 1024 * 1024,
  });
  const packed = JSON.parse(stdout);
  const artifact = packed[0];
  if (!artifact?.filename || !Array.isArray(artifact.files)) throw new Error('npm pack did not return an artifact manifest');
  if (artifact.files.some((file) => /(^|\/)(?:\.env|\.dev\.vars)(?:\.|$)/.test(file.path))) {
    throw new Error('The npm artifact contains a local environment file');
  }

  const runnerRoot = join(temporaryRoot, 'runner');
  await mkdir(runnerRoot);
  await run('npm', ['install', '--dry-run=false', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', '--prefix', runnerRoot, join(temporaryRoot, artifact.filename)]);
  const cli = join(runnerRoot, 'node_modules', 'create-starlight-cms', 'bin', 'index.js');
  const project = join(temporaryRoot, 'my-docs');
  await run(process.execPath, [cli, project]);

  const generatedPackage = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  const generatedWrangler = await readFile(join(project, 'wrangler.jsonc'), 'utf8');
  if (generatedPackage.name !== 'my-docs') throw new Error('The packed CLI did not normalize the generated project name');
  if (!generatedWrangler.includes('"name": "my-docs"')) throw new Error('The packed CLI did not set the Worker name');
  for (const script of ['release:check', 'release:dry-run', 'publish:cli']) {
    if (script in generatedPackage.scripts) throw new Error(`The packed CLI included the root-only ${script} script`);
  }
  await run(process.execPath, [join(project, 'scripts', 'check-linux-bindings.mjs')], project);

  console.log(`Release package check passed: ${artifact.filename}`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
