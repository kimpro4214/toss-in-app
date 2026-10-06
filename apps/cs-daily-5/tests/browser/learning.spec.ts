import { test, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import type { Question } from '../../src/types';
const key='cs-daily-5:v1:browser';
const directory=new URL('../../src/content/',import.meta.url);
const questions=readdirSync(directory).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(new URL(f,directory),'utf8')) as Question[]);
async function configureAll(page: Page) {
  await page.getByRole('button',{name:'전체 과목',exact:true}).click();
  await page.getByRole('button',{name:'선택한 과목으로 시작하기',exact:true}).click();
  await expect(page.getByRole('button',{name:'오늘의 5문제 시작',exact:true})).toBeVisible();
}
async function finishDaily(page: Page, wrong=false) {
  await configureAll(page);
  await page.getByRole('button',{name:'오늘의 5문제 시작',exact:true}).click();
  for(let i=0;i<5;i++){
    const id=await page.locator('.question-view').getAttribute('data-question-id');const q=questions.find(q=>q.id===id);
    await page.locator('.choice').nth(wrong?q!.choices.findIndex(c=>c.id!==q!.correctChoiceId):0).click();await page.getByRole('button',{name:'답 제출',exact:true}).click();
    await expect(page.locator('.explanation')).toBeVisible();
    await page.getByRole('button',{name:i===4?'학습 결과 보기':'다음 문제',exact:true}).click();
  }
  await expect(page.locator('.result-hero')).toBeVisible();
}
test('모바일 학습·해설·새로고침·결과·복습·추가 세트 복원',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await configureAll(page);
  await page.screenshot({path:'test-results/home.png',fullPage:true});
  await page.getByRole('button',{name:'한 과목 집중',exact:true}).click();await page.getByLabel('공부할 과목').selectOption('graphics');
  await page.getByRole('button',{name:'오늘의 5문제 시작',exact:true}).click();
  const id=await page.locator('.question-view').getAttribute('data-question-id');
  await page.locator('.choice').first().click();await page.getByRole('button',{name:'답 제출',exact:true}).click();
  await expect(page.locator('.explanation')).toBeVisible();await page.screenshot({path:'test-results/answer.png',fullPage:true});
  const first=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions[0].answers,key);
  await page.reload();await page.getByRole('button',{name:/이어서 풀기/}).click();
  expect(await page.locator('.question-view').getAttribute('data-question-id')).not.toBe(id);
  for(let i=1;i<5;i++){await page.locator('.choice').first().click();await page.getByRole('button',{name:'답 제출',exact:true}).click();await expect(page.locator('.explanation')).toBeVisible();await page.getByRole('button',{name:i===4?'학습 결과 보기':'다음 문제',exact:true}).click()}
  await expect(page.locator('.result-hero')).toBeVisible();
  await page.getByRole('button',{name:'개발 광고 테스트 · 3문제',exact:true}).click();await expect(page.locator('.question-meta b')).toHaveText('1 / 3');
  const bonusID=await page.locator('.question-view').getAttribute('data-question-id');await page.reload();await page.getByRole('button',{name:'추가 학습 이어하기'}).click();
  expect(await page.locator('.question-view').getAttribute('data-question-id')).toBe(bonusID);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions[0].answers,key)).toMatchObject(first);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
for(const mode of ['cancel','load-failure','show-failure','duplicate'])test(`광고 ${mode} 처리`,async({page})=>{
  await page.goto(`/?devAd=${mode}`);await finishDaily(page);
  if(mode==='load-failure'){await expect(page.getByRole('alert')).toContainText('개발');}
  else {await page.getByRole('button',{name:'개발 광고 테스트 · 3문제',exact:true}).click();if(mode==='duplicate')await expect(page.locator('.question-meta b')).toHaveText('1 / 3');else await expect(page.getByRole('alert')).toBeVisible()}
  const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
  expect(state.sessions.filter((s:{kind:string})=>s.kind==='bonus')).toHaveLength(mode==='duplicate'?1:0);
  expect(Object.keys(state.firstAnswers)).toHaveLength(5);
});
test('저장 실패는 제출 성공으로 보이지 않으며 재시도 가능',async({page})=>{
  await page.goto('/');await configureAll(page);await page.getByRole('button',{name:'오늘의 5문제 시작',exact:true}).click();await page.locator('.choice').first().click();
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('quota test')}});
  await page.getByRole('button',{name:'답 제출',exact:true}).click();await expect(page.getByRole('alert')).toContainText('저장하지 못했습니다');await expect(page.locator('.explanation')).toHaveCount(0);
  const answers=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions[0].answers,key);expect(Object.keys(answers)).toHaveLength(0);
  await page.reload();await page.getByRole('button',{name:/이어서 풀기/}).click();await page.locator('.choice').first().click();await page.getByRole('button',{name:'답 제출',exact:true}).click();await expect(page.locator('.explanation')).toBeVisible();
});
test('오답 복습 후 최초 점수·답 유지',async({page})=>{
  await page.goto('/');await finishDaily(page,true);
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
  await page.getByRole('button',{name:'오답 복습하기',exact:true}).click();
  expect(Object.keys(before.mistakes)).toHaveLength(5);await page.locator('.review-row').first().click();await page.locator('.choice').first().click();await page.getByRole('button',{name:'답 제출',exact:true}).click();await expect(page.locator('.explanation')).toBeVisible();
  const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);expect(after.firstAnswers).toEqual(before.firstAnswers);expect(after.sessions[0].answers).toEqual(before.sessions[0].answers);
});
test('읽을 수 없는 기록은 덮어쓰지 않고 오류를 표시',async({page})=>{
  await page.addInitScript(k=>localStorage.setItem(k,JSON.stringify({schemaVersion:99,sessions:[]})),key);
  await page.goto('/');await expect(page.getByRole('alert')).toContainText('기존 기록은 덮어쓰지 않았습니다');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).schemaVersion,key)).toBe(99);
});
test('새 문제 3개가 없으면 개발 광고도 숨긴다',async({page})=>{
  await page.goto('/');await finishDaily(page);
  await page.evaluate(({key,ids})=>{const state=JSON.parse(localStorage.getItem(key)!);state.firstAnswers={};for(const id of ids)state.firstAnswers[id]={choiceId:'c0',correct:true,at:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(state))},{key,ids:questions.map(q=>q.id)});
  await page.reload();await page.getByRole('button',{name:'오늘 결과 보기',exact:true}).click();await expect(page.locator('.result-hero')).toBeVisible();await expect(page.getByRole('button',{name:'개발 광고 테스트 · 3문제',exact:true})).toHaveCount(0);
});

