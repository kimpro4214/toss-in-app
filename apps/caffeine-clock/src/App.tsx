import { useCallback, useEffect, useRef, useState } from 'react';
import { BannerAd } from './BannerAd';
import { drinkLabel, drinks, searchDrinks } from './catalog';
import { belowTenAt, dateKey, formatMg, formatMoment, formatTime, HOUR, initialState, nextBedtime, residual, totals, waterGoal, weekSummary } from './engine';
import { RecordEditor, type Editor } from './RecordEditor';
import { Settings } from './Settings';
import { closeApp, createStore, setupNavigation, track, type EventName } from './platform';
import { StateSession } from './storage';
import { Button, Chart, Icon, Sheet } from './ui';
import { useClock } from './useClock';
import type { IntakeRecord, PersistedState } from './types';

type Tab = 'today' | 'search' | 'history' | 'settings';
type Confirmation = { title: string; description: string; label: string; apply: () => Promise<boolean> };
let sessionPromise: Promise<StateSession> | undefined;
export function App() {
  const [state, setState] = useState<PersistedState | null>(null), [tab, setTab] = useState<Tab>('today');
  const [editor, setEditor] = useState<Editor | null>(null), [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [fatal, setFatal] = useState(''), [attempt, setAttempt] = useState(0), [toast, setToast] = useState('');
  const session = useRef<StateSession | null>(null), saving = useRef(false), started = useRef(Date.now()), back = useRef(() => {});
  const [query, setQuery] = useState(''), [category, setCategory] = useState('전체'), [historyDate, setHistoryDate] = useState(dateKey(Date.now()));
  const resume = useCallback(() => { void session.current?.checkIdentity().catch(e => { setFatal(e.message); setState(null); session.current = null; }); }, []);
  const [now, refreshClock] = useClock(resume);
  useEffect(() => {
    let active = true;
    sessionPromise ??= createStore().then(store => StateSession.open(store));
    void sessionPromise.then(s => { if (active) { session.current = s; setState(s.state); setFatal(''); track('app_open'); } }).catch(e => { if (active) setFatal(e instanceof Error ? e.message : '기록을 열지 못했어요.'); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => setupNavigation(() => back.current()), []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  back.current = () => { if (saving.current) return; if (confirm) setConfirm(null); else if (editor) setEditor(null); else if (tab !== 'today') changeTab('today'); else closeApp(); };
  function changeTab(next: Tab) { setTab(next); setError(''); window.scrollTo({ top: 0 }); }
  function openEditor(next: Editor) { setError(''); setEditor(next); }
  async function commit(update: (s: PersistedState) => PersistedState, event: EventName, label: string): Promise<boolean> {
    if (saving.current || !session.current) return false;
    saving.current = true; setBusy(true); setError('');
    try {
      const previous = session.current.state;
      const next = await session.current.commit(update); refreshClock(); setState(next); track(event, event === 'record_saved' ? Date.now() - started.current : undefined);
      if (event === 'record_saved' && !previous.records.length) track('first_record_saved');
      setToast(label); return true;
    } catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했어요. 입력은 그대로 있으니 다시 시도해 주세요.'); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  function saveRecord(record: IntakeRecord) {
    const editing = session.current!.state.records.some(r => r.id === record.id);
    return commit(s => ({ ...s, records: editing ? s.records.map(r => r.id === record.id ? record : r) : [...s.records, record] }), editing ? 'record_updated' : 'record_saved', editing ? '기록을 수정했어요.' : '한 잔을 기록했어요.');
  }
  function favorite(id: string) { void commit(s => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter(v => v !== id) : [...s.favorites, id] }), 'favorite_saved', '즐겨찾기를 변경했어요.'); }
  if (!state || fatal) return <main className="boot"><img src="/icon.svg" alt="" width="64" height="64" /><h1>오늘 카페인</h1>{fatal ? <><p role="alert">{fatal}</p><p className="help">기존 저장 자료는 자동으로 초기화하지 않아요.</p><Button onClick={() => { sessionPromise = undefined; setFatal(''); setAttempt(v => v + 1); }}>다시 열기</Button></> : <p role="status">내 한 잔을 준비하고 있어요…</p>}</main>;
  const p = state.preferences, bedtime = nextBedtime(now, p.bedtime), cutoff = bedtime - p.cutoffHours * HOUR;
  const total = totals(state.records, dateKey(now)), current = residual(state.records, now, p.halfLifeHours), sleep = residual(state.records, bedtime, p.halfLifeHours);
  const goal = waterGoal(p), liquid = total.waterMl + total.drinksMl, days = weekSummary(state.records, now, p);
  const favorites = state.favorites.map(id => drinks.find(d => d.id === id)).filter((d): d is typeof drinks[number] => Boolean(d));
  const recentIds = [...new Set([...state.records].sort((a, b) => b.consumedAt.localeCompare(a.consumedAt)).map(r => r.variantId).filter(Boolean))].slice(0, 3);
  const recent = recentIds.map(id => drinks.find(d => d.id === id)).filter((d): d is typeof drinks[number] => Boolean(d));
  const results = searchDrinks(query, category);
  const list = (items: typeof drinks) => items.map(d => <div className="drink-row" key={d.id}><button className="drink-main" onClick={() => openEditor({ variant: d })}><span className={`drink-icon ${d.kind === 'tea' ? 'tea' : ''}`}><Icon name={d.kind === 'energy' ? 'drop' : 'cup'} /></span><span><small>일반 음료</small><strong>{drinkLabel(d)}</strong><span className="drink-meta">카페인 약 {d.caffeineMg}mg · 참고값</span></span></button><button className="favorite" aria-label={`${drinkLabel(d)} 즐겨찾기`} aria-pressed={state.favorites.includes(d.id)} disabled={busy} onClick={() => favorite(d.id)}>{state.favorites.includes(d.id) ? '★' : '☆'}</button></div>);
  return <div className="app-shell">
    <header className="brand-header"><span className="brand"><img src="/icon.svg" width="30" height="30" alt="" />오늘 카페인</span><span className="header-date">{new Date(now).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span></header>
    <main id="main" className="page" key={tab}>
      {tab === 'today' && <>
        <section className="hero"><div className="eyebrow">A LITTLE COFFEE, A BETTER ROUTINE</div><h1>{state.records.length ? <>오늘의 한 잔,<br />밤의 쉼까지.</> : <>한 잔의 여유,<br />밤의 쉼까지.</>}</h1><p>지금 마시는 카페인, 잠들 때 얼마나 남을까요?</p><div className="hero-art" aria-hidden="true"><div className="orbit" /><Icon name="moon" size={58} /><div className="art-cup"><Icon name="cup" size={68} /></div><i /><i /></div></section>
        <section className="card caffeine-card"><div className="section-top"><h2>내 카페인의 흐름</h2><span className="badge">기록 기반 추정</span></div>
          <div className="caffeine-stats"><div><span>지금 예상 잔여량</span><strong>{formatMg(current)}<small>mg</small></strong></div><div><span>취침 시점 예상</span><strong>{formatMg(sleep)}<small>mg</small></strong></div></div>
          {!state.records.length && <p className="empty-note">기록한 음료가 없어요. 예시 음료로 먼저 비교해 보세요.</p>}
          {state.records.some(r => r.caffeineMg > 0) && <Chart records={state.records} now={now} bedtime={bedtime} halfLife={p.halfLifeHours} />}
          <div className="sleep-line"><Icon name="moon" size={18} /><span>목표 취침 <strong>{formatMoment(bedtime, now)}</strong></span><button className="text-button" onClick={() => changeTab('settings')}>변경</button></div>
          <div className="cutoff-note"><span className="eyebrow">나의 생활 목표</span><p><strong>{formatMoment(cutoff, now)}</strong>부터 카페인 줄이기</p><small>{now >= cutoff ? '설정한 줄이기 시각을 지났어요. 다음 한 잔은 함량을 살펴보세요.' : `취침 ${p.cutoffHours}시간 전부터 줄이는 목표예요.`} 수면을 보장하는 기준은 아니에요.</small></div>
          {state.records.some(r => r.caffeineMg > 0) && <p className="help">{current < 10 ? '현재 계산값은 10mg 미만이에요.' : `추가 섭취가 없다면 ${formatMoment(belowTenAt(state.records, now, p.halfLifeHours), now)}쯤 10mg 미만으로 감소할 것으로 예상해요.`} 10mg은 표시용 기준이에요.</p>}
          <Button display="block" size="large" onClick={() => { started.current = Date.now(); changeTab('search'); }}>음료 찾아보고 비교하기</Button>
        </section>
        <BannerAd />
        <section className="card water-card"><div className="section-top"><h2><Icon name="drop" size={20} />오늘의 물·음료</h2>{goal === null && <button className="text-button" onClick={() => changeTab('settings')}>목표 설정</button>}</div>
          <div className="water-total"><strong>{liquid.toLocaleString()}<small>mL</small></strong>{goal !== null && <span>/ 목표 {goal.toLocaleString()}mL</span>}</div>
          {goal !== null && <><progress aria-label="물과 음료 목표 진행률" max={goal} value={Math.min(liquid, goal)} /><p className="help">{liquid < goal ? `설정 목표까지 ${(goal - liquid).toLocaleString()}mL 남았어요.` : '설정한 목표만큼 기록했어요. 더 마시도록 권하는 뜻은 아니에요.'}</p></>}
          <div className="water-breakdown"><span><i />물 {total.waterMl.toLocaleString()}mL</span><span><i />다른 음료 {total.drinksMl.toLocaleString()}mL</span></div>
          <div className="water-actions">{[150, 250, 500].map(v => <button key={v} disabled={busy} onClick={() => openEditor({ water: v })}><Icon name="plus" size={15} />{v}mL</button>)}<button aria-label="물 직접 입력" disabled={busy} onClick={() => openEditor({ water: 250 })}>직접</button></div>
          <p className="help">물·음료의 마신 양을 합산해요. 컵·얼음 포함 기록은 추정치예요. 커피를 마셨다고 물을 차감하지 않아요.</p>
        </section>
        <section className="daily-summary"><span>오늘 섭취한 카페인</span><strong>{formatMg(total.caffeineMg)}mg <small>/ 성인 참고 400mg</small></strong><p>참고값 이하여도 수면이나 컨디션에 영향을 줄 수 있어요.</p></section>
        <section className="quick-section"><div className="section-top"><h2>자주 마시는 한 잔</h2><button className="text-button" onClick={() => changeTab('search')}>전체 보기 <Icon name="arrow" size={14} /></button></div>{favorites.length ? list(favorites.slice(0, 4)) : <div className="gentle-empty"><Icon name="cup" size={28} /><p>음료 옆 별을 눌러두면<br />다음 한 잔을 더 빠르게 남길 수 있어요.</p></div>}</section>
        {!state.records.length && <button className="example-card" onClick={() => openEditor({ variant: drinks.find(d => d.id === 'americano-250')! })}><span><strong>아메리카노로 먼저 체험하기</strong><small>기록 없이 취침 시점 잔여량을 비교해요</small></span><Icon name="arrow" size={18} /></button>}
        <p className="footnote">개인차가 있는 단순 계산이에요. 건강·수면 상태를 진단하지 않아요. 자세한 근거는 설정에서 확인할 수 있어요.</p>
      </>}
      {tab === 'search' && <div className="stack"><div className="page-heading"><div className="eyebrow">BEFORE YOUR NEXT SIP</div><h1>다음 한 잔은?</h1><p>이름으로 찾고, 잠들 때의 변화를 비교해요.</p></div>
        <label className="search-field"><Icon name="search" /><input aria-label="음료 검색" placeholder="아메리카노, 카페라떼, 250mL 검색" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="chips categories">{['전체', '커피', '디카페인', '차', '기타 음료'].map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <p className="help">브랜드 없는 일반 음료 예시예요. 카페인은 참고값이며 상세에서 계산 기준을 확인하고 수정할 수 있어요.</p>
        <button className="custom-add" onClick={() => openEditor({ custom: true })}><Icon name="plus" size={20} /><span>찾는 음료가 없나요? 직접 입력</span></button>
        {!query && category === '전체' && <>{favorites.length > 0 && <section><h2 className="list-heading">즐겨찾기</h2>{list(favorites)}</section>}{recent.length > 0 && <section><h2 className="list-heading">최근 기록한 음료</h2>{list(recent)}</section>}</>}
        <section><div className="section-top"><h2 className="list-heading">{query ? '검색 결과' : '음료 목록'}</h2><span className="muted">{results.length}개 조합</span></div>
          {results.length ? list(results) : <SearchEmpty onCustom={() => openEditor({ custom: true })} />}
        </section><p className="footnote">아메리카노·라떼는 에스프레소 60mL에 물·우유를 더하는 예시예요. 용량만 늘어도 카페인이 늘어난다고 가정하지 않아요. 실제 샷 수·추출 방식이나 음료 라벨을 알면 총 카페인을 수정해 주세요.</p>
      </div>}
      {tab === 'history' && <div className="stack"><div className="page-heading"><div className="eyebrow">SIP BY SIP</div><h1>차곡차곡, 내 기록</h1><p>한 잔씩 남긴 나의 일주일이에요.</p></div>
        <section className="card"><h2>최근 7일 카페인 섭취량</h2><div className="week-bars">{days.map(day => <button key={day.date} aria-label={`${day.date} 카페인 ${Math.round(day.caffeineMg)}mg, 줄이기 시각 이후 ${day.late}건`} onClick={() => setHistoryDate(day.date)} aria-pressed={historyDate === day.date}><span>{Math.round(day.caffeineMg)}</span><i style={{ height: `${Math.max(3, day.caffeineMg / Math.max(400, ...days.map(d => d.caffeineMg)) * 90)}px` }} /><small>{day.date.slice(5).replace('-', '/')}</small></button>)}</div><p className="help">숫자는 섭취한 mg이에요. 생활 목표 시각 이후 기록 {days.reduce((s, d) => s + d.late, 0)}건 · 수면 영향을 측정한 통계는 아니에요.</p></section>
        <label className="field">기록 날짜<input type="date" value={historyDate} max={dateKey(now)} onChange={e => setHistoryDate(e.target.value)} /></label>
        <div className="history-summary"><strong>{formatMg(totals(state.records, historyDate).caffeineMg)}mg</strong><span>물·음료 {(totals(state.records, historyDate).waterMl + totals(state.records, historyDate).drinksMl).toLocaleString()}mL</span></div>
        {state.records.filter(r => dateKey(Date.parse(r.consumedAt)) === historyDate).sort((a, b) => b.consumedAt.localeCompare(a.consumedAt)).map(r => <article className="history-row" key={r.id}><div className="record-time">{formatTime(Date.parse(r.consumedAt))}<Icon name={r.kind === 'water' ? 'drop' : 'cup'} size={19} /></div><div><h3>{r.name}</h3><p>{r.caffeineMg}mg · {r.volumeMl}mL{r.volumeEstimated ? ' (용량 추정)' : ''}</p><small className="muted">{r.sourceUrl ? `출처가 있는 기록 · 확인 ${r.sourceCheckedAt}` : '직접 입력값'}</small><div className="record-actions"><button disabled={busy} onClick={() => openEditor({ record: r })} aria-label={`${r.name} 수정`}>수정</button><button disabled={busy} className="danger" aria-label={`${r.name} 삭제`} onClick={() => setConfirm({ title: '이 기록을 삭제할까요?', description: `${r.name} 기록을 삭제하고 예상 잔여량을 다시 계산해요.`, label: '기록 삭제', apply: () => commit(s => ({ ...s, records: s.records.filter(v => v.id !== r.id) }), 'record_deleted', '기록을 삭제했어요.') })}>삭제</button></div></div></article>)}
        {!state.records.some(r => dateKey(Date.parse(r.consumedAt)) === historyDate) && <div className="gentle-empty"><Icon name="history" size={32} /><h2>이날 남긴 한 잔이 없어요</h2><p>마신 음료를 찾아 시각과 함께 남겨보세요.</p><button className="secondary" onClick={() => changeTab('search')}>음료 기록하기</button></div>}
      </div>}
      {tab === 'settings' && <Settings state={state} busy={busy} save={preferences => commit(s => ({ ...s, preferences }), 'preferences_saved', '설정을 저장했어요.')} restore={next => setConfirm({ title: '백업으로 교체할까요?', description: `검증된 기록 ${next.records.length}건과 설정으로 현재 기록 ${state.records.length}건을 교체해요. 현재 기록을 먼저 백업해 주세요.`, label: '백업으로 교체', apply: () => commit(() => next, 'backup_restored', '백업을 복원했어요.') })} clear={() => setConfirm({ title: '모든 자료를 삭제할까요?', description: '이 기기의 기록, 즐겨찾기, 설정을 모두 삭제해요. 내보낸 백업 파일은 남아 있어요.', label: '전체 삭제', apply: () => commit(initialState, 'records_cleared', '기록과 설정을 삭제했어요.') })} />}
    </main>
    {error && <div className="global-error" role="alert">{error}</div>}
    {toast && <div className="toast" role="status">{toast}</div>}
    <nav className="bottom-nav" aria-label="주 메뉴">{([{ id: 'today', label: '오늘', icon: 'home' }, { id: 'search', label: '음료 찾기', icon: 'search' }, { id: 'history', label: '기록', icon: 'history' }, { id: 'settings', label: '설정', icon: 'settings' }] as const).map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => changeTab(item.id)} disabled={busy}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>)}</nav>
    {editor && <RecordEditor editor={editor} state={state} now={now} busy={busy} saveError={error} onSave={saveRecord} onClose={() => { if (!saving.current) setEditor(null); }} onFavorite={favorite} />}
    {confirm && <Sheet title={confirm.title} busy={busy} onClose={() => setConfirm(null)}><div className="stack"><p>{confirm.description}</p>{error && <p className="error" role="alert">{error}</p>}<Button disabled={busy} display="block" onClick={async () => { if (await confirm.apply()) { setConfirm(null); if (tab === 'settings') { setTab('today'); } } }}>{busy ? '저장 중…' : confirm.label}</Button><button disabled={busy} className="secondary" onClick={() => setConfirm(null)}>취소</button></div></Sheet>}
  </div>;
}
function SearchEmpty({ onCustom }: { onCustom: () => void }) {
  useEffect(() => { const timer = setTimeout(() => track('search_empty'), 700); return () => clearTimeout(timer); }, []);
  return <div className="gentle-empty"><Icon name="search" size={30} /><h2>아직 등록되지 않은 음료예요</h2><p>음료 종류로 다시 찾거나, 함량을 확인해 직접 입력해 주세요.</p><button className="secondary" onClick={onCustom}>음료 직접 입력</button></div>;
}
