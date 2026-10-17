import { useEffect, useState, type FormEvent } from 'react';
import { drinkLabel, drinks } from './catalog';
import { HOUR, formatMg, formatMoment, inputDateTime, nextBedtime, residual, validateRecord } from './engine';
import { openSource, track } from './platform';
import { Button, Sheet } from './ui';
import type { DrinkVariant, IntakeRecord, PersistedState } from './types';

export type Editor = { variant?: DrinkVariant; record?: IntakeRecord; water?: number; custom?: boolean };
export function RecordEditor({ editor, state, busy, now, saveError, onSave, onClose, onFavorite }: {
  editor: Editor; state: PersistedState; busy: boolean; now: number; saveError: string;
  onSave: (record: IntakeRecord) => Promise<boolean>; onClose: () => void; onFavorite: (id: string) => void;
}) {
  const [variant, setVariant] = useState(editor.variant);
  const [mode, setMode] = useState<'preview' | 'record'>(editor.record || editor.water || editor.custom ? 'record' : 'preview');
  const [portion, setPortion] = useState(1);
  const [name, setName] = useState(editor.record?.name || (editor.water ? '물' : editor.variant?.name || ''));
  const [volume, setVolume] = useState(String(editor.record?.volumeMl || editor.water || editor.variant?.volumeMl || ''));
  const [caffeine, setCaffeine] = useState(editor.record ? String(editor.record.caffeineMg) : editor.water ? '0' : String(editor.variant?.caffeineMg ?? ''));
  const [time, setTime] = useState(inputDateTime(editor.record ? Date.parse(editor.record.consumedAt) : Date.now()));
  const [estimated, setEstimated] = useState(editor.record?.volumeEstimated ?? editor.variant?.volumeBasis === 'cup');
  const [error, setError] = useState('');
  const isWater = Boolean(editor.water || editor.record?.kind === 'water');
  const p = state.preferences, bedtime = nextBedtime(now, p.bedtime);
  const validAmount = caffeine.trim() !== '' && volume.trim() !== '' && Number.isFinite(Number(caffeine)) && Number(caffeine) >= 0 && Number(caffeine) <= 2000 && Number(volume) > 0 && Number(volume) <= 5000;
  const before = residual(state.records, bedtime, p.halfLifeHours);
  const extra = Number(caffeine) * 0.5 ** ((bedtime - now) / (p.halfLifeHours * HOUR));
  useEffect(() => { if (mode === 'preview') track('preview_viewed'); }, [mode, variant?.id]);
  function select(next: DrinkVariant) {
    setVariant(next); setPortion(1); setName(next.name); setVolume(String(next.volumeMl));
    setCaffeine(String(next.caffeineMg)); setEstimated(next.volumeBasis === 'cup'); setError('');
  }
  function setFraction(fraction: number) {
    setPortion(fraction);
    if (variant) { setVolume(String(Math.round(variant.volumeMl * fraction))); setCaffeine(String(Math.round(variant.caffeineMg * fraction * 10) / 10)); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      if (!validAmount) throw new Error('마신 양과 총 카페인을 입력해 주세요. 모르는 함량을 0mg으로 넣지 않도록 확인해 주세요.');
      const timestamp = new Date(time).getTime();
      if (!Number.isFinite(timestamp)) throw new Error('마신 날짜와 시각을 확인해 주세요.');
      const manualCaffeine = !variant || Number(caffeine) !== Math.round(variant.caffeineMg * portion * 10) / 10;
      const record: IntakeRecord = {
        id: editor.record?.id || crypto.randomUUID(), variantId: editor.record?.variantId ?? variant?.id ?? null,
        name: name.trim(), kind: editor.record?.kind || (isWater ? 'water' : variant?.kind || 'other'),
        caffeineMg: Number(caffeine), volumeMl: Number(volume), volumeEstimated: estimated,
        consumedAt: new Date(timestamp).toISOString(), sourceUrl: editor.record?.sourceUrl ?? (manualCaffeine ? null : variant?.sourceUrl ?? null),
        sourceCheckedAt: editor.record?.sourceCheckedAt ?? (manualCaffeine ? null : variant?.checkedAt ?? null),
      };
      // 수정한 함량은 참고값과 구분해 직접 입력값으로 보존해요.
      if (editor.record && Number(caffeine) !== editor.record.caffeineMg) { record.sourceUrl = null; record.sourceCheckedAt = null; }
      validateRecord(record);
      if (await onSave(record)) onClose();
    } catch (e) { setError(e instanceof Error ? e.message : '기록을 확인해 주세요.'); }
  }
  return <Sheet title={editor.record ? '기록 수정' : isWater ? '물 기록' : variant ? '한 잔 살펴보기' : '음료 직접 입력'} onClose={onClose} busy={busy}>
    <form onSubmit={submit}><fieldset disabled={busy} className="stack">
      {saveError && <p role="alert" className="error">{saveError}</p>}
      {!editor.record && !isWater && <div className="segmented"><button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>지금 마시면</button><button type="button" aria-pressed={mode === 'record'} onClick={() => setMode('record')}>마신 음료 기록</button></div>}
      {variant && <>
        <div className="selected-drink"><div className="eyebrow">일반 음료 · 참고값</div><h3>{drinkLabel(variant)}</h3><p>카페인 약 <strong>{variant.caffeineMg}mg</strong>을 적용한 예시예요.</p><button type="button" className="text-button" aria-pressed={state.favorites.includes(variant.id)} onClick={() => onFavorite(variant.id)} disabled={busy}>{state.favorites.includes(variant.id) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가'}</button></div>
        <p className="notice">같은 음료와 용량이어도 추출 방식·샷 수에 따라 달라져요. 실제 함량을 알면 아래 값을 수정해 주세요.</p>
        <details><summary>이 참고값의 계산 기준</summary><p className="help">{variant.sourceNote}</p></details>
        {mode === 'preview' && <label className="field">다른 음료와 비교<select value={variant.id} onChange={e => select(drinks.find(d => d.id === e.target.value)!)}>{drinks.map(d => <option key={d.id} value={d.id}>{drinkLabel(d)}</option>)}</select></label>}
        <div className="chips" aria-label="마시는 비율">{[0.25, 0.5, 1].map(f => <button type="button" key={f} aria-pressed={portion === f} onClick={() => setFraction(f)}>{f === 1 ? '한 잔' : f === 0.5 ? '반 잔' : '¼잔'}</button>)}</div>
      </>}
      {(!variant || editor.record) && <label className="field">음료 이름<input value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label>}
      <div className="field-pair"><label className="field">{mode === 'preview' ? '마실 양' : '마신 양'} (mL)<input type="number" inputMode="decimal" min="1" max="5000" step="any" value={volume} onChange={e => setVolume(e.target.value)} required /></label><label className="field">총 카페인 (mg)<input type="number" inputMode="decimal" min="0" max="2000" step="any" value={caffeine} readOnly={isWater} onChange={e => setCaffeine(e.target.value)} required /></label></div>
      {variant && <p className="help">비율을 바꾸면 함량도 비례 계산해요. mL만 바꾸면 카페인은 바뀌지 않아요. 얼음·물·샷 변경은 실제 함량을 확인해 수정해 주세요.</p>}
      {!isWater && <label className="check"><input type="checkbox" checked={estimated} onChange={e => setEstimated(e.target.checked)} /> 컵·얼음 포함 용량으로 추정한 기록이에요</label>}
      {mode === 'preview' ? <>
        <section className="preview-result" aria-live="polite"><div className="eyebrow">{formatMoment(bedtime, now)} 취침 시점 예상</div>{validAmount ? <><div className="preview-numbers"><span>{formatMg(before)}<small>mg</small></span><span className="muted">→</span><strong>{formatMg(before + extra)}<small>mg</small></strong></div><p>이 음료를 지금 마시면 약 {formatMg(extra)}mg 더 남을 것으로 계산해요.</p><div className="scenarios">{([3, 5, 7] as const).map(h => <div key={h}><span>{h}시간 가정</span><strong>{formatMg(residual(state.records, bedtime, h) + Number(caffeine) * 0.5 ** ((bedtime - now) / (h * HOUR)))}mg</strong></div>)}</div></> : <p>총 카페인과 마실 양을 확인하면 비교할 수 있어요.</p>}</section>
        <p className="help">미리보기는 저장되지 않아요. 예상 잔여량이 적어도 수면에 영향이 없다는 뜻은 아니에요.</p>
        <Button type="button" size="large" display="block" onClick={() => { setMode('record'); setTime(inputDateTime(Date.now())); }}>마셨다면 기록하기</Button>
      </> : <>
        <label className="field">마신 시각<input type="datetime-local" value={time} max={inputDateTime(Date.now())} onChange={e => setTime(e.target.value)} required /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <Button type="submit" size="large" display="block" disabled={busy}>{busy ? '저장 중…' : editor.record ? '수정 저장' : '기록 저장'}</Button>
      </>}
      {variant && <p className="source-line">특정 브랜드·제품의 측정값이 아닌 일반 참고값이에요.<br />근거 확인 {variant.checkedAt}<br /><button type="button" className="text-button" onClick={() => openSource(variant.sourceUrl)}>참고 자료 확인 ↗</button></p>}
    </fieldset></form>
  </Sheet>;
}
