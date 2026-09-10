import { build } from 'esbuild';
import { compile } from 'sass-embedded';

const sassPlugin = {
  name: 'sass',
  setup(buildContext) {
    buildContext.onLoad({ filter: /\.scss$/ }, (args) => ({
      contents: compile(args.path, { style: 'compressed', loadPaths: ['src/admin'] }).css,
      loader: 'css',
    }));
  },
};

await build({
  entryPoints: ['src/admin/client.tsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  outfile: 'dist/admin/app.js',
  alias: { '@': './src/admin' },
  plugins: [sassPlugin],
});
