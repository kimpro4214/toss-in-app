import { defineConfig } from '@apps-in-toss/web-framework/config';
import { loadEnv } from 'vite';
const env = loadEnv('production', process.cwd(), 'TOSS_');
export default defineConfig({ appName: env.TOSS_APP_NAME || 'today-pages', brand: { primaryColor: '#2F6B4F' }, permissions: [], webBundleDir: 'dist' });
