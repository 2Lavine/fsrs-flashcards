import * as esbuild from 'esbuild';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(fileURLToPath(import.meta.url), '../..');

await esbuild.build({
  entryPoints: [resolve(root, 'api-src/route.ts')],
  bundle: true,
  platform: 'node',
  target: 'es2022',
  format: 'esm',
  outfile: resolve(root, 'api/[...route].js'),
  external: ['@libsql/client', '@vercel/node'],
  alias: {
    '@sour/llm-config': resolve(root, 'packages/llm-config/src/index.ts'),
    '@fsrs/shared/schema': resolve(root, 'packages/shared/src/schema.ts'),
  },
});
