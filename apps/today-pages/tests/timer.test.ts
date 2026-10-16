import { describe, expect, it } from 'vitest';
import { addBook, checkpointTimer, finishTimer, initialState, monthDates, roundSeconds, saveEntry, startTimer, validateState, weekStats } from '../src/engine';
import { ReadingClock } from '../src/timer';
import { backupJSON, parseBackup, StateSession } from '../src/storage';

const stamp = '2026-10-16T10:00:00.000Z';
const fixture = () => addBook(initialState(), { id: 'b', title: '타이머 책', authors: [], totalPages: 200 }, { id: 'r', bookId: 'b', initialPage: 42, startedOn: '2026-10-12', status: 'reading', dailyGoal: 10, lastRecordedAt: stamp });
describe('독서 시간과 복원', () => {
  it('v1의 페이지·감상을 보존하고 시간 0으로 이전한다', () => {
    const old = { ...saveEntry(fixture(), 'r', '2026-10-16', 57, '기존 감상', '2026-10-16', stamp, 'e'), schemaVersion: 1 } as any;
    delete old.timer; delete old.entries[0].readingSeconds;
    const migrated = validateState(old);
    expect(migrated.schemaVersion).toBe(2); expect(migrated.entries[0]).toMatchObject({ page: 57, note: '기존 감상', readingSeconds: 0 });
    expect(parseBackup(JSON.stringify({ app: 'today-pages', schemaVersion: 1, exportedAt: stamp, state: old }))).toEqual(migrated);
  });
  it('타이머 여러 번 저장 시 시간은 합산하고 페이지는 도달 페이지로 갱신한다', () => {
    let s = startTimer(fixture(), 'r', '2026-10-16', 't1');
    expect(() => saveEntry(s, 'r', '2026-10-16', 50, '', '2026-10-16', stamp, 'e')).toThrow('타이머');
    s = finishTimer(s, 't1', 120000, 57, '생각', '2026-10-16', stamp, 'e');
    s = startTimer(s, 'r', '2026-10-16', 't2');
    s = finishTimer(s, 't2', 180000, 65, '생각', '2026-10-16', stamp, 'e2');
    expect(s.entries).toHaveLength(1); expect(s.entries[0].readingSeconds).toBe(300);
    expect(weekStats(s, '2026-10-16')).toMatchObject({ pages: 23, seconds: 300 });
    expect(roundSeconds(s, 'r')).toBe(300); expect(parseBackup(backupJSON(s))).toEqual(s);
    expect(() => finishTimer(s, 't2', 180000, 65, '', '2026-10-16', stamp, 'e2')).toThrow();
  });
  it('페이지 수정으로 측정 시간은 사라지지 않는다', () => {
    let s = finishTimer(startTimer(fixture(), 'r', '2026-10-16', 't'), 't', 60000, 60, '', '2026-10-16', stamp, 'e');
    s = saveEntry(s, 'r', '2026-10-16', 55, '', '2026-10-16', stamp, 'e');
    expect(s.entries[0].readingSeconds).toBe(60);
  });
  it('저장 실패 시 대기 시간을 보존하고 재시도에서 한 번만 합산한다', async () => {
    let fail = true;
    const s = checkpointTimer(startTimer(fixture(), 'r', '2026-10-16', 't'), 't', 90000);
    const session = new StateSession(s, { load: async () => s, save: async () => { if (fail) throw new Error('저장 실패'); } });
    const finish = () => session.commit(v => finishTimer(v, 't', 90000, 60, '', '2026-10-16', stamp, 'e'));
    await expect(finish()).rejects.toThrow(); expect(session.state.timer?.elapsedMs).toBe(90000);
    fail = false; await finish(); expect(session.state.entries[0].readingSeconds).toBe(90); expect(session.state.timer).toBeNull();
  });
  it('시간만 읽어도 읽은 날로 세고 잘못된 시간·타이머 참조를 거부한다', () => {
    const s = finishTimer(startTimer(fixture(), 'r', '2026-10-16', 't'), 't', 60000, 42, '', '2026-10-16', stamp, 'e');
    expect(weekStats(s, '2026-10-16').days.size).toBe(1);
    expect(() => validateState({ ...s, entries: [{ ...s.entries[0], readingSeconds: -1 }] })).toThrow();
    expect(() => validateState({ ...s, timer: { id: 't', roundId: 'missing', date: '2026-10-16', startedPage: 42, elapsedMs: 0 } })).toThrow();
  });
});
describe('시계와 달력', () => {
  it('일시정지 구간을 제외하고 재실행 시 멈춘 상태로 복원한다', () => {
    const saved = { id: 't', roundId: 'r', date: '2026-10-16', startedPage: 0, elapsedMs: 0 };
    const clock = new ReadingClock(saved); const start = Date.parse(stamp);
    clock.resume(start); expect(clock.pause(start + 65000)).toBe(65000);
    expect(clock.elapsed(start + 200000)).toBe(65000);
    clock.resume(start + 200000); expect(clock.pause(start + 235000)).toBe(100000);
    const restored = new ReadingClock({ ...saved, elapsedMs: 100000 });
    expect(restored.running).toBe(false); expect(restored.elapsed(start + 999999)).toBe(100000);
  });
  it('한국 자정까지만 측정하고 이전 날짜의 재개를 막는다', () => {
    const clock = new ReadingClock({ id: 't', roundId: 'r', date: '2026-10-16', startedPage: 0, elapsedMs: 0 });
    clock.resume(Date.parse('2026-10-16T23:59:50+09:00'));
    expect(clock.pause(Date.parse('2026-10-17T00:05:00+09:00'))).toBe(10000);
    expect(() => clock.resume(Date.parse('2026-10-17T10:00:00+09:00'))).toThrow('지난 날짜');
  });
  it('월요일 시작으로 윤년·연말 달력을 만든다', () => {
    expect(monthDates('2024-02')).toContain('2024-02-29');
    expect(monthDates('2026-10')[0]).toBe('2026-09-28');
    expect(monthDates('2026-12')).toContain('2027-01-03');
  });
});
