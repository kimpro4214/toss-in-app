import { useState } from 'react';
import { Button } from '@toss/tds-mobile';
import { subjects } from './subjects';
import { studyTracks } from './preferences';
import type { Settings } from './types';

export function StudyPreferences({ settings, busy, first, onSave, onCancel }: { settings: Settings; busy: boolean; first: boolean; onSave: (ids: string[]) => Promise<void>; onCancel: () => void }) {
  const [selected, setSelected] = useState(settings.selectedSubjects ?? subjects.filter(s => s.group === 'CS' || s.group === '설계').map(s => s.id));
  const [track, setTrack] = useState('custom');
  const toggle = (id: string) => { setTrack('custom'); setSelected(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]); };
  return <section className="study-preferences">
    <div className="page-title"><div className="eyebrow">나에게 맞는 오늘의 5문제</div><h1>{first ? '무엇을 공부하고 있나요?' : '학습 범위를 바꿔 볼까요?'}</h1><p>공부할 언어와 과목을 골라 주세요.<br/>랜덤 학습에도 선택한 범위만 나와요.</p></div>
    <fieldset disabled={busy}><legend>분야로 빠르게 선택</legend><div className="track-options">{studyTracks.map(t => <button type="button" key={t.id} aria-pressed={track === t.id} onClick={() => { setTrack(t.id); if (t.id !== 'custom') setSelected(t.subjects.slice()); }}>{t.name}</button>)}</div></fieldset>
    <div className="section-head"><p className="hint">선택한 과목 {selected.length}개 · 언어는 여러 개 골라도 돼요.</p><button className="clear-selection" disabled={busy} onClick={() => { setSelected([]); setTrack('custom'); }}>선택 초기화</button></div>
    {['언어', 'CS', '게임 개발', '설계'].map(group => <fieldset disabled={busy} key={group}><legend>{group === '언어' ? '공부하는 프로그래밍 언어' : group}</legend><div className="subject-options">{subjects.filter(s => s.group === group).map(s => <label key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)}/><span>{s.name}</span></label>)}</div></fieldset>)}
    <p className="hint">언어를 선택하지 않으면 언어별 문제는 나오지 않아요. 과목이 5개보다 적어도 선택한 범위에서 5문제를 채워요. 이미 시작한 세트는 유지되고 변경은 다음 세트에 적용돼요.</p>
    <Button display="block" disabled={!selected.length} loading={busy} onClick={() => void onSave(selected)}>{first ? '선택한 과목으로 시작하기' : '학습 범위 저장'}</Button>
    {!first && <button className="text-button" disabled={busy} onClick={onCancel}>취소</button>}
  </section>;
}
