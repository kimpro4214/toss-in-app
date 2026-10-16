import { initialState, validateState } from './engine';
import type { Backup, State } from './types';

export interface Store { identity?: string; load(): Promise<State>; save(state: State): Promise<void> }
export interface StringStore { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export function stateStore(storage: StringStore, key: string): Store {
  return {
    async load() { const raw = await storage.getItem(key); return raw === null ? initialState() : validateState(JSON.parse(raw)); },
    async save(state) { await storage.setItem(key, JSON.stringify(validateState(state))); },
  };
}
export function backupJSON(state: State, now = new Date().toISOString()): string {
  const backup: Backup = { app: 'today-pages', schemaVersion: 2, exportedAt: now, state: validateState(state) };
  return JSON.stringify(backup, null, 2);
}
export function parseBackup(raw: string): State {
  let value: Backup;
  try { value = JSON.parse(raw); } catch { throw new Error('JSON 백업 파일을 읽을 수 없어요.'); }
  if (!value || value.app !== 'today-pages' || ![1, 2].includes(value.schemaVersion) || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error('오늘 몇 쪽의 지원되는 백업 파일인지 확인해 주세요.');
  return validateState(value.state);
}
// 저장이 성공한 스냅샷만 호출자에게 공개합니다. 실패한 작업 뒤에도 다음 저장을 시도할 수 있습니다.
export class StateSession {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(public state: State, private store: Store) {}
  commit(update: (state: State) => State): Promise<State> {
    const task = this.tail.then(async () => {
      const next = validateState(update(this.state));
      await this.store.save(next);
      this.state = next;
      return next;
    });
    this.tail = task.catch(() => {});
    return task;
  }
}
