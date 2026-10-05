import { defineConfig } from '@apps-in-toss/web-framework/config';
import { loadEnv } from 'vite';
const settings = loadEnv('production', process.cwd(), 'TOSS_');
export default defineConfig({
  appName: settings.TOSS_APP_NAME || 'cs-daily-5',
  brand: { primaryColor: '#3182f6' },
  permissions: [],
  webBundleDir: 'dist',
});
