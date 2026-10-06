export type Difficulty = 'easy' | 'medium' | 'hard';
export const levels: Difficulty[] = ['easy', 'medium', 'hard'];
export const levelLabel: Record<Difficulty, string> = { easy: '쉬움', medium: '중간', hard: '어려움' };
export interface Question {
  id: string;
  subject: string;
  difficulty: Difficulty;
  topic: string;
  prompt: string;
  choices: { id: string; text: string; explanation: string }[];
  correctChoiceId: string;
  explanation: string;
  environment: string;
  sources: { title: string; url: string }[];
  review: { status: 'source-checked'; date: string; method: string };
  code?: string;
  diagram?: 'queue' | 'pipeline' | 'layers';
  area?: 'rendering' | 'engine';
  active?: boolean;
  kind?: 'concept' | 'fill-blank' | 'output' | 'debug';
  language?: string;
  exam?: 'engineer-practice';
}
export interface Settings { mode: 'focus' | 'random'; subject: string; startLevel: Difficulty; selectedSubjects?: string[] }
export interface Answer { choiceId: string; correct: boolean; at: string }
export interface Entry { questionId: string; review: boolean }
export interface Session {
  id: string;
  date: string;
  kind: 'daily' | 'bonus';
  settings: Settings;
  entries: Entry[];
  answers: Record<string, Answer>;
  rewardGranted?: boolean;
}
export interface State {
  schemaVersion: 1;
  bankVersion: string;
  settings: Settings;
  sessions: Session[];
  firstAnswers: Record<string, Answer>;
  mistakes: Record<string, { lastReviewedAt?: string; solved: boolean }>;
  subjectLevels: Record<string, Difficulty>;
  preferencesSet?: boolean;
}
