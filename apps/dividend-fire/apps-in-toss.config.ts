import { defineConfig } from '@apps-in-toss/web-framework/config';
import { loadEnv } from 'vite';
const settings = loadEnv('production', process.cwd(), 'TOSS_');
export default defineConfig({ appName: settings.TOSS_APP_NAME || 'dividend-fire', brand: { primaryColor: '#147d73' }, permissions: [], webBundleDir: 'dist', navigationBar: { withBackButton: true, withHomeButton: false, withTitle: true, theme: 'light' } });
