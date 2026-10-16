import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const problems = [];
if (!env.TOSS_APP_NAME || env.TOSS_APP_CONFIRMED !== 'true') problems.push('콘솔에서 실제 앱 이름을 확인하고 TOSS_APP_NAME과 TOSS_APP_CONFIRMED=true를 설정하세요.');
if (!env.VITE_SEARCH_API_ORIGIN || !/^https:\/\//.test(env.VITE_SEARCH_API_ORIGIN)) problems.push('HTTPS 검색 Worker 주소 VITE_SEARCH_API_ORIGIN이 필요합니다.');
if (env.TOSS_DEVICE_VERIFIED !== 'true') problems.push('Android/iOS 토스 QR 실기기 검증 결과를 확인하고 TOSS_DEVICE_VERIFIED=true로 설정하세요.');
if (env.SEARCH_LIVE_VERIFIED !== 'true') problems.push('실제 카카오 검색·표지·출처 표시를 검증하고 SEARCH_LIVE_VERIFIED=true로 설정하세요.');
if (problems.length) { for (const problem of problems) console.error(`- ${problem}`); process.exitCode = 1; }
else console.log('출시 전 필수 설정과 검증 표시를 확인했습니다. 콘솔의 전환 이벤트 설정과 실제 검증 기록도 대조하세요.');