test('처음에 C++만 선택하고 코드 빈칸·추가 학습·설정 복원을 확인한다',async({page})=>{
  await page.addInitScript(()=>{Math.random=()=>.99});
  await page.goto('/');await expect(page.getByRole('heading',{name:'무엇을 공부하고 있나요?'})).toBeVisible();
  await page.getByRole('button',{name:'선택 초기화',exact:true}).click();
  await expect(page.getByRole('button',{name:'선택한 과목으로 시작하기',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:'C++',exact:true}).check();
  await page.getByRole('button',{name:'선택한 과목으로 시작하기',exact:true}).click();
  await expect(page.locator('.preference-summary p')).toHaveText('C++');
  await page.reload();await expect(page.locator('.preference-summary p')).toHaveText('C++');
  await page.getByRole('button',{name:'오늘의 5문제 시작',exact:true}).click();
  await expect(page.locator('.code-blank').first()).toBeVisible();
  await page.screenshot({path:'test-results/cpp-blank.png',fullPage:true});
  for(let i=0;i<5;i++){
    const id=await page.locator('.question-view').getAttribute('data-question-id');
    const q=questions.find(q=>q.id===id)!;expect(q.subject).toBe('cpp');
    await page.locator('.choice').nth(q.choices.findIndex(c=>c.id===q.correctChoiceId)).click();
    await page.getByRole('button',{name:'답 제출',exact:true}).click();await expect(page.locator('.explanation')).toBeVisible();
    await page.getByRole('button',{name:i===4?'학습 결과 보기':'다음 문제',exact:true}).click();
  }
  await page.getByRole('button',{name:'개발 광고 테스트 · 3문제',exact:true}).click();
  await expect(page.locator('.question-meta b')).toHaveText('1 / 3');
  const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
  expect(state.settings.selectedSubjects).toEqual(['cpp']);
  expect(state.sessions.every((s:{entries:{questionId:string}[]})=>s.entries.every(e=>e.questionId.startsWith('cpp-')))).toBe(true);
  expect(state.sessions[1].entries).toHaveLength(3);
});
test('분야 선택을 수정하고 저장해도 시작한 세트와 최초 답은 유지한다',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'프론트엔드',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'JavaScript',exact:true})).toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Java',exact:true})).not.toBeChecked();
  await page.getByRole('button',{name:'선택한 과목으로 시작하기',exact:true}).click();
  await page.getByRole('button',{name:'오늘의 5문제 시작',exact:true}).click();
  await page.locator('.choice').first().click();await page.getByRole('button',{name:'답 제출',exact:true}).click();
  await expect(page.locator('.explanation')).toBeVisible();
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
  await page.getByRole('button',{name:'오늘',exact:true}).click();
  await page.getByRole('button',{name:'학습 과목 변경',exact:true}).click();
  await page.getByRole('button',{name:'선택 초기화',exact:true}).click();await page.getByRole('checkbox',{name:'C++',exact:true}).check();
  await page.getByRole('button',{name:'학습 범위 저장',exact:true}).click();await page.reload();
  const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
  expect(after.settings.selectedSubjects).toEqual(['cpp']);expect(after.sessions).toEqual(before.sessions);expect(after.firstAnswers).toEqual(before.firstAnswers);
});
test('이전 버전 기록은 과목 선택 이후에도 그대로 남는다',async({page})=>{
  await page.goto('/');await finishDaily(page);
  const before=await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)!);delete s.preferencesSet;delete s.settings.selectedSubjects;s.bankVersion='2026-10-04.1';localStorage.setItem(k,JSON.stringify(s));return s},key);
  await page.reload();await page.getByRole('button',{name:'게임 개발',exact:true}).click();await page.getByRole('checkbox',{name:'C#',exact:true}).uncheck();
  await page.getByRole('button',{name:'선택한 과목으로 시작하기',exact:true}).click();
  const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
  expect(after.sessions).toEqual(before.sessions);expect(after.firstAnswers).toEqual(before.firstAnswers);expect(after.bankVersion).not.toBe(before.bankVersion);
  expect(after.settings.selectedSubjects).toContain('cpp');expect(after.settings.selectedSubjects).not.toContain('csharp');
});
