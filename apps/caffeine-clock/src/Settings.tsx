import { useState, type FormEvent } from 'react';
import { dateKey, waterGoal } from './engine';
import { exportBackup, openSource, track } from './platform';
import { sources } from './sources';
import { parseBackup } from './storage';
import { Button } from './ui';
import type { AgeBand, PersistedState, Preferences, ReferenceSex } from './types';

export function Settings({ state, busy, save, restore, clear }: { state: PersistedState; busy: boolean; save: (p: Preferences) => Promise<boolean>; restore: (s: PersistedState) => void; clear: () => void }) {
  const [draft, setDraft] = useState(state.preferences);
  const [custom, setCustom] = useState(String(state.preferences.customWaterGoalMl ?? ''));
  const [backup, setBackup] = useState(''), [importText, setImportText] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState('');
  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) { setDraft(p => ({ ...p, [key]: value })); setStatus(''); }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setStatus('');
    const next = { ...draft, customWaterGoalMl: custom.trim() ? Number(custom) : null };
    try {
      parseBackup(JSON.stringify({ ...state, preferences: next }));
      if (await save(next)) setStatus('설정을 저장했어요. 기존 기록은 그대로 유지돼요.');
    } catch (e) { setError(e instanceof Error ? e.message : '설정을 확인해 주세요.'); }
  }
  async function download() {
    const text = JSON.stringify(state, null, 2); setBackup(text); setError('');
    try { await exportBackup(text); track('backup_exported'); setStatus('백업 파일을 저장했어요. 민감한 기록이 담겨 있으니 안전하게 보관해 주세요.'); }
    catch (e) { setError(e instanceof Error ? e.message : '아래 백업 내용을 복사해 주세요.'); }
  }
  function prepareRestore(text: string) {
    setError(''); try { restore(parseBackup(text)); } catch (e) { setError(e instanceof Error ? e.message : '백업을 확인해 주세요.'); }
  }
  const goal = waterGoal({ ...draft, customWaterGoalMl: custom.trim() ? Number(custom) : null });
  return <div className="stack settings-page">
    <div className="page-heading"><div className="eyebrow">MY ROUTINE</div><h1>나에게 맞는 기준</h1><p>숫자는 참고로, 생활은 내 속도로.</p></div>
    <form onSubmit={submit}><fieldset disabled={busy} className="stack">
      <section className="card stack"><h2>카페인 계산과 취침</h2>
        <label className="field">목표 취침 시각<input type="time" value={draft.bedtime} required onChange={e => change('bedtime', e.target.value)} /></label>
        <label className="field">카페인을 줄이기 시작할 시점<select value={draft.cutoffHours} onChange={e => change('cutoffHours', Number(e.target.value) as Preferences['cutoffHours'])}>{[6, 9, 12].map(h => <option key={h} value={h}>취침 {h}시간 전</option>)}</select></label>
        <label className="field">기본 반감기 가정<select value={draft.halfLifeHours} onChange={e => change('halfLifeHours', Number(e.target.value) as Preferences['halfLifeHours'])}>{[3, 5, 7].map(h => <option key={h} value={h}>{h}시간</option>)}</select></label>
        <p className="help">반감기는 내 대사 속도를 측정한 값이 아니에요. 9시간은 초기 생활 목표이며 모두에게 적용되는 금지 시각이 아니에요.</p>
      </section>
      <section className="card stack"><h2>물·음료 목표</h2>
        <label className="field">목표 설정 방식<select value={draft.waterGoalMode} onChange={e => change('waterGoalMode', e.target.value as Preferences['waterGoalMode'])}><option value="none">목표 없이 기록</option><option value="reference">국내 액체 충분섭취량 참고</option><option value="custom">직접 정한 목표</option></select></label>
        {draft.waterGoalMode === 'reference' && <>
          <label className="field">연령대 (선택 입력)<select value={draft.ageBand || ''} onChange={e => change('ageBand', e.target.value as AgeBand || null)}><option value="">선택해 주세요</option>{['19-29', '30-49', '50-64', '65-74', '75+'].map(a => <option key={a} value={a}>{a === '75+' ? '75세 이상' : `${a.replace('-', '~')}세`}</option>)}</select></label>
          <label className="field">참고표의 성별 기준 (선택 입력)<select value={draft.referenceSex || ''} onChange={e => change('referenceSex', e.target.value as ReferenceSex || null)}><option value="">선택해 주세요</option><option value="male">남성 기준</option><option value="female">여성 기준</option></select></label>
        </>}
        {draft.waterGoalMode === 'custom' && <label className="field">직접 정한 하루 목표 (mL)<input type="number" inputMode="numeric" min="100" max="5000" step="1" value={custom} onChange={e => { setCustom(e.target.value); setStatus(''); }} required /></label>}
        {goal !== null && Number.isFinite(goal) && <p className="water-reference">하루 물·음료 목표 <strong>{goal.toLocaleString()}mL</strong></p>}
        <p className="help">2025 한국인 영양소 섭취기준의 물·음료·우유를 합한 ‘액체’ 참고량이에요. 음식의 수분은 제외해요. 개인의 정확한 필요량이나 탈수 진단이 아니에요. 수분 제한 지침이 있다면 해당 지침을 따라 주세요.</p>
      </section>
      <Button type="submit" display="block" size="large" disabled={busy}>설정 저장</Button>
    </fieldset></form>
    {status && <p role="status" className="success">{status}</p>}{error && <p role="alert" className="error">{error}</p>}
    <section className="card stack"><h2>내 기록 보관하기</h2><p className="help">입력한 연령대·성별·음료 기록은 이 앱의 기기 저장소에 보관해요. 카페인 수치와 기록 내용은 분석 이벤트에 보내지 않아요. 기기 간 동기화나 영구 백업을 제공하지 않으니 직접 백업을 보관해 주세요.</p>
      <Button variant="weak" display="block" disabled={busy} onClick={() => { void download(); }}>JSON 백업 내보내기</Button>
      {backup && <label className="field">복사해서 보관할 백업 내용<textarea value={backup} readOnly onFocus={e => e.target.select()} rows={4} /></label>}
      <label className="field">백업 파일 선택<input type="file" accept=".json,application/json" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 10_000_000) { setError('백업은 10MB 이하로 선택해 주세요.'); return; } try { prepareRestore(await file.text()); } catch { setError('파일을 읽지 못했어요. 백업 내용을 직접 붙여넣을 수 있어요.'); } }} /></label>
      <details><summary>백업 내용 붙여넣기로 복원</summary><label className="field">복원할 JSON<textarea value={importText} onChange={e => setImportText(e.target.value)} rows={4} maxLength={10_000_000} /></label><button className="secondary" disabled={busy || !importText.trim()} onClick={() => prepareRestore(importText)}>백업 검증 후 복원</button></details>
      <button className="text-button danger" disabled={busy} onClick={clear}>기록과 설정 전체 삭제</button>
      <small className="muted">백업 파일에는 건강·생활 기록이 포함돼요. 공유할 때 주의해 주세요.</small>
    </section>
    <section className="card stack"><h2>계산의 근거와 한계</h2><p className="notice">성인을 위한 일반 생활 기록 도구예요. 진단·치료나 수면 보장을 제공하지 않아요. 임신·수유·질환·복약 중에는 일반 성인 수치를 개인 지침으로 적용하지 마세요.</p><p className="help">기록한 섭취량을 즉시 흡수한 것으로 가정한 단순 모델이에요. 실제 흡수 과정·개인 대사 차이·기록하지 않은 섭취는 반영하지 못해요. 10mg은 표시용 기준이며 수면 안전선이 아니에요.</p>
      {sources.map(s => <div className="source-item" key={s.url}><button className="text-button" onClick={() => openSource(s.url)}>{s.title} ↗</button><p>{s.detail}</p></div>)}
      <p className="help">음료 목록은 브랜드 없는 일반 음료 예시예요. 아메리카노·라떼는 EFSA의 에스프레소 60mL당 약 80mg을 넣는 레시피를 가정해요. 물·우유 양만 달라지면 카페인은 같게 두며 실제 함량은 샷 수와 추출 방식에 따라 달라져요. 다른 음료도 일반 참고값으로, 상세에서 계산 기준과 출처를 확인하고 직접 수정할 수 있어요.</p><small className="muted">오늘 카페인 0.1.0 · 참고 자료 확인 2026.10.17<br />오늘 날짜 {dateKey(Date.now())}</small>
    </section>
  </div>;
}
