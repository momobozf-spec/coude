import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = (name: string, entry = 'index.ts'): string => fileURLToPath(new URL(`../../packages/${name}/src/${entry}`, import.meta.url));

// The admin only uses platform-independent packages (tokens, DTO types).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@superrette/ui/tokens': pkg('ui', 'tokens.ts'),
      '@superrette/validation': pkg('validation'),
      '@superrette/domain': pkg('domain'),
      '@superrette/shared': pkg('shared'),
    },
  },
  server: { port: 5173 },
});
