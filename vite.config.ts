import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const AUTO_IMPORT_DIR = join(__dirname, 'public', 'auto-import');

function autoImportPlugin() {
  return {
    name: 'auto-import',
    configureServer(server) {
      // Endpoint to list and fetch pending imports
      server.middlewares.use('/api/auto-imports', (_req, res) => {
        if (!existsSync(AUTO_IMPORT_DIR)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([]));
          return;
        }
        const files = readdirSync(AUTO_IMPORT_DIR).filter(f => f.endsWith('.json'));
        const imports = [];
        for (const file of files) {
          try {
            const content = readFileSync(join(AUTO_IMPORT_DIR, file), 'utf-8');
            const data = JSON.parse(content);
            imports.push(data);
            // Remove after successful read
            unlinkSync(join(AUTO_IMPORT_DIR, file));
          } catch (e) {
            console.error(`[auto-import] Failed to process ${file}:`, e);
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(imports));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), autoImportPlugin()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
