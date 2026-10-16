export interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn?: string;
  thumbnail?: string;
  sourceUrl?: string;
  totalPages?: number;
}
export interface ReadingRound {
  id: string;
  bookId: string;
  startedOn: string;
  initialPage: number;
  status: 'reading' | 'paused' | 'completed';
  dailyGoal: number | null;
  completedOn?: string;
  review?: string;
  lastRecordedAt: string;
}
export interface ReadingEntry {
  id: string;
  roundId: string;
  date: string;
  page: number;
  note: string;
  updatedAt: string;
  readingSeconds: number;
}
export interface ReadingTimer {
  id: string;
  roundId: string;
  date: string;
  startedPage: number;
  elapsedMs: number;
}
export interface State {
  schemaVersion: 2;
  books: Book[];
  rounds: ReadingRound[];
  entries: ReadingEntry[];
  settings: { dailyGoal: number | null };
  timer: ReadingTimer | null;
}
export interface BookResult { title: string; authors: string[]; isbn?: string; thumbnail?: string; sourceUrl?: string }
export interface SearchResult { books: BookResult[]; hasMore: boolean }
export interface Backup { app: 'today-pages'; schemaVersion: 2; exportedAt: string; state: State }
