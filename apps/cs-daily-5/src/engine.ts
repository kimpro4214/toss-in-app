import { levels, type State, type Settings, type Question, type Session, type Entry } from './types';
import { subjects } from './subjects';

export function koreaDate(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function initialState(bankVersion: string): State {
  return { schemaVersion: 1, bankVersion, settings: { mode: 'random', subject: 'architecture', startLevel: 'easy' }, sessions: [], firstAnswers: {}, mistakes: {}, subjectLevels: {} };
}
export const isComplete = (s: Session) => s.entries.every(e => !!s.answers[e.questionId]);
export const score = (s: Session) => Object.values(s.answers).filter(a => a.correct).length;
export function updateSettings(state: State, settings: Settings): State {
  return { ...state, settings, subjectLevels: settings.startLevel === state.settings.startLevel ? state.subjectLevels : {} };
}
function available(state: State, questions: Question[], subject: string, excluded: Set<string>, planned: Set<string>) {
  let level = Math.max(levels.indexOf(state.settings.startLevel), levels.indexOf(state.subjectLevels[subject] ?? state.settings.startLevel));
  for (; level < levels.length; level++) {
    const tier = questions.filter(q => q.subject === subject && q.difficulty === levels[level]);
    const unanswered = tier.filter(q => !state.firstAnswers[q.id] && !planned.has(q.id) && !excluded.has(q.id));
    if (unanswered.length) return unanswered;
  }
  return [];
}
function sample<T>(list: T[], random: () => number): T { return list[Math.min(list.length - 1, Math.floor(random() * list.length))]; }
export function selectEntries(state: State, questions: Question[], count: number, onlyNew = false, random = Math.random): Entry[] {
  questions = questions.filter(q => q.active !== false);
  const reserved = new Set(state.sessions.flatMap(s => s.entries.filter(e => !s.answers[e.questionId]).map(e => e.questionId)));
  const planned = new Set<string>();
  const chosenSubjects = new Set<string>();
  const result: Entry[] = [];
  while (result.length < count) {
    const ids = state.settings.mode === 'focus' ? [state.settings.subject] : subjects.map(s => s.id).filter(id => !chosenSubjects.has(id));
    const candidates = ids.map(id => ({ id, pool: available(state, questions, id, reserved, planned) })).filter(c => c.pool.length);
    if (!candidates.length) break;
    const subject = sample(candidates, random);
    const q = sample(subject.pool, random);
    result.push({ questionId: q.id, review: false });
    planned.add(q.id);
    if (state.settings.mode === 'random') chosenSubjects.add(q.subject);
  }
  if (!onlyNew) {
    const reviews = questions.filter(q => state.firstAnswers[q.id] && !reserved.has(q.id) && !planned.has(q.id) && (state.settings.mode === 'random' ? !chosenSubjects.has(q.subject) : q.subject === state.settings.subject));
    reviews.sort((a, b) => {
      const am = state.mistakes[a.id], bm = state.mistakes[b.id];
      return Number(!!bm && !bm.solved) - Number(!!am && !am.solved) || (am?.lastReviewedAt ?? state.firstAnswers[a.id].at).localeCompare(bm?.lastReviewedAt ?? state.firstAnswers[b.id].at);
    });
    for (const q of reviews) {
      if (result.length === count) break;
      if (state.settings.mode === 'random' && chosenSubjects.has(q.subject)) continue;
      result.push({ questionId: q.id, review: true }); chosenSubjects.add(q.subject);
    }
  }
  return result;
}
export function createDailySession(state: State, questions: Question[], date = koreaDate(), random = Math.random): { state: State; session: Session } {
  const existing = state.sessions.find(s => s.date === date && s.kind === 'daily');
  if (existing) return { state, session: existing };
  const entries = selectEntries(state, questions, 5, false, random);
  if (entries.length !== 5) throw new Error('배정할 문제가 부족합니다. 먼저 진행 중인 학습을 완료해 주세요.');
  const session: Session = { id: `daily:${date}`, date, kind: 'daily', settings: { ...state.settings }, entries, answers: {} };
  return { state: { ...state, sessions: [...state.sessions, session] }, session };
}
export function submitAnswer(state: State, questions: Question[], sessionId: string, questionId: string, choiceId: string, at = new Date().toISOString()): State {
  const session = state.sessions.find(s => s.id === sessionId);
  const q = questions.find(q => q.id === questionId);
  if (!session || !q || !session.entries.some(e => e.questionId === questionId) || !q.choices.some(c => c.id === choiceId)) throw new Error('문제 또는 답을 확인해 주세요.');
  if (session.answers[questionId]) return state;
  const answer = { choiceId, correct: choiceId === q.correctChoiceId, at };
  const mistakes = { ...state.mistakes };
  if (!answer.correct) mistakes[q.id] = { solved: false, lastReviewedAt: at };
  else if (mistakes[q.id]) mistakes[q.id] = { solved: true, lastReviewedAt: at };
  const firstAnswers = state.firstAnswers[q.id] ? state.firstAnswers : { ...state.firstAnswers, [q.id]: answer };
  const subjectLevels = { ...state.subjectLevels };
  let i = levels.indexOf(subjectLevels[q.subject] ?? state.settings.startLevel);
  while (i < 2 && questions.filter(x => x.subject === q.subject && x.difficulty === levels[i]).every(x => !!firstAnswers[x.id])) i++;
  subjectLevels[q.subject] = levels[i];
  return { ...state, firstAnswers, mistakes, subjectLevels, sessions: state.sessions.map(s => s.id === sessionId ? { ...s, answers: { ...s.answers, [q.id]: answer } } : s) };
}
export function reviewAnswer(state: State, question: Question, choiceId: string, at = new Date().toISOString()): State {
  if (!question.choices.some(c => c.id === choiceId)) throw new Error('답을 확인해 주세요.');
  return { ...state, mistakes: { ...state.mistakes, [question.id]: { solved: choiceId === question.correctChoiceId, lastReviewedAt: at } } };
}
export function bonusEntries(state: State, questions: Question[], daily: Session, random = Math.random): Entry[] {
  if (!isComplete(daily) || daily.kind !== 'daily' || state.sessions.some(s => s.date === daily.date && s.kind === 'bonus')) return [];
  return selectEntries({ ...state, settings: daily.settings }, questions, 3, true, random);
}
export function grantBonus(state: State, dailyId: string, entries: Entry[], questions: Question[]): State {
  const daily = state.sessions.find(s => s.id === dailyId);
  if (!daily || !isComplete(daily) || daily.kind !== 'daily') throw new Error('기본 학습을 먼저 완료해 주세요.');
  if (state.sessions.some(s => s.date === daily.date && s.kind === 'bonus')) return state;
  const reserved = new Set(state.sessions.flatMap(s => s.entries.filter(e => !s.answers[e.questionId]).map(e => e.questionId)));
  if (entries.length !== 3 || new Set(entries.map(e => e.questionId)).size !== 3 || entries.some(e => e.review || state.firstAnswers[e.questionId] || reserved.has(e.questionId) || !questions.some(q => q.id === e.questionId))) throw new Error('추가 문제 배정을 확인해 주세요.');
  const bonus: Session = { id: `bonus:${daily.date}`, date: daily.date, kind: 'bonus', settings: daily.settings, entries, answers: {}, rewardGranted: true };
  return { ...state, sessions: [...state.sessions, bonus] };
}
