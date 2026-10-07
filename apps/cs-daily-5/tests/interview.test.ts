import { describe, expect, it } from 'vitest';
import { bank, allQuestions, BANK_VERSION, questionById } from '../src/bank';
import { interviewProgress, interviewQuestions } from '../src/interview';
import { initialState, updateSettings, createDailySession, submitAnswer, bonusEntries, grantBonus, isComplete, selectEntries, reviewAnswer } from '../src/engine';
import type { State } from '../src/types';

const courseState = () => updateSettings(initialState(BANK_VERSION), { mode: 'random', subject: 'cpp', selectedSubjects: ['cpp'], startLevel: 'hard', courseId: 'game-client-14' });
function finish(state: State, id: string, correct = true) {
  for (const e of state.sessions.find(s => s.id === id)!.entries) {
    const q = questionById[e.questionId];
    state = submitAnswer(state, allQuestions, id, q.id, correct ? q.correctChoiceId : q.choices.find(c => c.id !== q.correctChoiceId)!.id);
  }
  return state;
}
describe('14일 면접 코스', () => {
  it('선택 난이도와 무관하게 14일의 고정 70문항을 순서대로 완료한다', () => {
    let state = courseState();
    const ids: string[] = [];
    for (let day = 1; day <= 14; day++) {
      const created = createDailySession(state, bank, `2026-10-${String(day).padStart(2, '0')}`);
      expect(created.session.interviewDay).toBe(day);
      expect(created.session.entries.map(e => e.questionId)).toEqual(interviewQuestions.filter(q => q.interview?.day === day).map(q => q.id));
      ids.push(...created.session.entries.map(e => e.questionId));
      state = finish(created.state, created.session.id);
    }
    expect(new Set(ids).size).toBe(70);
    expect(interviewProgress(state).completed.size).toBe(14);
    expect(interviewProgress(state).nextDay).toBeUndefined();
    expect(state.subjectLevels).toEqual({});
    expect(() => createDailySession(state, bank, '2026-10-15')).toThrow('완주');
    const normal = updateSettings(state, { ...state.settings, courseId: undefined });
    expect(createDailySession(normal, bank, '2026-10-15').session.entries.every(e => !questionById[e.questionId].interview)).toBe(true);
  });
  it('오늘 시작한 일반 세트를 교체하지 않고 다음 날짜에 코스를 시작한다', () => {
    const ordinary = createDailySession(initialState(BANK_VERSION), bank, '2026-10-01', () => 0);
    const selected = updateSettings(ordinary.state, { ...ordinary.state.settings, courseId: 'game-client-14' });
    expect(createDailySession(selected, bank, '2026-10-01').session).toEqual(ordinary.session);
    expect(createDailySession(selected, bank, '2026-10-02').session.interviewDay).toBe(1);
  });
  it('날짜가 바뀌어도 미완료 일차를 재배정하지 않고 복원해 이어간다', () => {
    const first = createDailySession(courseState(), bank, '2026-10-01');
    const q = questionById[first.session.entries[0].questionId];
    const answered = submitAnswer(first.state, allQuestions, first.session.id, q.id, q.correctChoiceId);
    const restored = JSON.parse(JSON.stringify(answered)) as State;
    const next = createDailySession(restored, bank, '2026-10-02');
    expect(next.session).toEqual(answered.sessions[0]);
    expect(next.state.sessions).toHaveLength(1);
    const finished = finish(next.state, next.session.id);
    expect(createDailySession(finished, bank, '2026-10-02').session.interviewDay).toBe(2);
  });
  it('중복 제출·오답 복습은 최초 코스 점수를 덮어쓰지 않는다', () => {
    const first = createDailySession(courseState(), bank, '2026-10-01');
    const state = finish(first.state, first.session.id, false);
    const q = questionById[first.session.entries[0].questionId];
    expect(submitAnswer(state, allQuestions, first.session.id, q.id, q.correctChoiceId)).toBe(state);
    const reviewed = reviewAnswer(state, q, q.correctChoiceId);
    expect(reviewed.sessions[0].answers).toEqual(state.sessions[0].answers);
    expect(reviewed.firstAnswers).toEqual(state.firstAnswers);
    expect(reviewed.mistakes[q.id].solved).toBe(true);
    expect(interviewProgress(reviewed).completed.size).toBe(1);
  });
  it('일반 출제와 광고 보상에 미래 코스 문제가 섞이지 않는다', () => {
    const ordinary = initialState(BANK_VERSION);
    expect(selectEntries(ordinary, allQuestions, 5).every(e => !questionById[e.questionId].interview)).toBe(true);
    const first = createDailySession(courseState(), bank, '2026-10-01');
    const state = finish(first.state, first.session.id);
    const daily = state.sessions[0];
    expect(isComplete(daily)).toBe(true);
    const extra = bonusEntries(state, allQuestions, daily);
    expect(extra).toHaveLength(3);
    expect(extra.every(e => !questionById[e.questionId].interview && questionById[e.questionId].subject === 'cpp')).toBe(true);
    const bonus = grantBonus(state, daily.id, extra, allQuestions);
    expect(interviewProgress(finish(bonus, bonus.sessions[1].id)).completed.size).toBe(1);
    expect(() => grantBonus(state, daily.id, interviewQuestions.slice(5, 8).map(q => ({ questionId: q.id, review: false })), allQuestions)).toThrow();
  });
});
