import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (mode === 'production' && /test|example|placeholder/i.test(env.VITE_BANNER_AD_GROUP_ID || '')) throw new Error('운영 빌드에는 테스트 광고 ID를 넣을 수 없어요.');
  return { plugins: [react()], server: { watch: { ignored: ['**/reports/**', '**/test-results/**'] } } };
});
