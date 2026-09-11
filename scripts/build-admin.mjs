import { build, context } from 'esbuild';
import { compile } from 'sass-embedded';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir } from 'node:fs/promises';

const assetDirectory = process.env.ADMIN_ASSETS_DIR ?? 'dist';
await mkdir(`${assetDirectory}/admin`, { recursive: true });
await copyFile('src/assets/favicon.svg', `${assetDirectory}/favicon.svg`);

const sassPlugin = {
  name: 'sass',
  setup(buildContext) {
    buildContext.onLoad({ filter: /\.scss$/ }, (args) => {
      const result = compile(args.path, { style: 'compressed', loadPaths: ['src/admin'] });
      return { contents: result.css, loader: 'css', watchFiles: result.loadedUrls.filter((url) => url.protocol === 'file:').map(fileURLToPath) };
    });
  },
};

const options = {
  entryPoints: ['src/admin/client.tsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.svg': 'dataurl' },
  outfile: `${assetDirectory}/admin/app.js`,
  alias: { '@': './src/admin' },
  plugins: [sassPlugin],
};
if (process.argv.includes('--watch')) {
  const buildContext = await context(options);
  await buildContext.watch();
  const stop = async () => { await buildContext.dispose(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} else {
  await build(options);
}
