import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Button as TDSButton, ConfirmDialog, TextField } from '@toss/tds-mobile';
import { addBook, changeRound, checkpointTimer, currentPage, deleteEntry, entriesFor, entryPages, formatDuration, formatReadingMinutes, initialState, koreanDate, monthDates, monthSummary, remaining, representative, reread, roundPages, roundSeconds, saveEntry, validDate, validGoal, weekStats } from './engine';
import { useReadingTimer } from './useReadingTimer';
import type { ReadingClock } from './timer';
import { backupJSON, parseBackup, StateSession } from './storage';
import { closeApp, createStore, native, openSource, saveFile, setupNavigation, track, type EventName } from './platform';
import { searchBooks } from './search';
import { cardPNG } from './card';
import { BannerAd } from './BannerAd';
import type { Book, BookResult, ReadingRound, State } from './types';

type View = { type: 'today' | 'library' | 'calendar' | 'add' | 'settings' } | { type: 'detail' | 'complete'; roundId: string };
type Commit = (update: (s: State) => State, event?: EventName) => Promise<boolean>;
type Confirm = (title: string, description: string, action: () => Promise<void> | void, label?: string) => void;
type Draft = { date: string; page: string; note: string };
const message = (e: unknown) => e instanceof Error ? e.message : '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const labels = { reading: '읽는 중', completed: '완독', paused: '중단' };
const submit = (action: () => void) => (event: FormEvent) => { event.preventDefault(); action(); };

function Button({ variant, style, ...props }: ComponentProps<typeof TDSButton>) {
  return <TDSButton {...props} variant={variant} style={{ minHeight: 44, '--button-background-color': variant === 'weak' ? '#e6eddd' : '#2f6b4f', '--button-color': variant === 'weak' ? '#2f6b4f' : '#fff', '--button-gradient-color': '#224e3a', ...style } as CSSProperties}/>;
}

