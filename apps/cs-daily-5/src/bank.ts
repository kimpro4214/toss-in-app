import type { Question } from './types';
import { interviewQuestions } from './interview';

const files = import.meta.glob('./content/*.json', { eager: true, import: 'default' });
export const bank = (Object.values(files).flat() as Question[]).filter(q => q.active === true && q.review.editorialVersion === 2);
const legacyFiles = import.meta.glob<Question[]>('./content-archive/*.json', { import: 'default' });
export const archivedQuestions: Question[] = [];
export const allQuestions = [...bank, ...interviewQuestions];
export const questionById = Object.fromEntries(allQuestions.map(q => [q.id, q])) as Record<string, Question>;
export const BANK_VERSION = '2026-10-16.2';

export async function loadQuestionHistory(ids: string[]): Promise<void> {
  const missing = ids.filter(id => !questionById[id]);
  const subjects = new Set(missing.map(id => id.match(/^([a-z]+)-\d{3}$/)?.[1]).filter(Boolean));
  const groups = await Promise.all([...subjects].map(subject => legacyFiles[`./content-archive/${subject}.json`]?.() ?? []));
  if (missing.some(id => /^interview-game-client-\d{2}-[1-5]$/.test(id))) {
    const content = await import('./courses/game-client-14-legacy.json');
    groups.push(content.default.questions as Question[]);
  }
  for (const group of groups) for (const question of group) {
    if (questionById[question.id]) continue;
    const archived = { ...question, active: false };
    archivedQuestions.push(archived); allQuestions.push(archived); questionById[archived.id] = archived;
  }
}
