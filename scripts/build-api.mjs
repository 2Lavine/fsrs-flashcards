import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
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

await esbuild.build({
  ...common,
  entryPoints: [resolve(root, 'vercel-entry-api.ts')],
  outfile: resolve(root, 'api/[...route].js'),
});

// Copy client dist to public/ so Vercel legacy mode serves the SPA
const publicDir = resolve(root, 'public');
if (existsSync(publicDir)) rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
cpSync(resolve(root, 'packages/client/dist'), publicDir, { recursive: true });
