import { koreanDate } from './engine';
import type { ReadingTimer } from './types';

// 실행 상태는 메모리에만 둡니다. 다시 열면 마지막 저장 시간에서 일시정지 상태로 복원합니다.
export class ReadingClock {
  private accumulated: number;
  private runningSince: number | null = null;
  readonly id: string;
  readonly date: string;
  constructor(timer: ReadingTimer) { this.id = timer.id; this.date = timer.date; this.accumulated = timer.elapsedMs; }
  get running(): boolean { return this.runningSince !== null; }
  elapsed(at = Date.now()): number {
    const boundary = Date.parse(`${this.date}T00:00:00+09:00`) + 86400000;
    return Math.floor(this.accumulated + (this.runningSince === null ? 0 : Math.max(0, Math.min(at, boundary) - this.runningSince)));
  }
  resume(at = Date.now()): void {
    if (koreanDate(new Date(at)) !== this.date) throw new Error('지난 날짜의 측정은 먼저 기록해 주세요. 오늘 독서는 새 타이머로 시작할 수 있어요.');
    if (!this.running) this.runningSince = at;
  }
  pause(at = Date.now()): number { this.accumulated = this.elapsed(at); this.runningSince = null; return this.accumulated; }
}
