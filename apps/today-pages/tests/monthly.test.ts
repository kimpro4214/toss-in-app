import { describe, expect, it } from 'vitest';
import { addBook, changeRound, formatReadingMinutes, initialState, monthSummary, reread, saveEntry } from '../src/engine';

const stamp = '2026-10-16T10:00:00Z';
const fixture = () => addBook(initialState(), { id: 'b', title: '이달의 책', authors: [] }, { id: 'r', bookId: 'b', initialPage: 42, startedOn: '2026-09-01', status: 'reading', dailyGoal: 10, lastRecordedAt: stamp });
describe('월별 독서 요약', () => {
  it.each([[0, '0분'], [59, '0분'], [3599, '59분'], [3600, '60분'], [3601, '1시간 0분'], [7260, '2시간 1분']] as const)('%s초를 시간·분으로 표시한다', (seconds, text) => { expect(formatReadingMinutes(seconds)).toBe(text); });
  it('다른 달의 기록을 제외하고 책을 한 번씩 세며 마지막 도달 페이지를 찾는다', () => {
    let s = fixture();
    for (const [date, page] of [['2026-09-30', 60], ['2026-10-01', 90], ['2026-10-16', 100], ['2026-11-01', 150]] as const) s = saveEntry(s, 'r', date, page, '', '2026-11-01', stamp, date);
    s = { ...s, entries: s.entries.map(e => ({ ...e, readingSeconds: e.date === '2026-10-01' ? 60 : e.date === '2026-10-16' ? 3600 : 100 })) };
    const summary = monthSummary(s, '2026-10');
    expect(summary.books).toHaveLength(1); expect(summary.books[0].latest.page).toBe(100);
    expect(summary.pages).toBe(40); expect(summary.seconds).toBe(3660);
    expect(monthSummary(s, '2026-08')).toEqual({ books: [], pages: 0, seconds: 0 });
  });
  it('같은 책 재독은 중복 집계하지 않고 최근 회차의 페이지를 보여준다', () => {
    let s = saveEntry(fixture(), 'r', '2026-10-12', 100, '', '2026-10-16', stamp, 'first');
    s = changeRound(s, 'r', { status: 'completed', completedOn: '2026-10-12' });
    s = reread(s, { id: 'r2', bookId: 'b', initialPage: 0, startedOn: '2026-10-13', status: 'reading', dailyGoal: 10, lastRecordedAt: stamp });
    s = saveEntry(s, 'r2', '2026-10-16', 20, '', '2026-10-16', stamp, 'second');
    const summary = monthSummary(s, '2026-10');
    expect(summary.books).toHaveLength(1); expect(summary.books[0].latest.page).toBe(20); expect(summary.pages).toBe(78);
  });
});
