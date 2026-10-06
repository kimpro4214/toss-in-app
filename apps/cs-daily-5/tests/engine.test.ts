import { describe, expect, it } from 'vitest';
import { bank, BANK_VERSION } from '../src/bank';
import { initialState, updateSettings, createDailySession, submitAnswer, isComplete, score, koreaDate, reviewAnswer, bonusEntries, grantBonus, selectEntries } from '../src/engine';
import type { State } from '../src/types';
const fixed = () => .15;
function focus(level: 'easy'|'medium'|'hard' = 'easy') { const s = initialState(BANK_VERSION); return updateSettings(s,{mode:'focus',subject:'architecture',startLevel:level}); }
function finish(state: State, id: string, correct = true) {
  for (const e of state.sessions.find(s => s.id === id)!.entries) {
    const q = bank.find(q => q.id === e.questionId)!;
    state = submitAnswer(state,bank,id,q.id,correct ? q.correctChoiceId : q.choices.find(c => c.id !== q.correctChoiceId)!.id);
  }
  return state;
}
describe('출제와 진행', () => {
  it('870개의 실제 은행을 사용한다',()=>expect(bank).toHaveLength(870));
  it('랜덤은 서로 다른 5과목이고 쉬움으로 시작한다',()=>{
    const {session}=createDailySession(initialState(BANK_VERSION),bank,'2026-10-05',fixed);
    expect(new Set(session.entries.map(e=>bank.find(q=>q.id===e.questionId)!.subject)).size).toBe(5);
    expect(session.entries.every(e=>bank.find(q=>q.id===e.questionId)!.difficulty==='easy')).toBe(true);
  });
  it('집중은 선택 과목과 시작 난이도를 지킨다',()=>{
    for(const level of ['easy','medium','hard'] as const){
      const {session}=createDailySession(focus(level),bank,'2026-10-05',fixed);
      expect(session.entries.every(e=>{const q=bank.find(q=>q.id===e.questionId)!;return q.subject==='architecture'&&q.difficulty===level})).toBe(true);
    }
  });
  it('같은 날짜에는 설정 변경·재접속에도 세트가 고정된다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);
    const restored=JSON.parse(JSON.stringify(a.state)) as State;
    const changed=updateSettings(restored,{mode:'random',subject:'cpp',startLevel:'hard'});
    expect(createDailySession(changed,bank,'2026-10-05').session).toEqual(a.session);
  });
  it('한국 시간 자정 경계를 사용한다',()=>{
    expect(koreaDate(new Date('2026-10-05T14:59:59Z'))).toBe('2026-10-05');
    expect(koreaDate(new Date('2026-10-05T15:00:00Z'))).toBe('2026-10-06');
  });
  it('새 날짜는 미완료 문제를 재배정하지 않고 단계 부족은 다음 단계로 채운다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);
    const b=createDailySession(a.state,bank,'2026-10-06',fixed);
    const c=createDailySession(b.state,bank,'2026-10-07',fixed);
    const ids=[...a.session.entries,...b.session.entries,...c.session.entries].map(e=>e.questionId);
    expect(new Set(ids).size).toBe(15);
    expect(c.session.entries.every(e=>bank.find(q=>q.id===e.questionId)!.difficulty==='medium')).toBe(true);
    expect(c.state.sessions[0]).toEqual(a.session);
  });
  it('오답이어도 단계 10개를 제출하면 다음 단계로 간다',()=>{
    let s=focus();
    for(let i=0;i<2;i++){const a=createDailySession(s,bank,`2026-10-0${i+5}`,fixed);s=finish(a.state,a.session.id,false)}
    expect(s.subjectLevels.architecture).toBe('medium');
    expect(selectEntries(s,bank,5).every(e=>bank.find(q=>q.id===e.questionId)!.difficulty==='medium')).toBe(true);
    expect(Object.keys(s.mistakes)).toHaveLength(10);
  });
  it('시작 난이도 변경 후 옛 세트 제출이 새 설정을 덮어쓰지 않는다',()=>{
    const a=createDailySession(focus('hard'),bank,'2026-10-05',fixed);
    const s=finish(updateSettings(a.state,{...a.state.settings,startLevel:'easy'}),a.session.id);
    expect(s.subjectLevels.architecture).toBe('easy');
  });
  it('모두 소진되면 복습 표시로 5개를 제공하며 광고 새 문제는 없다',()=>{
    let s=focus();for(let i=0;i<6;i++){const a=createDailySession(s,bank,`2026-11-${i+10}`,fixed);s=finish(a.state,a.session.id)}
    const a=createDailySession(s,bank,'2026-12-01',fixed);
    expect(a.session.entries.every(e=>e.review)).toBe(true);
    const end=finish(a.state,a.session.id);expect(bonusEntries(end,bank,end.sessions.at(-1)!)).toEqual([]);
  });
  it('철회 문항은 보존할 수 있으나 새 출제에서 제외한다',()=>{
    const qs=bank.map(q=>q.id==='architecture-001'?{...q,active:false}:q);
    expect(selectEntries(focus(),qs,5,false,()=>0).some(e=>e.questionId==='architecture-001')).toBe(false);
  });
});
describe('제출·복습·보상',()=>{
  it('중복 제출은 점수와 최초 답을 유지한다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);const q=bank.find(q=>q.id===a.session.entries[0].questionId)!;
    const s=submitAnswer(a.state,bank,a.session.id,q.id,q.correctChoiceId);
    expect(submitAnswer(s,bank,a.session.id,q.id,q.choices.find(c=>c.id!==q.correctChoiceId)!.id)).toBe(s);
    expect(score(s.sessions[0])).toBe(1);
  });
  it('무료 복습은 최초 점수와 답을 바꾸지 않는다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);const s=finish(a.state,a.session.id,false);const q=bank.find(q=>q.id===a.session.entries[0].questionId)!;
    const reviewed=reviewAnswer(s,q,q.correctChoiceId);
    expect(reviewed.firstAnswers).toEqual(s.firstAnswers);expect(score(reviewed.sessions[0])).toBe(0);expect(reviewed.mistakes[q.id].solved).toBe(true);
  });
  it('유효하지 않은 문제·선택지는 거부한다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);
    expect(()=>submitAnswer(a.state,bank,a.session.id,'java-001','c0')).toThrow();
    expect(()=>submitAnswer(a.state,bank,a.session.id,a.session.entries[0].questionId,'invalid')).toThrow();
  });
  it('기본 완료 전에는 보상을 제공하지 않는다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);expect(bonusEntries(a.state,bank,a.session)).toEqual([]);expect(()=>grantBonus(a.state,a.session.id,[],bank)).toThrow();
  });
  it('보상은 중복되지 않으며 기본과 새 3문제가 겹치지 않는다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);const s=finish(a.state,a.session.id);expect(isComplete(s.sessions[0])).toBe(true);
    const entries=bonusEntries(s,bank,s.sessions[0],fixed);expect(entries).toHaveLength(3);
    expect(entries.every(e=>!s.firstAnswers[e.questionId]&&!e.review)).toBe(true);
    const granted=grantBonus(s,a.session.id,entries,bank);expect(grantBonus(granted,a.session.id,entries,bank)).toBe(granted);
    expect(bonusEntries(granted,bank,granted.sessions[0])).toEqual([]);
    expect(JSON.parse(JSON.stringify(granted)).sessions[1].entries).toEqual(entries);
  });
  it('3개 미만의 새 문제가 남으면 광고를 사용할 수 없다',()=>{
    const a=createDailySession(focus('hard'),bank,'2026-10-05',fixed);const s=finish(a.state,a.session.id);
    const remain=bank.filter(q=>q.subject==='architecture'&&q.difficulty==='hard'&&!s.firstAnswers[q.id]);
    for(const q of remain.slice(0,3))s.firstAnswers[q.id]={choiceId:q.correctChoiceId,correct:true,at:'2026-10-05'};
    expect(bonusEntries(s,bank,s.sessions[0])).toHaveLength(2);
  });
  it('보상에 복습·중복·이미 제출된 ID를 넣지 못한다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);const s=finish(a.state,a.session.id);const entries=bonusEntries(s,bank,s.sessions[0],fixed);
    expect(()=>grantBonus(s,a.session.id,[entries[0],entries[0],entries[2]],bank)).toThrow();
    expect(()=>grantBonus(s,a.session.id,[a.session.entries[0],entries[1],entries[2]],bank)).toThrow();
    expect(()=>grantBonus(s,a.session.id,entries.map(e=>({...e,review:true})),bank)).toThrow();
  });
  it('설정 변경 중에도 추가 세트가 기본 세트의 시작 난이도보다 낮아지지 않는다',()=>{
    const a=createDailySession(focus('medium'),bank,'2026-10-05',fixed);
    const s=finish(updateSettings(a.state,{...a.state.settings,startLevel:'easy'}),a.session.id);
    expect(bonusEntries(s,bank,s.sessions[0],fixed).every(e=>bank.find(q=>q.id===e.questionId)!.difficulty==='medium')).toBe(true);
  });
  it('문제은행 버전 변경 후 ID 기반 최초 기록이 유지된다',()=>{
    const a=createDailySession(focus(),bank,'2026-10-05',fixed);const s=finish(a.state,a.session.id);const updated={...s,bankVersion:'2026-11-01.1'};
    const next=createDailySession(updated,[...bank].reverse(),'2026-10-06',fixed);
    expect(next.state.firstAnswers).toEqual(s.firstAnswers);
    expect(next.session.entries.every(e=>!s.firstAnswers[e.questionId])).toBe(true);
  });
});
