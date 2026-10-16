import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { checkpointTimer, finishTimer, formatDuration, koreanDate, startTimer } from './engine';
import { ReadingClock } from './timer';
import type { StateSession } from './storage';
import type { State } from './types';
import type { EventName } from './platform';

type Commit = (update: (state: State) => State, event?: EventName) => Promise<boolean>;
export function useReadingTimer(state: State | null, session: MutableRefObject<StateSession | undefined>, locked: MutableRefObject<boolean>, commit: Commit, onState: (state: State) => void, onError: (message: string) => void, onNotice: (message: string) => void) {
  const clock = useRef<ReadingClock | null>(null);
  const [, refresh] = useState(0);
  const callbacks = useRef({ onState, onError, onNotice }); callbacks.current = { onState, onError, onNotice };
  const pending = useRef(false);
  const lastAttempt = useRef(0);
  if (state?.timer && clock.current?.id !== state.timer.id) clock.current = new ReadingClock(state.timer);
  if (!state?.timer) clock.current = null;

  useEffect(() => {
    async function persist() {
      const active = session.current?.state.timer;
      const current = clock.current;
      if (!active || !current || current.id !== active.id || locked.current) return;
      const elapsed = current.elapsed();
      lastAttempt.current = Date.now(); pending.current = false;
      if (elapsed === active.elapsedMs) return;
      locked.current = true;
      try {
        const next = await session.current!.commit(s => checkpointTimer(s, active.id, elapsed));
        callbacks.current.onState(next);
      } catch {
        pending.current = true;
        callbacks.current.onError('독서 시간을 저장하지 못했어요. 측정 시간은 유지했으니 다시 저장해 주세요.');
      } finally { locked.current = false; }
    }
    const pauseForBackground = () => {
      if (!clock.current?.running) return;
      clock.current.pause(); pending.current = true; refresh(n => n + 1);
      callbacks.current.onNotice('화면을 벗어나 독서 타이머를 일시정지했어요.');
      void persist();
    };
    const visibility = () => { if (document.visibilityState === 'hidden') pauseForBackground(); };
    const interval = window.setInterval(() => {
      if (clock.current?.running && clock.current.date !== koreanDate()) {
        clock.current.pause(); pending.current = true; refresh(n => n + 1);
        callbacks.current.onNotice('날짜가 바뀌어 타이머를 멈췄어요. 지난 독서를 저장한 뒤 오늘의 타이머를 시작해 주세요.');
      }
      if ((clock.current?.running || pending.current) && Date.now() - lastAttempt.current >= 15000) void persist();
    }, 1000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pauseForBackground);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pauseForBackground); };
  }, [session, locked]);

  async function begin(roundId: string) {
    const timerId = crypto.randomUUID();
    if (await commit(s => startTimer(s, roundId, koreanDate(), timerId))) {
      clock.current = new ReadingClock(session.current!.state.timer!);
      clock.current.resume(); lastAttempt.current = Date.now(); pending.current = false; refresh(n => n + 1);
    }
  }
  async function pause() {
    const active = session.current?.state.timer;
    if (!active || !clock.current) return false;
    const elapsed = clock.current.pause(); pending.current = true; refresh(n => n + 1);
    const saved = await commit(s => checkpointTimer(s, active.id, elapsed));
    if (saved) { pending.current = false; lastAttempt.current = Date.now(); }
    return saved;
  }
  async function resume() {
    const active = session.current?.state.timer;
    if (!active || !clock.current || locked.current) return;
    if (active.date !== koreanDate()) { onError('지난 날짜의 측정을 먼저 저장해 주세요.'); return; }
    if (await commit(s => checkpointTimer(s, active.id, clock.current!.elapsed()))) {
      clock.current!.resume(); pending.current = false; lastAttempt.current = Date.now(); refresh(n => n + 1);
    }
  }
  async function finish(page: number, note: string) {
    const active = session.current?.state.timer;
    if (!active || !clock.current || locked.current) return false;
    const elapsed = clock.current.pause(); pending.current = true; refresh(n => n + 1);
    if (await commit(s => finishTimer(s, active.id, elapsed, page, note, koreanDate(), new Date().toISOString(), crypto.randomUUID()), 'record_saved')) {
      pending.current = false;
      onNotice(`이번에 ${formatDuration(Math.floor(elapsed / 1000))} 동안 ${page - active.startedPage}쪽 읽었어요.`);
      return true;
    }
    return false;
  }
  return { clock: clock.current, begin, pause, resume, finish };
}
