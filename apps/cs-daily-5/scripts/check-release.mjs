import { existsSync, readFileSync, readdirSync } from 'node:fs';
// .env.local은 실제 콘솔 값만 넣으며 Git에는 포함하지 않습니다.
const file = new URL('../.env.local',import.meta.url);
const local = existsSync(file)?Object.fromEntries(readFileSync(file,'utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim()]})):{};
const name=process.env.TOSS_APP_NAME||local.TOSS_APP_NAME;
const ad=process.env.VITE_REWARDED_AD_GROUP_ID||local.VITE_REWARDED_AD_GROUP_ID;
const errors=[];
if(!name||name==='cs-daily-5')errors.push('콘솔 등록 appName을 설정하세요. 현재 이름은 로컬 패키징용입니다.');
if(!ad)errors.push('콘솔의 보상형 광고 그룹 ID를 설정하세요.');
const dist=new URL('../dist/assets/',import.meta.url);
if(!existsSync(dist))errors.push('웹 빌드를 먼저 실행하세요.');
else for(const f of readdirSync(dist).filter(f=>f.endsWith('.js'))){const code=readFileSync(new URL(f,dist),'utf8');if(code.includes('devAd')||code.includes('createDevAd')||code.includes('개발 테스트: 광고'))errors.push('출시 번들에 개발 광고 코드가 있습니다.');if(ad&&!code.includes(ad))errors.push('설정한 광고 ID가 번들에 없습니다. 설정 후 재빌드하세요.');}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('출시 설정 검사 통과. 실제 광고 지급·Android/iOS QR·콘솔 심사는 별도 검증해야 합니다.');
