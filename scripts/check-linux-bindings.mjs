import { readFile } from 'node:fs/promises';

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const packages = lock.packages ?? {};
const linuxX64 = /linux-x64(?:-(?:gnu|glibc))?$/;
const missing = new Set();

for (const pkg of Object.values(packages)) {
  for (const name of Object.keys(pkg.optionalDependencies ?? {})) {
    if (linuxX64.test(name) && !packages[`node_modules/${name}`]) missing.add(name);
  }
}

if (missing.size > 0) {
  throw new Error(`package-lock.json is missing Linux x64 native bindings: ${[...missing].sort().join(', ')}. Add the matching package as an exact optionalDependency and regenerate the lockfile.`);
}

console.log('Linux x64 native bindings are present in package-lock.json.');
