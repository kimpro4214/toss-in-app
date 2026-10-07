import { subjects } from './subjects';
import type { Question, Settings } from './types';

export const languageIds = subjects.filter(s => s.group === '언어').map(s => s.id);
const core = subjects.filter(s => s.group === 'CS' || s.group === '설계').map(s => s.id);
export const studyTracks = [
  { id: 'frontend', name: '프론트엔드', subjects: [...core, 'javascript', 'typescript'] },
  { id: 'backend', name: '백엔드', subjects: [...core, 'java', 'kotlin', 'python', 'csharp'] },
  { id: 'game', name: '게임 개발', subjects: [...core, 'cpp', 'csharp', 'graphics'] },
  { id: 'custom', name: '직접 선택', subjects: [] as string[] },
  { id: 'all', name: '전체 과목', subjects: subjects.map(s => s.id) },
];
export function selectedSubjects(settings: Settings): string[] {
  return settings.selectedSubjects ?? subjects.map(s => s.id);
}
export function eligibleQuestions(settings: Settings, questions: Question[]): Question[] {
  const selected = selectedSubjects(settings);
  return questions.filter(q => q.active !== false && !q.interview
    && (settings.mode === 'focus' ? q.subject === settings.subject : selected.includes(q.subject))
    && (!q.language || !languageIds.includes(q.language) || selected.includes(q.language)));
}
