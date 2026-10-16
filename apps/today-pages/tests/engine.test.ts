import { describe, expect, it } from 'vitest';
import { addBook, changeRound, currentPage, deleteEntry, entryPages, initialState, koreanDate, remaining, representative, reread, roundPages, saveEntry, validateState, weekStats } from '../src/engine';
import { backupJSON, parseBackup, stateStore, StateSession } from '../src/storage';
import type { State } from '../src/types';

const now = '2026-10-16T10:00:00.000Z';
function fixture(): State { return addBook(initialState(), { id: 'book', title: '한글 책', authors: ['작가'], totalPages: 100 }, { id: 'round', bookId: 'book', startedOn: '2026-10-12', initialPage: 42, status: 'reading', dailyGoal: 10, lastRecordedAt: now }); }
const save = (s: State, date: string, page: number) => saveEntry(s, 'round', date, page, '생각', '2026-10-16', now, `entry-${date}`);

describe('독서 분량과 날짜', () => {
  it('시작 전 읽은 페이지는 제외하고 같은 날 도달 페이지를 교체한다', () => {
    let s = save(fixture(), '2026-10-16', 57);
    s = save(s, '2026-10-16', 65);
    s = save(s, '2026-10-16', 65);
    expect(s.entries).toHaveLength(1);
    expect(roundPages(s, s.rounds[0])).toBe(23);
    expect(weekStats(s, '2026-10-16').pages).toBe(23);
  });
  it('과거 기록 수정과 삭제 후 앞뒤 분량을 다시 계산한다', () => {
    let s = save(save(fixture(), '2026-10-12', 50), '2026-10-16', 65);
    s = save(s, '2026-10-12', 55);
    expect(s.entries.map(e => entryPages(s, e))).toEqual([10, 13]);
    s = deleteEntry(s, 'entry-2026-10-12');
    expect(entryPages(s, s.entries[0])).toBe(23);
    expect(() => save(s, '2026-10-13', 66)).toThrow('앞뒤 기록');
    expect(() => save(s, '2026-10-16', 41)).toThrow();
  });
  it('날짜와 정수, 전체 페이지 범위를 검증한다', () => {
    for (const date of ['2026-10-11', '2026-10-17', '2026-02-30']) expect(() => save(fixture(), date, 50)).toThrow();
    for (const page of [-1, 1.5, NaN, 101, Infinity]) expect(() => save(fixture(), '2026-10-16', page)).toThrow();
  });
  it('한국 자정과 월요일 시작을 사용하고 0쪽 기록은 읽은 날로 세지 않는다', () => {
    expect(koreanDate(new Date('2026-10-15T15:00:00Z'))).toBe('2026-10-16');
    const stats = weekStats(save(fixture(), '2026-10-16', 42), '2026-10-18');
    expect(stats.dates[0]).toBe('2026-10-12'); expect(stats.days.size).toBe(0);
  });
  it('전체 쪽수와 목표가 있을 때만 남은 독서 횟수를 계산한다', () => {
    const s = save(fixture(), '2026-10-16', 65);
    expect(remaining(s, s.rounds[0])).toEqual({ pages: 35, sessions: 4 });
    expect(remaining(s, { ...s.rounds[0], dailyGoal: null })?.sessions).toBeNull();
    s.books[0].totalPages = undefined; expect(remaining(s, s.rounds[0])).toBeNull();
  });
  it('완독은 페이지를 채우지 않으며 재독은 독립 회차를 만든다', () => {
    let s = save(fixture(), '2026-10-16', 65);
    s = changeRound(s, 'round', { status: 'completed', completedOn: '2026-10-16', review: '좋았다' });
    expect(currentPage(s, s.rounds[0])).toBe(65);
    expect(() => save(s, '2026-10-16', 70)).toThrow('완독');
    s = reread(s, { ...s.rounds[0], id: 'reread', initialPage: 0, startedOn: '2026-10-16', status: 'reading', completedOn: undefined, review: undefined });
    expect(s.rounds).toHaveLength(2); expect(roundPages(s, s.rounds[1])).toBe(0); expect(representative(s)?.id).toBe('reread');
    expect(() => reread(s, { ...s.rounds[1], id: 'again' })).toThrow('진행 중');
  });
});
describe('저장과 백업', () => {
  it('한글 백업 왕복과 버전·참조·순서 검증', () => {
    const s = save(fixture(), '2026-10-16', 57);
    expect(parseBackup(backupJSON(s))).toEqual(s);
    for (const mutate of [
      (x: any) => { x.schemaVersion = 99; },
      (x: any) => { x.entries[0].roundId = 'missing'; },
      (x: any) => { x.entries.push({ ...x.entries[0], id: 'duplicate' }); },
      (x: any) => { x.books[0].thumbnail = 'javascript:alert(1)'; },
      (x: any) => { x.rounds[0].initialPage = 80; },
    ]) { const bad = JSON.parse(JSON.stringify(s)); mutate(bad); expect(() => validateState(bad)).toThrow(); }
  });
  it('저장 실패 시 상태를 유지하고 다음 저장은 다시 시도한다', async () => {
    let fail = true; let persisted = '';
    const session = new StateSession(fixture(), { load: async () => fixture(), save: async s => { if (fail) throw new Error('disk'); persisted = JSON.stringify(s); } });
    await expect(session.commit(s => save(s, '2026-10-16', 57))).rejects.toThrow('disk');
    expect(session.state.entries).toHaveLength(0);
    fail = false; await session.commit(s => save(s, '2026-10-16', 65));
    expect(JSON.parse(persisted).entries[0].page).toBe(65);
  });
  it('동시 호출을 최신 저장 결과에 이어 순서대로 적용한다', async () => {
    const pages: number[] = [];
    const session = new StateSession(fixture(), { load: async () => fixture(), save: async s => { await new Promise(r => setTimeout(r, 2)); pages.push(s.entries[0].page); } });
    await Promise.all([session.commit(s => save(s, '2026-10-16', 57)), session.commit(s => save(s, '2026-10-16', 65))]);
    expect(pages).toEqual([57, 65]); expect(roundPages(session.state, session.state.rounds[0])).toBe(23);
  });
  it('손상된 원본을 로딩 실패 시 덮어쓰지 않는다', async () => {
    let raw = '{broken';
    const store = stateStore({ getItem: async () => raw, setItem: async (_, next) => { raw = next; } }, 'a');
    await expect(store.load()).rejects.toThrow(); expect(raw).toBe('{broken');
  });
  it('다른 사용자 키는 별도 저장 영역을 사용한다', async () => {
    const values = new Map<string, string>();
    const adapter = { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); } };
    await stateStore(adapter, 'user-a').save(fixture());
    expect((await stateStore(adapter, 'user-b').load()).books).toHaveLength(0);
  });
});
