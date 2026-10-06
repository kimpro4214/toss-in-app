import { expect, it } from 'vitest';
import { bank, BANK_VERSION } from '../src/bank';
import { initialState, updateSettings, createDailySession, submitAnswer, selectEntries, bonusEntries, grantBonus } from '../src/engine';
import { eligibleQuestions, studyTracks } from '../src/preferences';
import type { State } from '../src/types';

function selected(ids: string[]) {
  return updateSettings(initialState(BANK_VERSION), { mode: 'random', subject: ids[0], startLevel: 'easy', selectedSubjects: ids });
}
function finish(state: State, sessionId: string) {
  for (const entry of state.sessions.find(s => s.id === sessionId)!.entries) {
    const q = bank.find(q => q.id === entry.questionId)!;
    state = submitAnswer(state, bank, sessionId, q.id, q.correctChoiceId);
  }
  return state;
}
const question = (id: string) => bank.find(q => q.id === id)!;

it('C++만 골라도 중복 없이 5문제와 추가 3문제를 제공한다', () => {
  const a = createDailySession(selected(['cpp']), bank, '2026-10-06', () => .9);
  expect(new Set(a.session.entries.map(e => e.questionId)).size).toBe(5);
  expect(a.session.entries.every(e => question(e.questionId).subject === 'cpp')).toBe(true);
  const state = finish(a.state, a.session.id);
  const bonus = bonusEntries(state, bank, state.sessions[0], () => .1);
  expect(bonus).toHaveLength(3);
  expect(bonus.every(e => question(e.questionId).subject === 'cpp' && !state.firstAnswers[e.questionId])).toBe(true);
});
it('선택한 다섯 과목이 있으면 과목을 중복 배정하지 않는다', () => {
  const ids = ['cpp', 'architecture', 'os', 'gof', 'oop'];
  const entries = selectEntries(selected(ids), bank, 5);
  expect(new Set(entries.map(e => question(e.questionId).subject))).toEqual(new Set(ids));
});
it('알고리즘을 골라도 공부하지 않는 C++ 코드는 제외한다', () => {
  const scope = eligibleQuestions(selected(['python', 'algorithms']).settings, bank);
  expect(scope.some(q => q.subject === 'algorithms')).toBe(true);
  expect(scope.some(q => q.language === 'cpp')).toBe(false);
  expect(eligibleQuestions(selected(['cpp', 'algorithms']).settings, bank).some(q => q.subject === 'algorithms' && q.language === 'cpp')).toBe(true);
});
it('소진 후 복습과 진행 중인 다음 날 세트도 선택 범위 안에 있다', () => {
  const state = selected(['cpp']);
  for (const q of bank.filter(q => q.subject === 'cpp')) state.firstAnswers[q.id] = { choiceId: q.correctChoiceId, correct: true, at: '2026-10-05T00:00:00Z' };
  const a = createDailySession(state, bank, '2026-10-06');
  const b = createDailySession(a.state, bank, '2026-10-07');
  expect([...a.session.entries, ...b.session.entries].every(e => e.review && question(e.questionId).subject === 'cpp')).toBe(true);
  expect(new Set([...a.session.entries, ...b.session.entries].map(e => e.questionId)).size).toBe(10);
});
it('선택을 바꿔도 기존 세트와 보상은 시작 당시 범위를 유지한다', () => {
  const a = createDailySession(selected(['cpp']), bank, '2026-10-06');
  const finished = finish(a.state, a.session.id);
  const changed = updateSettings(finished, { ...finished.settings, selectedSubjects: ['java'], subject: 'java' });
  expect(createDailySession(changed, bank, '2026-10-06').session).toEqual(finished.sessions[0]);
  const entries = bonusEntries(changed, bank, changed.sessions[0]);
  expect(entries.every(e => question(e.questionId).subject === 'cpp')).toBe(true);
  expect(() => grantBonus(changed, a.session.id, ['java-001', 'java-002', 'java-003'].map(questionId => ({ questionId, review: false })), bank)).toThrow();
  expect(grantBonus(changed, a.session.id, entries, bank).sessions[1].entries).toEqual(entries);
  expect(createDailySession(changed, bank, '2026-10-07').session.entries.every(e => question(e.questionId).subject === 'java')).toBe(true);
});
it('C++ 단계는 늘어난 40문제를 제출한 뒤에만 다음 단계로 간다', () => {
  let state = selected(['cpp']);
  for (let day = 1; day <= 8; day++) {
    const a = createDailySession(state, bank, `2026-11-${String(day).padStart(2, '0')}`, () => 0);
    state = finish(a.state, a.session.id);
    expect(state.subjectLevels.cpp).toBe(day < 8 ? 'easy' : 'medium');
  }
  expect(selectEntries(state, bank, 5).every(e => question(e.questionId).difficulty === 'medium')).toBe(true);
});
it('기존 단계 기록이 높아도 새로 추가한 이전 단계 문제를 빠뜨리지 않는다', () => {
  const state = selected(['cpp']);
  state.subjectLevels.cpp = 'hard';
  for (const q of bank.filter(q => q.subject === 'cpp' && Number(q.id.slice(-3)) <= 30)) state.firstAnswers[q.id] = { choiceId: q.correctChoiceId, correct: true, at: '2026-10-05T00:00:00Z' };
  const entries = selectEntries(state, bank, 5);
  expect(entries.every(e => question(e.questionId).difficulty === 'easy' && !state.firstAnswers[e.questionId])).toBe(true);
});
it('선택하지 않은 언어 코드를 제외한 알고리즘 단계도 완료할 수 있다', () => {
  let state = selected(['algorithms']);
  const qs = eligibleQuestions(state.settings, bank).filter(q => q.difficulty === 'easy');
  for (const q of qs.slice(0, -1)) state.firstAnswers[q.id] = { choiceId: q.correctChoiceId, correct: true, at: '2026-10-06T00:00:00Z' };
  const a = createDailySession(state, bank, '2026-10-06', () => 0);
  const q = qs.at(-1)!;
  state = submitAnswer(a.state, bank, a.session.id, q.id, q.correctChoiceId);
  expect(state.subjectLevels.algorithms).toBe('medium');
});
it('잘못된 선택과 빈 선택은 거부하며 분야별 기본 언어는 구분한다', () => {
  for (const ids of [[], ['cpp', 'cpp'], ['invalid']]) expect(() => selected(ids)).toThrow();
  const front = studyTracks.find(t => t.id === 'frontend')!.subjects;
  expect(front).toContain('javascript'); expect(front).toContain('typescript');
  expect(front).not.toContain('java'); expect(front).not.toContain('cpp');
  expect(studyTracks.find(t => t.id === 'game')!.subjects).toEqual(expect.arrayContaining(['cpp', 'csharp', 'graphics']));
});
