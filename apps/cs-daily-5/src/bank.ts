import type { Question } from './types';

const files = import.meta.glob('./content/*.json', { eager: true, import: 'default' });
export const bank = Object.values(files).flat() as Question[];
export const questionById = Object.fromEntries(bank.map(q => [q.id, q])) as Record<string, Question>;
export const BANK_VERSION = '2026-10-06.2';
