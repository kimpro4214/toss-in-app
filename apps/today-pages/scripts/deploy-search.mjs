import { loadEnv } from 'vite';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
if (!env.TOSS_APP_NAME || !/^[a-z0-9-]+$/.test(env.TOSS_APP_NAME) || env.TOSS_APP_CONFIRMED !== 'true') {
  console.error('실제 콘솔 앱 이름 TOSS_APP_NAME과 TOSS_APP_CONFIRMED=true를 먼저 설정하세요.');
  process.exit(1);
}
const origins = [`https://${env.TOSS_APP_NAME}.apps.tossmini.com`, `https://${env.TOSS_APP_NAME}.private-apps.tossmini.com`].join(',');
const result = spawnSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'deploy', '--config', 'worker/wrangler.jsonc', '--var', `ALLOWED_ORIGINS:${origins}`], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