function Field({ label, value, onChange, numeric = false, help, required = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean; help?: string; required?: boolean }) {
  return <TextField variant="box" label={label} labelOption="sustain" paddingTop={0} paddingBottom={0} aria-label={label} value={value} onChange={e => onChange(e.target.value)} inputMode={numeric ? 'numeric' : 'text'} type="text" required={required} maxLength={numeric ? 7 : 300} help={help}/>;
}
function Cover({ book, large = false }: { book: Book | BookResult; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`book-cover ${large ? 'large' : ''}`} aria-hidden="true">{book.thumbnail && !failed ? <img src={book.thumbnail} alt="" onError={() => setFailed(true)}/> : <><span className="cover-line"/><span>{book.title.slice(0, 24)}</span><small>한 장씩,<br/>나의 속도로.</small></>}</div>;
}
function Empty({ title, children }: { title: string; children?: ReactNode }) { return <section className="empty"><div className="book-drawing" aria-hidden="true">⌑</div><h2>{title}</h2>{children}</section>; }
function BookIcon() { return <svg data-icon="book" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5.5C9 3.5 5 3.5 2.5 4.5v15c2.5-1 6.5-1 9.5 1 3-2 7-2 9.5-1v-15c-2.5-1-6.5-1-9.5 1Z"/><path d="M12 5.5v15"/></svg>; }
function CalendarIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2m4 0h2m-8 3h2"/></svg>; }

export function App() {
  const [state, setState] = useState<State | null>(null);
  const session = useRef<StateSession>();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ type: 'today' });
  const [selected, setSelected] = useState<string>();
  const [dialog, setDialog] = useState<{ title: string; description: string; action: () => Promise<void> | void; label: string }>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const opened = useRef(performance.now());
  const firstSavePending = useRef(true);
  const startedWithBook = useRef(false);
  const appOpenLogged = useRef(false);
  const identity = useRef<string>();
  const stateRef = useRef(state); stateRef.current = state;
  const viewRef = useRef(view); viewRef.current = view;
  const dialogRef = useRef(dialog); dialogRef.current = dialog;
  const [today, setToday] = useState(koreanDate());
  const [calendarDate, setCalendarDate] = useState(koreanDate());

  useEffect(() => {
    let active = true;
    setError(''); setState(null); session.current = undefined;
    createStore().then(async store => {
      const loaded = await store.load();
      if (!active) return;
      if (identity.current !== store.identity) { setDrafts({}); setSelected(undefined); }
      identity.current = store.identity;
      session.current = new StateSession(loaded, store); setState(loaded);
      if (!appOpenLogged.current) { startedWithBook.current = loaded.rounds.some(r => r.status === 'reading'); track('app_open'); appOpenLogged.current = true; }
    }).catch(e => { if (active) setError(`기록을 열지 못했어요. ${message(e)}`); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    history.replaceState({ todayPages: { type: 'today' } }, '');
    const pop = (e: PopStateEvent) => { if (locked.current) { history.pushState({ todayPages: viewRef.current }, ''); return; } setView(e.state?.todayPages ?? { type: 'today' }); setError(''); setNotice(''); };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    const back = () => {
      if (locked.current) return;
      if (dialogRef.current) { setDialog(undefined); return; }
      if (viewRef.current.type === 'today') {
        if (session.current?.state.timer) void timer.pause().then(saved => { if (saved) closeApp(); });
        else closeApp();
      } else history.back();
    };
    return setupNavigation(back);
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      setToday(koreanDate());
      if (native && !locked.current) {
        void createStore().then(store => {
          if (active && store.identity !== identity.current) { setState(null); session.current = undefined; setAttempt(n => n + 1); }
        }).catch(() => { if (active) { session.current = undefined; setState(null); setError('사용자 기록을 확인하지 못했어요. 다시 열어 주세요.'); } });
      }
    };
    const timer = window.setInterval(() => setToday(koreanDate()), 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  function go(next: View) {
    if (locked.current) return;
    if (next.type === 'today') setSelected(undefined);
    history.pushState({ todayPages: next }, ''); setView(next); setError(''); setNotice(''); window.scrollTo(0, 0);
  }
  const confirm: Confirm = (title, description, action, label = '확인') => setDialog({ title, description, action, label });
  const commit: Commit = async (update, event) => {
    if (locked.current || !session.current) return false;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = await session.current.commit(update); setState(next);
      if (event) {
        track(event, event === 'record_saved' && firstSavePending.current && startedWithBook.current ? performance.now() - opened.current : undefined);
        if (event === 'record_saved') firstSavePending.current = false;
      }
      return true;
    } catch (e) { setError(message(e)); return false; }
    finally { locked.current = false; setBusy(false); }
  };
  async function perform(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(message(e)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function exportBackup(source = stateRef.current!) {
    const snapshot = source.timer && timer.clock?.id === source.timer.id ? checkpointTimer(source, source.timer.id, timer.clock.elapsed()) : source;
    await saveFile(new TextEncoder().encode(backupJSON(snapshot)), `today-pages-${koreanDate()}.json`, 'application/json');
    track('backup_exported');
  }
  const timer = useReadingTimer(state, session, locked, commit, setState, setError, setNotice);

  if (!state) return <main className="shell loading"><p className="eyebrow">오늘 몇 쪽</p><h1>내 책갈피를<br/>펼치고 있어요.</h1>{error ? <><p role="alert" className="alert">{error}</p><Button onClick={() => setAttempt(n => n + 1)}>다시 열기</Button></> : <p role="status">기록을 불러오는 중이에요.</p>}</main>;
  const reading = state.rounds.filter(r => r.status === 'reading');
  const current = reading.find(r => r.id === selected) ?? reading.find(r => r.id === state.timer?.roundId) ?? representative(state);
  const round = 'roundId' in view ? state.rounds.find(r => r.id === view.roundId) : undefined;
  const book = round ? state.books.find(b => b.id === round.bookId) : undefined;
  return <div className="shell">
    <header className="topbar"><button className="wordmark" onClick={() => go({ type: 'today' })}>오늘 몇 쪽<span className="brand-dot"/></button><button className="icon-button" aria-label="설정" onClick={() => go({ type: 'settings' })} disabled={busy}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 2 3h3l1-3 3-1 2-3-2-2 1-3-2-3-3 1-2-3Z"/><circle cx="12" cy="11.5" r="3"/></svg></button></header>
    <main id="main">
      {error && <div className="alert" role="alert">{error}<button aria-label="오류 안내 닫기" onClick={() => setError('')}>×</button></div>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {state.timer && (view.type !== 'today' || current?.id !== state.timer.roundId) && <button className="timer-banner" onClick={() => go({ type: 'today' })}>◷ {state.books.find(b => b.id === state.rounds.find(r => r.id === state.timer!.roundId)?.bookId)?.title} · 타이머로 돌아가기 →</button>}
      {view.type === 'today' && <>
        <div className={`intro ${reading.length > 1 ? 'compact' : ''}`}><p className="eyebrow">{today.replaceAll('-', '.')} · 나의 독서 노트</p><h1>오늘은 어디까지<br/>읽었나요<span className="green">?</span></h1></div>
        {current ? <>
          {reading.length > 1 && <div className="book-switch" aria-label="읽는 책 선택">{reading.map(r => <button key={r.id} disabled={busy} aria-pressed={r.id === current.id} onClick={() => setSelected(r.id)}>{state.books.find(b => b.id === r.bookId)!.title}</button>)}</div>}
          <CurrentBook state={state} round={current} onDetail={() => go({ type: 'detail', roundId: current.id })}/>
          {state.timer?.roundId === current.id && timer.clock ? <TimerPanel key={state.timer.id} state={state} clock={timer.clock} busy={busy} pause={timer.pause} resume={timer.resume} finish={timer.finish} confirm={confirm} commit={commit} onSaved={() => setDrafts(values => { const next = { ...values }; delete next[current.id]; return next; })}/> : <>
            <RecordForm key={current.id} state={state} round={current} today={today} busy={busy} commit={commit} draft={drafts[current.id]} onDraft={draft => setDrafts(v => ({ ...v, [current.id]: draft }))}/>
            <button className="timer-launch" disabled={busy || !!state.timer} onClick={() => void timer.begin(current.id)}>◷ 독서 타이머 시작</button>
          </>}
          {remaining(state, current)?.pages === 0 && <button className="text-button" onClick={() => go({ type: 'detail', roundId: current.id })}>마지막 장까지 왔어요. 완독 남기기 →</button>}
        </> : <Empty title="첫 책갈피를 꽂아볼까요?"><p>지금 읽고 있는 책 한 권이면 충분해요.</p><Button display="block" onClick={() => go({ type: 'add' })}>읽고 있는 책 추가하기</Button></Empty>}
        <Week state={state} today={today}/>
        <button className="add-link" onClick={() => go({ type: 'add' })} disabled={busy}><span>＋</span> 다른 책도 읽고 있나요?</button>
      </>}
      {view.type === 'add' && <AddBook state={state} today={today} busy={busy} commit={commit} go={go} setError={setError}/>}
      {view.type === 'library' && <Library state={state} busy={busy} go={go}/>}
      {view.type === 'calendar' && <ReadingCalendar state={state} today={today} go={go} selectedDate={calendarDate} onSelect={setCalendarDate}/>}
      {view.type === 'detail' && round && book && <Detail key={round.id} state={state} round={round} book={book} today={today} busy={busy} commit={commit} confirm={confirm} go={go}/>}
      {view.type === 'complete' && round && book && <>
        <p className="eyebrow">한 권의 마지막 장</p><h1>완독을 축하해요.</h1><p className="muted">책을 덮어도, 읽은 날들은 남아요.</p>
        <section className="completion-card"><div className="leaf-mark" aria-hidden="true">✳</div><span className="eyebrow">나의 완독 기록</span><h2>{book.title}</h2><p>{book.authors.join(', ')}</p><div className="card-number">{roundPages(state, round)}<small>쪽을 기록했어요</small></div>{roundSeconds(state, round.id) > 0 && <p className="completion-time">{formatDuration(roundSeconds(state, round.id))} 동안 읽었어요.</p>}<p className="dates">{round.startedOn} — {round.completedOn}</p>{round.review && <blockquote>{round.review}</blockquote>}<footer>오늘 몇 쪽 · 한 장씩, 나의 속도로.</footer></section>
        <Button display="block" loading={busy} onClick={() => void perform(async () => { await saveFile(await cardPNG(state, round), `today-pages-${round.completedOn}.png`, 'image/png'); setNotice('완독 카드 저장을 마쳤어요.'); })}>완독 카드 PNG 저장</Button>
        <button className="text-button" onClick={() => go({ type: 'detail', roundId: round.id })}>책 기록으로 돌아가기</button>
      </>}
      {view.type === 'settings' && <Settings key={attempt} state={state} busy={busy} commit={commit} confirm={confirm} perform={perform} exportBackup={exportBackup} setNotice={setNotice} go={go}/>}
      {'roundId' in view && !round && <Empty title="이 책의 기록을 찾을 수 없어요."><Button onClick={() => go({ type: 'library' })}>서재로 가기</Button></Empty>}
    </main>
    {(view.type === 'today' || view.type === 'library' || view.type === 'calendar') && <BannerAd/>}
    <nav className="bottom-nav" aria-label="주 메뉴"><button disabled={busy} aria-current={view.type === 'today' ? 'page' : undefined} onClick={() => go({ type: 'today' })}><span aria-hidden="true">⌂</span>오늘</button><button disabled={busy} aria-current={view.type === 'library' || 'roundId' in view ? 'page' : undefined} onClick={() => go({ type: 'library' })}><span><BookIcon/></span>내 서재</button><button disabled={busy} aria-current={view.type === 'calendar' ? 'page' : undefined} onClick={() => go({ type: 'calendar' })}><span><CalendarIcon/></span>달력</button><button disabled={busy} aria-current={view.type === 'add' ? 'page' : undefined} onClick={() => go({ type: 'add' })}><span aria-hidden="true">＋</span>책 추가</button></nav>
    <ConfirmDialog open={!!dialog} title={dialog?.title} description={dialog?.description} onClose={() => { if (!busy) setDialog(undefined); }} closeOnBackEvent={false} cancelButton={<Button size="medium" variant="weak" disabled={busy} onClick={() => setDialog(undefined)}>취소</Button>} confirmButton={<Button size="medium" disabled={busy} onClick={() => { const action = dialog?.action; setDialog(undefined); void action?.(); }}>{dialog?.label}</Button>}/>
  </div>;
}

function CurrentBook({ state, round, onDetail }: { state: State; round: ReadingRound; onDetail: () => void }) {
  const book = state.books.find(b => b.id === round.bookId)!;
  const page = currentPage(state, round);
  const left = remaining(state, round);
  return <section className="current-book"><Cover book={book}/><div className="book-info"><span className="tag">{labels[round.status]}</span><h2><button onClick={onDetail}>{book.title}</button></h2><p>{book.authors.join(', ') || '나의 책'}</p><div className="page-count"><strong>{page}</strong><span>{book.totalPages ? ` / ${book.totalPages}쪽` : '쪽까지 읽었어요'}</span></div>{book.totalPages && <progress aria-label="독서 진행률" value={page} max={book.totalPages}/>}</div>{left && <p className="next-reading">{left.pages === 0 ? '마지막 장까지 도착했어요.' : <>남은 {left.pages}쪽{left.sessions !== null && <> · 하루 {round.dailyGoal}쪽씩, <strong>{left.sessions}번 더 읽으면 완독</strong></>}</>}</p>}</section>;
}

function RecordForm({ state, round, today, busy, commit, draft, onDraft, editingDate, done }: { state: State; round: ReadingRound; today: string; busy: boolean; commit: Commit; draft?: Draft; onDraft?: (draft: Draft) => void; editingDate?: string; done?: () => void }) {
  const old = editingDate ? state.entries.find(e => e.roundId === round.id && e.date === editingDate) : undefined;
  const [local, setLocal] = useState<Draft>(draft ?? { date: editingDate ?? today, page: old ? String(old.page) : '', note: old?.note ?? '' });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const value = draft ?? local;
  const change = (patch: Partial<Draft>) => { const next = { ...value, ...patch }; setLocal(next); onDraft?.(next); setSaved(false); setFormError(''); };
  const dateEntry = state.entries.find(e => e.roundId === round.id && e.date === value.date);
  async function save() {
    if (!/^\d+$/.test(value.page)) { change({ page: value.page }); return; }
    const note = value.note || (!editingDate && dateEntry ? dateEntry.note : '');
    if (!editingDate && value.date === today && Number(value.page) < currentPage(state, round)) { setFormError('앞으로 읽은 페이지를 입력해 주세요. 페이지 정정은 책 상세의 기록 수정에서 할 수 있어요.'); return; }
    if (dateEntry && dateEntry.page === Number(value.page) && dateEntry.note === note) { setSaved(true); done?.(); return; }
    if (await commit(s => saveEntry(s, round.id, value.date, Number(value.page), note, koreanDate(), now(), id()), 'record_saved')) { setSaved(true); done?.(); }
  }
  return <form className="paper record-form" onSubmit={submit(() => void save())}>
    <div className="section-head"><h2>{editingDate ? '기록 수정' : '오늘의 책갈피'}</h2><span className="muted">{value.date.replaceAll('-', '.')}</span></div>
    <Field label="어디까지 읽었나요?" value={value.page} onChange={page => change({ page })} numeric required help={`마지막 기록 ${currentPage(state, round)}쪽 · 도달한 페이지를 남겨요.`}/>
    <details className="record-options" open={editingDate ? true : undefined}><summary>날짜·감상 {editingDate ? '수정' : '남기기 (선택)'}</summary><label className="native-label">독서 날짜<input aria-label="독서 날짜" type="date" value={value.date} min={round.startedOn} max={today} disabled={!!editingDate} onChange={e => change({ date: e.target.value })}/></label><label className="native-label">짧은 감상<textarea aria-label="짧은 감상" value={value.note} placeholder="오늘 마음에 남은 생각" maxLength={2000} onChange={e => change({ note: e.target.value })}/></label></details>
    <Button type="submit" display="block" loading={busy} disabled={!/^\d+$/.test(value.page) || busy}>{editingDate ? '수정 저장' : '책갈피 남기기'}</Button>
    {formError && <p className="alert" role="alert">{formError}</p>}
    {saved && dateEntry && <p role="status" aria-label="독서 기록 저장 결과" className="saved">✓ {value.date === today ? '오늘' : value.date} {entryPages(state, dateEntry)}쪽 읽었어요.</p>}
  </form>;
}

function Week({ state, today }: { state: State; today: string }) {
  const stats = weekStats(state, today);
  return <section className="week"><div className="section-head"><h2>이번 주, 읽은 날들</h2><span>{stats.pages}쪽 · {stats.days.size}일{stats.seconds > 0 && <> · {formatDuration(stats.seconds)}</>}</span></div><div className="week-days">{stats.dates.map((date, i) => <div key={date} className={stats.days.has(date) ? 'read' : ''}><span>{'월화수목금토일'[i]}</span><b aria-label={`${date}${stats.days.has(date) ? ' 읽음' : ' 기록 없음'}`} className={date === today ? 'is-today' : ''}>{stats.days.has(date) ? '✓' : date.slice(-2)}</b></div>)}</div><p className="muted">조금 읽은 날도, 쉬어가는 날도 괜찮아요.</p></section>;
}

function TimerPanel({ state, clock, busy, pause, resume, finish, confirm, commit, onSaved }: { state: State; clock: ReadingClock; busy: boolean; pause: () => Promise<boolean>; resume: () => Promise<void>; finish: (page: number, note: string) => Promise<boolean>; confirm: Confirm; commit: Commit; onSaved: () => void }) {
  const active = state.timer!;
  const [tick, setTick] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [page, setPage] = useState('');
  const [note, setNote] = useState(state.entries.find(e => e.roundId === active.roundId && e.date === active.date)?.note ?? '');
  useEffect(() => { const interval = window.setInterval(() => setTick(v => v + 1), 1000); return () => clearInterval(interval); }, []);
  const seconds = Math.floor(clock.elapsed() / 1000);
  const display = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  return <section className="paper timer-panel" data-tick={tick}>
    <div className="section-head"><h2>독서 타이머</h2><span className={clock.running ? 'timer-running' : ''}>{clock.running ? '측정 중' : '일시정지'}</span></div>
    <p className="timer-date">{active.date} · {active.startedPage}쪽부터 읽는 중</p>
    <div role="timer" aria-label="독서 측정 시간" aria-live="off" className="timer-display">{display}</div>
    <p className="muted timer-help">앱을 벗어나면 자동으로 멈춰요.<br/>다시 열면 저장된 시간에서 이어 읽을 수 있어요.</p>
    {!finishing ? <><div className="action-row">{clock.running ? <Button variant="weak" disabled={busy} onClick={() => void pause()}>일시정지</Button> : <Button variant="weak" disabled={busy || active.date !== koreanDate()} onClick={() => void resume()}>이어서 측정</Button>}<Button disabled={busy} onClick={async () => { if (await pause()) setFinishing(true); }}>독서 마치기</Button></div><button className="text-button timer-discard" disabled={busy} onClick={() => confirm('측정 시간을 버릴까요?', '현재 타이머의 시간만 지워요. 이미 저장한 페이지와 독서 기록은 유지해요.', async () => { await commit(s => ({ ...s, timer: null })); }, '측정 버리기')}>이번 측정 버리기</button></> : <form onSubmit={submit(() => void (async () => { if (/^\d+$/.test(page) && await finish(Number(page), note)) onSaved(); })())}>
      <p className="timer-result">{formatDuration(seconds)} 읽었어요. 마지막 페이지를 남겨주세요.</p>
      <Field label="타이머 종료 페이지" value={page} onChange={setPage} numeric required help={`${active.startedPage}쪽부터 어디까지 읽었나요?`}/>
      {/^\d+$/.test(page) && Number(page) >= active.startedPage && <p className="timer-pages">이번에 읽은 분량 <strong>{Number(page) - active.startedPage}쪽</strong></p>}
      <label className="native-label">타이머 감상 (선택)<textarea aria-label="타이머 감상" value={note} onChange={e => setNote(e.target.value)} maxLength={2000}/></label>
      <Button type="submit" display="block" loading={busy} disabled={busy || !/^\d+$/.test(page)}>시간과 페이지 저장</Button>
      <button type="button" className="text-button" onClick={() => setFinishing(false)}>측정 화면으로 돌아가기</button>
    </form>}
  </section>;
}

function ReadingCalendar({ state, today, go, selectedDate, onSelect: setSelectedDate }: { state: State; today: string; go: (view: View) => void; selectedDate: string; onSelect: (date: string) => void }) {
  const [month, setMonth] = useState(selectedDate.slice(0, 7));
  const [mode, setMode] = useState<'calendar' | 'books'>('calendar');
  const dates = monthDates(month);
  const summary = monthSummary(state, month);
  const selectedEntries = state.entries.filter(e => e.date === selectedDate);
  const monthLabel = month === today.slice(0, 7) ? '이번 달' : `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`;
  function changeMonth(offset: number) {
    const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset);
    const next = date.toISOString().slice(0, 7); setMonth(next); setSelectedDate(next === today.slice(0, 7) ? today : `${next}-01`);
  }
  return <><p className="eyebrow">독서 달력</p><h1 className="monthly-summary">{monthLabel} {summary.books.length}권,{' '}<br/><span className="green">{formatReadingMinutes(summary.seconds)}</span> 책을 읽었어요!</h1>
    <section className="paper calendar-panel"><div className="calendar-heading"><button className="icon-button" aria-label="이전 달" onClick={() => changeMonth(-1)}>‹</button><h2>{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</h2><button className="icon-button" aria-label="다음 달" disabled={month >= today.slice(0, 7)} onClick={() => changeMonth(1)}>›</button></div>
      <div className="segmented calendar-mode" role="group" aria-label="독서 달력 보기 방식"><button aria-pressed={mode === 'calendar'} onClick={() => setMode('calendar')}>달력 보기</button><button aria-pressed={mode === 'books'} onClick={() => setMode('books')}>월별 책 보기</button></div>
      {mode === 'calendar' ? <div className="calendar-grid" aria-label="날짜별 독서 기록">{[...'월화수목금토일'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}{dates.map(date => {
        const entries = state.entries.filter(e => e.date === date);
        const books = new Set(entries.map(e => state.rounds.find(r => r.id === e.roundId)!.bookId)).size;
        return <button key={date} aria-label={`${date}${books ? ` 독서 ${books}권` : ' 기록 없음'}`} aria-pressed={date === selectedDate} disabled={date > today} className={`calendar-day ${date.startsWith(month) ? '' : 'outside-month'} ${date === today ? 'today' : ''}`} onClick={() => { setSelectedDate(date); setMonth(date.slice(0, 7)); }}><time dateTime={date}>{Number(date.slice(-2))}</time><span className="calendar-dots" aria-hidden="true">{Array.from({ length: Math.min(books, 3) }, (_, i) => <i key={i}/>)}</span></button>;
      })}</div> : <div className="monthly-books" aria-label="월별 독서한 책">{summary.books.length ? summary.books.map(({ book, latest, pages, seconds }) => <button key={book.id} className="library-row" onClick={() => go({ type: 'detail', roundId: latest.roundId })}><Cover book={book}/><span><b>{book.title}</b><span className="monthly-last-page">{latest.page}쪽까지 읽었어요.</span><small>이달 {pages}쪽 · {seconds > 0 ? formatReadingMinutes(seconds) : '시간 기록 없음'}</small><small>마지막 기록 {latest.date.replaceAll('-', '.')}</small></span><span aria-hidden="true">›</span></button>) : <p className="calendar-empty">이달에 남긴 독서 기록이 없어요.</p>}</div>}
    </section>
    {mode === 'calendar' && <>
    <div className="section-head calendar-date-heading"><h2>{selectedDate.replaceAll('-', '.')}의 독서</h2><span>{selectedEntries.length}개의 책갈피</span></div>
    {selectedEntries.length ? <div className="calendar-records">{selectedEntries.map(entry => {
      const round = state.rounds.find(r => r.id === entry.roundId)!; const book = state.books.find(b => b.id === round.bookId)!;
      return <button key={entry.id} className="library-row" onClick={() => go({ type: 'detail', roundId: round.id })}><Cover book={book}/><span><b>{book.title}</b><span className="calendar-record-stats">{entryPages(state, entry)}쪽 · {entry.readingSeconds > 0 ? formatDuration(entry.readingSeconds) : '시간 기록 없음'}</span><small>{entry.page}쪽까지 읽었어요.</small>{entry.note && <span className="calendar-note">{entry.note}</span>}</span><span aria-hidden="true">›</span></button>;
    })}</div> : <p className="calendar-empty">이날은 남긴 독서 기록이 없어요.<br/>다음 책갈피는 천천히 남겨도 괜찮아요.</p>}
    </>}
  </>;
}

function AddBook({ state, today, busy, commit, go, setError }: { state: State; today: string; busy: boolean; commit: Commit; go: (v: View) => void; setError: (v: string) => void }) {
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const request = useRef<AbortController>();
  const [picked, setPicked] = useState<BookResult>();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [total, setTotal] = useState('');
  const [startPage, setStartPage] = useState('0');
  const [startedOn, setStartedOn] = useState(today);
  useEffect(() => () => request.current?.abort(), []);
  async function search(nextPage = 1) {
    const q = nextPage === 1 ? query.trim() : submitted;
    if (!q) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setSearching(true); setSearchError(''); setPicked(undefined);
    if (nextPage === 1) { setResults([]); setSearched(false); setSubmitted(q); }
    try {
      const result = await searchBooks(q, nextPage, controller.signal);
      if (controller.signal.aborted) return;
      setResults(old => nextPage === 1 ? result.books : [...old, ...result.books]); setPage(nextPage); setHasMore(result.hasMore); setSearched(true);
    } catch (e) { if (!controller.signal.aborted) setSearchError(message(e)); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  }
  function pick(result: BookResult) {
    const duplicate = result.isbn ? state.books.find(b => b.isbn === result.isbn) : undefined;
    if (duplicate) { const rounds = state.rounds.filter(r => r.bookId === duplicate.id); const existing = rounds.find(r => r.status !== 'completed') ?? rounds.at(-1); if (existing) { go({ type: 'detail', roundId: existing.id }); return; } }
    setPicked(result); setTitle(result.title); setAuthor(result.authors.join(', '));
  }
  async function register() {
    setError('');
    if (!/^\d+$/.test(startPage) || (total !== '' && !/^\d+$/.test(total))) { setError('쪽수는 0 이상의 정수로 입력해 주세요.'); return; }
    if (!validDate(startedOn) || startedOn > today) { setError('읽기 시작일은 오늘 또는 지난 날짜로 입력해 주세요.'); return; }
    const bookId = id(); const roundId = id();
    const book: Book = { ...picked, id: bookId, title, authors: author.split(',').map(v => v.trim()).filter(Boolean), totalPages: total === '' ? undefined : Number(total) };
    if (await commit(s => addBook(s, book, { id: roundId, bookId, startedOn, initialPage: Number(startPage), status: 'reading', dailyGoal: s.settings.dailyGoal, lastRecordedAt: now() }), 'book_added')) go({ type: 'today' });
  }
  return <><p className="eyebrow">새로운 책갈피</p><h1>어떤 책을<br/>읽고 있나요?</h1><div className="segmented"><button aria-pressed={mode === 'search'} onClick={() => { setMode('search'); setPicked(undefined); }}>도서 검색</button><button aria-pressed={mode === 'manual'} onClick={() => { request.current?.abort(); setSearching(false); setMode('manual'); setPicked(undefined); setTitle(''); setAuthor(''); }}>직접 입력</button></div>
    {mode === 'search' && <><form className="search-form" onSubmit={submit(() => void search())}><Field label="제목·저자·ISBN 검색" value={query} onChange={setQuery} required/><Button type="submit" disabled={searching || !query.trim()}>검색</Button></form>{searchError && <p role="alert" className="alert">{searchError}<button onClick={() => void search()}>다시 검색</button></p>}{searching && <p role="status">책을 찾고 있어요.</p>}{searched && !results.length && <p>검색 결과가 없어요. 제목을 바꾸거나 직접 입력해 주세요.</p>}<div className="search-results">{results.map((result, i) => <button key={`${result.isbn}-${i}`} className="search-row" onClick={() => pick(result)}><Cover book={result}/><span><b>{result.title}</b><small>{result.authors.join(', ')}</small>{result.isbn && state.books.some(b => b.isbn === result.isbn) && <span className="tag">내 서재에 있어요</span>}</span><span aria-hidden="true">＋</span></button>)}</div>{hasMore && <button className="text-button" disabled={searching} onClick={() => void search(page + 1)}>더 찾기</button>}</>}
    {(mode === 'manual' || picked) && <form className="paper book-form" onSubmit={submit(() => void register())}><h2>{picked ? '책 정보를 확인해 주세요' : '나만의 책을 등록해요'}</h2><Field label="책 제목" value={title} onChange={setTitle} required/><Field label="저자 (선택)" value={author} onChange={setAuthor}/><Field label="전체 쪽수 (선택)" value={total} onChange={setTotal} numeric help="검색으로 전체 쪽수를 알 수 없어 직접 입력해요."/><Field label="이미 읽은 페이지" value={startPage} onChange={setStartPage} numeric required help="이 페이지부터 앞으로 읽는 분량을 기록해요."/><label className="native-label">읽기 시작일<input aria-label="읽기 시작일" type="date" value={startedOn} max={today} onChange={e => setStartedOn(e.target.value)}/></label>{picked?.sourceUrl && <button type="button" className="text-button" onClick={() => openSource(picked.sourceUrl!)}>도서 정보 출처 · Daum ↗</button>}<Button type="submit" display="block" loading={busy} disabled={!title.trim() || busy}>내 서재에 담기</Button></form>}
  </>;
}

function Library({ state, busy, go }: { state: State; busy: boolean; go: (v: View) => void }) {
  const [filter, setFilter] = useState<ReadingRound['status']>('reading');
  const rounds = state.rounds.filter(r => r.status === filter).sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt));
  return <><p className="eyebrow">차곡차곡 나의 이야기</p><h1>내 서재</h1><div className="segmented">{(['reading', 'completed', 'paused'] as const).map(status => <button key={status} aria-pressed={status === filter} onClick={() => setFilter(status)}>{labels[status]} <small>{state.rounds.filter(r => r.status === status).length}</small></button>)}</div>{rounds.length ? <div className="library-list">{rounds.map(round => { const book = state.books.find(b => b.id === round.bookId)!; return <button key={round.id} className="library-row" disabled={busy} onClick={() => go({ type: 'detail', roundId: round.id })}><Cover book={book}/><span><b>{book.title}</b><small>{book.authors.join(', ')}</small><span>{currentPage(state, round)}{book.totalPages ? ` / ${book.totalPages}` : ''}쪽{roundSeconds(state, round.id) > 0 && <> · {formatDuration(roundSeconds(state, round.id))}</>} · {round.startedOn} 시작</span></span><span aria-hidden="true">›</span></button>; })}</div> : <Empty title={`${labels[filter]} 책이 아직 없어요.`}><p>읽은 날들이 이곳에 쌓일 거예요.</p><Button onClick={() => go({ type: 'add' })}>책 추가하기</Button></Empty>}</>;
}

function Detail({ state, round, book, today, busy, commit, confirm, go }: { state: State; round: ReadingRound; book: Book; today: string; busy: boolean; commit: Commit; confirm: Confirm; go: (v: View) => void }) {
  const [editing, setEditing] = useState<string>();
  const [goal, setGoal] = useState(round.dailyGoal === null ? '' : String(round.dailyGoal));
  const [review, setReview] = useState(round.review ?? '');
  const list = entriesFor(state, round.id).reverse();
  return <><p className="eyebrow">{labels[round.status]} · {round.startedOn} 시작</p><CurrentBook state={state} round={round} onDetail={() => {}}/><div className="summary-line"><span>이번 회차에 남긴 분량</span><b>{roundPages(state, round)}쪽{roundSeconds(state, round.id) > 0 && <> · {formatDuration(roundSeconds(state, round.id))}</>}</b></div>
    {round.status !== 'completed' && <><form className="paper" onSubmit={submit(() => void commit(s => changeRound(s, round.id, { dailyGoal: goal === '' ? null : Number(goal) }))) }><Field label="이 책의 하루 목표 (쪽)" value={goal} onChange={setGoal} numeric help="비워 두면 목표를 끌 수 있어요."/><Button type="submit" size="small" variant="weak" disabled={busy || !validGoal(goal === '' ? null : Number(goal))}>목표 저장</Button></form><div className="action-row"><Button variant="weak" disabled={busy} onClick={() => void commit(s => changeRound(s, round.id, { status: round.status === 'paused' ? 'reading' : 'paused' }))}>{round.status === 'paused' ? '이어서 읽기' : '잠시 중단'}</Button><Button disabled={busy} onClick={() => confirm('이 책을 완독했나요?', `${currentPage(state, round)}쪽까지의 기록으로 완독을 남겨요. 읽지 않은 페이지는 추가하지 않아요.`, async () => { if (await commit(s => changeRound(s, round.id, { status: 'completed', completedOn: today, review }), 'round_completed')) go({ type: 'complete', roundId: round.id }); }, '완독 남기기')}>완독 남기기</Button></div><label className="native-label">완독 감상 (선택)<textarea aria-label="완독 감상" value={review} maxLength={2000} onChange={e => setReview(e.target.value)} placeholder="이 책은 나에게 어떤 책이었나요?"/></label></>}
    {round.status === 'completed' && <div className="paper"><p>{round.completedOn} 완독 · {round.review || '한 권의 기록이 남았어요.'}</p><Button display="block" onClick={() => go({ type: 'complete', roundId: round.id })}>완독 카드 보기</Button><div className="action-row"><button className="text-button" disabled={busy || state.rounds.some(r => r.bookId === book.id && r.status !== 'completed')} onClick={() => confirm('완독을 취소할까요?', '기록을 유지하고 다시 읽는 중으로 바꿔요.', async () => { await commit(s => changeRound(s, round.id, { status: 'reading', completedOn: undefined })); }, '완독 취소')}>완독 취소</button><button className="text-button" disabled={busy || state.rounds.some(r => r.bookId === book.id && r.status !== 'completed')} onClick={async () => { const roundId = id(); if (await commit(s => reread(s, { id: roundId, bookId: book.id, startedOn: today, initialPage: 0, status: 'reading', dailyGoal: s.settings.dailyGoal, lastRecordedAt: now() }))) go({ type: 'today' }); }}>처음부터 다시 읽기</button></div></div>}
    {book.sourceUrl && <button className="text-button" onClick={() => openSource(book.sourceUrl!)}>도서 정보 출처 · Daum ↗</button>}
    <div className="section-head"><h2>날짜별 책갈피</h2><span>{list.length}개의 기록</span></div>
    {editing && <RecordForm key={editing} state={state} round={round} today={today} busy={busy} commit={commit} editingDate={editing} done={() => setEditing(undefined)}/>}
    {!list.length && <p className="muted">첫 페이지 기록을 남겨보세요.</p>}
    {list.map(entry => <article className="entry" key={entry.id}><div className="section-head"><time>{entry.date}</time><b>+{entryPages(state, entry)}쪽{entry.readingSeconds > 0 && <> · {formatDuration(entry.readingSeconds)}</>}</b></div><p>{entry.page}쪽까지 읽었어요.</p>{entry.note && <p className="entry-note">{entry.note}</p>}{round.status !== 'completed' && <div className="entry-actions"><button disabled={busy} onClick={() => setEditing(editing === entry.date ? undefined : entry.date)}>기록 수정</button><button disabled={busy} onClick={() => confirm('이 날짜의 기록을 삭제할까요?', '앞뒤 기록을 기준으로 날짜별 분량을 다시 계산해요.', async () => { if (await commit(s => deleteEntry(s, entry.id))) setEditing(undefined); }, '기록 삭제')}>기록 삭제</button></div>}</article>)}
  </>;
}

function Settings({ state, busy, commit, confirm, perform, exportBackup, setNotice, go }: { state: State; busy: boolean; commit: Commit; confirm: Confirm; perform: (fn: () => Promise<void>) => Promise<void>; exportBackup: (s?: State) => Promise<void>; setNotice: (v: string) => void; go: (v: View) => void }) {
  const [goal, setGoal] = useState(state.settings.dailyGoal === null ? '' : String(state.settings.dailyGoal));
  const [raw, setRaw] = useState('');
  const [candidate, setCandidate] = useState<State>();
  const [importError, setImportError] = useState('');
  const [showBackup, setShowBackup] = useState(false);
  function inspect(text: string) { setImportError(''); setCandidate(undefined); setRaw(text); try { setCandidate(parseBackup(text)); } catch (e) { setImportError(message(e)); } }
  return <><p className="eyebrow">나의 독서 환경</p><h1>설정과 백업</h1><form className="paper" onSubmit={submit(() => void (async () => { if (await commit(s => ({ ...s, settings: { dailyGoal: goal === '' ? null : Number(goal) } }))) setNotice('새로 등록할 책의 기본 목표를 저장했어요.'); })())}><Field label="새 책의 하루 목표 (쪽)" value={goal} onChange={setGoal} numeric help="기본 10쪽. 비워 두면 목표를 끄며, 읽는 책의 목표는 바뀌지 않아요."/><Button type="submit" variant="weak" disabled={busy || !validGoal(goal === '' ? null : Number(goal))}>기본 목표 저장</Button></form>
    <section className="paper"><h2>내 기록 보관하기</h2><p className="muted">이 기기에 저장되며, 기기 변경·앱 데이터 삭제에 대비해 백업이 필요해요. 기기 간 자동 동기화는 제공하지 않아요.</p><p>책 {state.books.length}권 · 독서 회차 {state.rounds.length}개 · 날짜별 기록 {state.entries.length}개</p><Button display="block" disabled={busy} onClick={() => void perform(async () => { await exportBackup(); setNotice('백업 파일 저장을 마쳤어요.'); })}>JSON 백업 파일 저장</Button><button className="text-button" onClick={() => setShowBackup(v => !v)}>백업 내용 직접 확인</button>{showBackup && <textarea aria-label="현재 백업 내용" className="backup-text" readOnly value={backupJSON(state)}/>}</section>
    <section className="paper"><h2>백업에서 복원하기</h2><p className="muted">백업 전체로 현재 기록을 교체해요. 먼저 지금 기록의 백업을 저장하고 확인을 받아요.</p>{state.timer && <p className="muted">기록 교체는 진행 중인 타이머를 먼저 저장하거나 버린 뒤 할 수 있어요.</p>}<label className="file-picker">JSON 백업 파일 선택<input aria-label="JSON 백업 파일 선택" type="file" accept=".json,application/json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setImportError('10MB 이하의 백업 파일을 선택해 주세요.'); setCandidate(undefined); return; } void file.text().then(inspect).catch(() => setImportError('파일을 읽을 수 없어요. JSON 내용을 붙여넣어 주세요.')); }}/></label><label className="native-label">또는 JSON 내용 붙여넣기<textarea aria-label="백업 JSON 내용" value={raw} onChange={e => { setRaw(e.target.value); setCandidate(undefined); setImportError(''); }} placeholder="백업 파일의 내용을 붙여넣으세요."/></label><button className="text-button" disabled={busy || !raw.trim()} onClick={() => inspect(raw)}>복원 내용 확인</button>{importError && <p role="alert" className="alert">{importError}</p>}{candidate && <div className="restore-preview"><p>복원할 내용: 책 {candidate.books.length}권 · 회차 {candidate.rounds.length}개 · 기록 {candidate.entries.length}개</p><Button variant="weak" display="block" disabled={busy || !!state.timer} onClick={() => void perform(async () => {
      await exportBackup(state);
      confirm('백업 내용으로 교체할까요?', '현재 기록의 백업 파일을 저장했어요. 선택한 백업 전체로 교체하며 두 기록을 합치지는 않아요.', async () => {
        if (await commit(() => candidate, 'backup_restored')) { setCandidate(undefined); setRaw(''); go({ type: 'today' }); setNotice('백업 기록을 복원했어요.'); }
      }, '기록 교체');
    })}>현재 기록 백업 후 복원 준비</Button></div>}</section>
    <section className="danger-section"><h2>전체 기록 삭제</h2><p className="muted">이 기기의 현재 사용자 기록을 삭제해요. 삭제 전 백업 파일을 보관해 주세요.</p><button className="text-button danger" disabled={busy} onClick={() => confirm('모든 기록을 삭제할까요?', '책과 독서 기록을 모두 삭제해요. 백업이 없으면 복원할 수 없어요.', async () => { if (await commit(() => initialState())) go({ type: 'today' }); }, '전체 삭제')}>전체 기록 삭제</button></section>
  </>;
}
