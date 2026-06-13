import * as esbuild from 'esbuild';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(fileURLToPath(import.meta.url), '../..');

const common = {
  bundle: true,
  platform: 'node',
  target: 'es2022',
  format: 'cjs',
  external: ['@libsql/client'],
  alias: {
    '@sour/llm-config': resolve(root, 'packages/llm-config/src'),
  },
};

await Promise.all([
  esbuild.build({
    ...common,
    entryPoints: [resolve(root, 'vercel-entry-data.ts')],
    outfile: resolve(root, 'api/[...data].js'),
  }),
  esbuild.build({
    ...common,
    entryPoints: [resolve(root, 'vercel-entry-llm.ts')],
    outfile: resolve(root, 'api/[...llm].js'),
  }),
]);
