import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const problems = [];
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(env.TOSS_APP_NAME || '') || env.TOSS_APP_CONFIRMED !== 'true') problems.push('실제 콘솔 앱 식별자를 TOSS_APP_NAME에 설정하고 TOSS_APP_CONFIRMED=true로 확인하세요.');
if (!env.VITE_BANNER_AD_GROUP_ID?.trim() || /test|example|placeholder/i.test(env.VITE_BANNER_AD_GROUP_ID)) problems.push('실제 배너 광고 그룹 ID가 필요해요.');
for (const [key, text] of Object.entries({ TOSS_DEVICE_VERIFIED: 'Android/iOS 토스 QR 실기기 확인', TOSS_AD_VERIFIED: '실제 광고 동작 확인', CONTENT_USAGE_REVIEWED: '음료 원자료의 최신성·상업적 이용 조건 검토', HEALTH_COPY_REVIEWED: '건강 안내 문구와 서비스 분류 검토', CONSOLE_EVENTS_VERIFIED: '분석 이벤트 수집·콘솔 전환 설정 확인' })) if (env[key] !== 'true') problems.push(`${text} 후 ${key}=true를 설정하세요.`);
if (problems.length) { problems.forEach(p => console.error(`- ${p}`)); process.exitCode = 1; }
else console.log('설정과 검증 표시를 확인했어요. 실제 검증 기록·최신 정책을 대조하고 별도 요청 시 심사를 제출하세요.');
