import { defineConfig } from '@apps-in-toss/web-framework/config';
import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), 'TOSS_'), ...process.env };
export default defineConfig({ appName: env.TOSS_APP_NAME || 'caffeine-clock', brand: { primaryColor: '#76513C' }, permissions: [], webBundleDir: 'dist' });
