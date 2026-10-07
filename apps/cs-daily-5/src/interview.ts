import content from './courses/game-client-14.json';
import type { Question, State } from './types';

export const interviewCourse = content;
export const interviewQuestions = content.questions as Question[];
export function interviewProgress(state: State) {
  const sessions = state.sessions.filter(s => s.kind === 'daily' && s.settings.courseId === 'game-client-14');
  const completed = new Set(sessions.filter(s => s.entries.every(e => !!s.answers[e.questionId])).map(s => s.interviewDay));
  const nextDay = content.days.find(d => !completed.has(d.day))?.day;
  return { completed, nextDay, sessions };
}
