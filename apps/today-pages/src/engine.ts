import type { Book, ReadingEntry, ReadingRound, State } from './types';

export const initialState = (): State => ({ schemaVersion: 2, books: [], rounds: [], entries: [], settings: { dailyGoal: 10 }, timer: null });
const fail = (message: string): never => { throw new Error(message); };
export const integer = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
export const validGoal = (n: unknown): n is number | null => n === null || (integer(n) && n > 0);
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const koreanDate = (date = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function weekDates(today: string): string[] {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
}
export const entriesFor = (state: State, roundId: string): ReadingEntry[] => state.entries.filter(e => e.roundId === roundId).sort((a, b) => a.date.localeCompare(b.date));
export const currentPage = (state: State, round: ReadingRound): number => entriesFor(state, round.id).at(-1)?.page ?? round.initialPage;
export const roundPages = (state: State, round: ReadingRound): number => currentPage(state, round) - round.initialPage;
export function entryPages(state: State, entry: ReadingEntry): number {
  const round = state.rounds.find(r => r.id === entry.roundId)!;
  const previous = entriesFor(state, round.id).filter(e => e.date < entry.date).at(-1);
  return entry.page - (previous?.page ?? round.initialPage);
}
export function weekStats(state: State, today: string) {
  const dates = weekDates(today);
  const entries = state.entries.filter(e => dates.includes(e.date) && (entryPages(state, e) > 0 || e.readingSeconds > 0));
  return { dates, days: new Set(entries.map(e => e.date)), pages: entries.reduce((sum, e) => sum + entryPages(state, e), 0), seconds: entries.reduce((sum, e) => sum + e.readingSeconds, 0) };
}
export const roundSeconds = (state: State, roundId: string): number => entriesFor(state, roundId).reduce((sum, e) => sum + e.readingSeconds, 0);
export function formatDuration(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60), rest = value % 60;
  return [hours ? `${hours}시간` : '', minutes ? `${minutes}분` : '', rest || !value ? `${rest}초` : ''].filter(Boolean).join(' ');
}
export function formatReadingMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return seconds <= 3600 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}
export function monthSummary(state: State, month: string) {
  const grouped = new Map<string, ReadingEntry[]>();
  for (const entry of state.entries.filter(e => e.date.startsWith(month))) {
    const bookId = state.rounds.find(r => r.id === entry.roundId)!.bookId;
    grouped.set(bookId, [...(grouped.get(bookId) ?? []), entry]);
  }
  const books = [...grouped].map(([bookId, entries]) => {
    const latest = entries.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
    return { book: state.books.find(b => b.id === bookId)!, latest, pages: entries.reduce((sum, entry) => sum + entryPages(state, entry), 0), seconds: entries.reduce((sum, entry) => sum + entry.readingSeconds, 0) };
  }).sort((a, b) => b.latest.date.localeCompare(a.latest.date) || b.latest.updatedAt.localeCompare(a.latest.updatedAt));
  return { books, pages: books.reduce((sum, book) => sum + book.pages, 0), seconds: books.reduce((sum, book) => sum + book.seconds, 0) };
}
export function monthDates(month: string): string[] {
  const first = `${month}-01`;
  const start = weekDates(first)[0];
  const last = new Date(`${first}T00:00:00Z`); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  const length = Math.ceil((last.getTime() - Date.parse(`${start}T00:00:00Z`) + 86400000) / 604800000) * 7;
  return Array.from({ length }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
}
export const representative = (state: State): ReadingRound | undefined => state.rounds.filter(r => r.status === 'reading').sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt)).at(0);
export function remaining(state: State, round: ReadingRound) {
  const book = state.books.find(b => b.id === round.bookId)!;
  if (book.totalPages === undefined) return null;
  const pages = book.totalPages - currentPage(state, round);
  return { pages, sessions: round.dailyGoal ? Math.ceil(pages / round.dailyGoal) : null };
}
export function addBook(state: State, book: Book, round: ReadingRound): State {
  if (!book.title.trim()) fail('책 제목을 입력해 주세요.');
  if (book.totalPages !== undefined && (!integer(book.totalPages) || book.totalPages === 0)) fail('전체 쪽수는 1 이상의 정수로 입력해 주세요.');
  if (!integer(round.initialPage) || (book.totalPages !== undefined && round.initialPage > book.totalPages)) fail('이미 읽은 페이지는 0부터 전체 쪽수 사이로 입력해 주세요.');
  if (state.books.some(b => b.id === book.id || (book.isbn && b.isbn === book.isbn))) fail('이미 서재에 있는 책이에요.');
  const next = { ...state, books: [...state.books, { ...book, title: book.title.trim() }], rounds: [...state.rounds, round] };
  return validateState(next);
}
export function saveEntry(state: State, roundId: string, date: string, page: number, note: string, today: string, now: string, id: string, timerId?: string): State {
  const round = state.rounds.find(r => r.id === roundId) ?? fail('독서 기록을 찾을 수 없어요.');
  if (round.status === 'completed') fail('완독한 회차는 수정할 수 없어요. 완독 취소 후 수정해 주세요.');
  if (state.timer?.roundId === roundId && state.timer.id !== timerId) fail('이 책의 타이머를 먼저 마치고 기록해 주세요.');
  if (!validDate(date) || date < round.startedOn || date > today) fail('읽기 시작일부터 오늘까지 기록할 수 있어요.');
  if (!integer(page)) fail('페이지는 0 이상의 정수로 입력해 주세요.');
  const book = state.books.find(b => b.id === round.bookId)!;
  const entries = entriesFor(state, roundId);
  const previous = entries.filter(e => e.date < date).at(-1)?.page ?? round.initialPage;
  const following = entries.find(e => e.date > date)?.page ?? book.totalPages ?? Number.MAX_SAFE_INTEGER;
  if (page < previous || page > following) fail(`앞뒤 기록에 맞게 ${previous}~${following === Number.MAX_SAFE_INTEGER ? '이후' : following}쪽으로 입력해 주세요. 페이지 정정은 기록 수정에서 할 수 있어요.`);
  const old = entries.find(e => e.date === date);
  const entry = { id: old?.id ?? id, roundId, date, page, note, updatedAt: now, readingSeconds: old?.readingSeconds ?? 0 };
  return validateState({ ...state, entries: [...state.entries.filter(e => e.id !== old?.id), entry], rounds: state.rounds.map(r => r.id === roundId ? { ...r, lastRecordedAt: now } : r) });
}
export function deleteEntry(state: State, id: string): State {
  const entry = state.entries.find(e => e.id === id) ?? fail('기록을 찾을 수 없어요.');
  if (state.rounds.find(r => r.id === entry.roundId)?.status === 'completed') fail('완독 취소 후 기록을 수정해 주세요.');
  if (state.timer?.roundId === entry.roundId) fail('타이머를 먼저 마치고 기록을 수정해 주세요.');
  return { ...state, entries: state.entries.filter(e => e.id !== id) };
}
export function changeRound(state: State, id: string, patch: Partial<Pick<ReadingRound, 'status' | 'dailyGoal' | 'review' | 'completedOn'>>): State {
  if (patch.status && state.timer?.roundId === id) fail('이 책의 타이머를 먼저 마쳐 주세요.');
  return validateState({ ...state, rounds: state.rounds.map(r => r.id === id ? { ...r, ...patch } : r) });
}
export function reread(state: State, round: ReadingRound): State {
  if (state.rounds.some(r => r.bookId === round.bookId && r.status !== 'completed')) fail('진행 중인 회차가 있어요. 기존 회차에서 이어 읽어 주세요.');
  return validateState({ ...state, rounds: [...state.rounds, round] });
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const optionalText = (value: unknown) => value === undefined || text(value);
const stamp = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const safeURL = (value: unknown) => value === undefined || (text(value) && /^https:\/\//.test(value));
const unique = (values: string[]) => new Set(values).size === values.length;
export function validateState(value: unknown): State {
  const invalid = () => fail('기록 형식이나 버전을 확인할 수 없어요. 기존 기록은 변경하지 않았어요.');
  if (!record(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !Array.isArray(value.books) || !Array.isArray(value.rounds) || !Array.isArray(value.entries) || !record(value.settings) || !validGoal(value.settings.dailyGoal)) return invalid();
  const legacy = value.schemaVersion === 1;
  for (const b of value.books) {
    if (!record(b) || !text(b.id) || !b.id || !text(b.title) || !b.title.trim() || !Array.isArray(b.authors) || !b.authors.every(text) || !optionalText(b.isbn) || !safeURL(b.thumbnail) || !safeURL(b.sourceUrl) || !(b.totalPages === undefined || (integer(b.totalPages) && b.totalPages > 0))) return invalid();
  }
  const state = value as unknown as State;
  if (!unique(state.books.map(b => b.id)) || !unique(state.books.filter(b => b.isbn).map(b => b.isbn!))) return invalid();
  for (const r of value.rounds) {
    if (!record(r) || !text(r.id) || !r.id || !validDate(r.startedOn) || !integer(r.initialPage) || !validGoal(r.dailyGoal) || !stamp(r.lastRecordedAt) || !['reading', 'paused', 'completed'].includes(String(r.status)) || !optionalText(r.review)) return invalid();
    const book = state.books.find(b => b.id === r.bookId);
    if (!book || (book.totalPages !== undefined && r.initialPage > book.totalPages)) return invalid();
    if (r.status === 'completed' ? !validDate(r.completedOn) || r.completedOn < r.startedOn : r.completedOn !== undefined) return invalid();
  }
  if (!unique(state.rounds.map(r => r.id)) || !unique(state.rounds.filter(r => r.status !== 'completed').map(r => r.bookId))) return invalid();
  for (const e of value.entries) {
    if (!record(e) || !text(e.id) || !e.id || !validDate(e.date) || !integer(e.page) || !text(e.note) || !stamp(e.updatedAt)) return invalid();
    if (!legacy && !integer(e.readingSeconds)) return invalid();
    const round = state.rounds.find(r => r.id === e.roundId);
    if (!round || e.date < round.startedOn || (round.completedOn && e.date > round.completedOn)) return invalid();
  }
  const timer = legacy ? null : value.timer;
  if (timer !== null) {
    if (!record(timer) || !text(timer.id) || !timer.id || !validDate(timer.date) || !integer(timer.startedPage) || !integer(timer.elapsedMs)) return invalid();
    const round = state.rounds.find(r => r.id === timer.roundId);
    if (!round || round.status !== 'reading' || timer.date < round.startedOn || timer.startedPage !== currentPage(state, round)) return invalid();
  }
  if (!unique(state.entries.map(e => e.id)) || !unique(state.entries.map(e => `${e.roundId}:${e.date}`))) return invalid();
  for (const round of state.rounds) {
    let page = round.initialPage;
    const total = state.books.find(b => b.id === round.bookId)!.totalPages;
    for (const entry of entriesFor(state, round.id)) {
      if (entry.page < page || (total !== undefined && entry.page > total)) return invalid();
      page = entry.page;
    }
  }
  // 복원 파일의 알 수 없는 속성은 다음 저장으로 전달하지 않습니다.
  return {
    schemaVersion: 2,
    books: state.books.map(b => ({ id: b.id, title: b.title, authors: [...b.authors], isbn: b.isbn, thumbnail: b.thumbnail, sourceUrl: b.sourceUrl, totalPages: b.totalPages })),
    rounds: state.rounds.map(r => ({ id: r.id, bookId: r.bookId, startedOn: r.startedOn, initialPage: r.initialPage, status: r.status, dailyGoal: r.dailyGoal, completedOn: r.completedOn, review: r.review, lastRecordedAt: r.lastRecordedAt })),
    entries: state.entries.map(e => ({ id: e.id, roundId: e.roundId, date: e.date, page: e.page, note: e.note, updatedAt: e.updatedAt, readingSeconds: legacy ? 0 : e.readingSeconds })),
    settings: { dailyGoal: state.settings.dailyGoal },
    timer: timer === null ? null : { id: timer.id as string, roundId: timer.roundId as string, date: timer.date as string, startedPage: timer.startedPage as number, elapsedMs: timer.elapsedMs as number },
  };
}

export function startTimer(state: State, roundId: string, date: string, timerId: string): State {
  if (state.timer) fail('진행 중인 타이머를 먼저 마쳐 주세요.');
  const round = state.rounds.find(r => r.id === roundId) ?? fail('책을 찾을 수 없어요.');
  if (round.status !== 'reading' || date < round.startedOn || !validDate(date)) fail('읽는 중인 책에서 타이머를 시작해 주세요.');
  return validateState({ ...state, timer: { id: timerId, roundId, date, startedPage: currentPage(state, round), elapsedMs: 0 } });
}
export function checkpointTimer(state: State, timerId: string, elapsedMs: number): State {
  const timer = state.timer ?? fail('측정 중인 타이머를 찾을 수 없어요.');
  if (timer.id !== timerId) fail('측정 중인 타이머를 찾을 수 없어요.');
  if (!integer(elapsedMs) || elapsedMs < timer.elapsedMs) fail('측정 시간을 확인해 주세요.');
  return validateState({ ...state, timer: { ...timer, elapsedMs } });
}
export function finishTimer(state: State, timerId: string, elapsedMs: number, page: number, note: string, today: string, now: string, entryId: string): State {
  const timer = state.timer ?? fail('이미 저장했거나 종료한 타이머예요.');
  if (timer.id !== timerId) fail('이미 저장했거나 종료한 타이머예요.');
  if (page < timer.startedPage) fail('타이머를 시작한 페이지보다 앞선 쪽수로 저장할 수 없어요.');
  const checked = checkpointTimer(state, timerId, elapsedMs);
  // 페이지와 시간을 하나의 스냅샷으로 저장해 재시도 시 중복 합산을 막습니다.
  const next = saveEntry({ ...checked, timer: null }, timer.roundId, timer.date, page, note, today, now, entryId);
  return validateState({ ...next, entries: next.entries.map(e => e.roundId === timer.roundId && e.date === timer.date ? { ...e, readingSeconds: e.readingSeconds + Math.floor(elapsedMs / 1000) } : e) });
}
