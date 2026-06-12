import { writeFileSync, mkdirSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.vercel/output');

// 1. Copy client dist as static files
const staticDir = resolve(output, 'static');
mkdirSync(staticDir, { recursive: true });
cpSync(resolve(root, 'packages/client/dist'), staticDir, { recursive: true });

// 2. Set up API function
const funcDir = resolve(output, 'functions/api/[...route].func/api');
mkdirSync(funcDir, { recursive: true });

// Copy the bundled handler
cpSync(resolve(root, 'api/[...route].js'), resolve(funcDir, '[...route].js'));

// Function config
const vcConfig = {
  handler: 'api/[...route].js',
  runtime: 'nodejs24.x',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
};
writeFileSync(resolve(output, 'functions/api/[...route].func/.vc-config.json'), JSON.stringify(vcConfig, null, 2));

// 3. Route config
const config = {
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '^/api/(.*)$', dest: '/api/[...route]?...route=$1' },
    { src: '/(.*)', dest: '/' },
    { handle: 'error' },
    { status: 404, src: '^(?!/api).*$', dest: '/404.html' },
    { handle: 'miss' },
    { src: '^/api/(.+)(?:\\.(?:js))$', dest: '/api/$1', check: true },
  ],
};
writeFileSync(resolve(output, 'config.json'), JSON.stringify(config, null, 2));

console.log('[deploy-build] Build Output API v3 ready');
