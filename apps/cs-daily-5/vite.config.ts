import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], server: { watch: { ignored: ['**/reports/**', '**/test-results/**'] } }, test: { include: ['tests/**/*.test.ts'] } });
