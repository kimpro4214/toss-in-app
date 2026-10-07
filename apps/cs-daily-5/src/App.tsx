import { useEffect, useRef, useState } from 'react';
import { Button } from '@toss/tds-mobile';
import { bank, allQuestions, questionById } from './bank';
import { subjects, subjectName } from './subjects';
import { levels, levelLabel, type State, type Session, type Entry, type Question } from './types';
import { koreaDate, isComplete, score, createDailySession, submitAnswer, updateSettings, reviewAnswer, bonusEntries, grantBonus } from './engine';
import { createStore, setupNavigation, closeApp, native, track, openSource, prepareAd, type StateStore, type AdController } from './platform';
import { Diagram } from './Diagrams';
import { StudyPreferences } from './StudyPreferences';
import { selectedSubjects } from './preferences';
import { interviewCourse, interviewProgress } from './interview';
import { InterviewCourse, InterviewAnswer } from './InterviewCourse';

type View = { type: 'home' | 'subjects' | 'review' | 'preferences' | 'interview' } | { type: 'quiz' | 'result'; sessionId: string; index: number } | { type: 'review-question'; questionId: string };
export function App() {
  const [state, setState] = useState<State>();
  const current = useRef<State>();
  const store = useRef<StateStore>();
  const [view, setView] = useState<View>({ type: 'home' });
  const viewRef = useRef(view); viewRef.current = view;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const [filter, setFilter] = useState('all');
  const [today, setToday] = useState(koreaDate());
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    createStore().then(async s => { const data = await s.load(); if (active) { store.current = s; current.current = data; setState(data); setError(''); track('screen', { name: 'home' }); } }).catch(e => { if (active) setError(`기록 준비 실패: ${e.message}. 다시 시도하거나 토스 앱을 업데이트해 주세요.`); });
    return () => { active = false; };
  }, [loadAttempt]);
  const go = (next: View) => { setView(next); window.scrollTo({ top: 0 }); track('screen', { name: next.type }); };
  useEffect(() => setupNavigation(() => viewRef.current.type === 'home' ? void closeApp().catch(console.warn) : go({ type: 'home' }), () => go({ type: 'home' })), []);
  useEffect(() => {
    const refresh = () => setToday(koreaDate());
    const id = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  async function commit(change: (data: State) => State): Promise<boolean> {
    if (!store.current || !current.current || writing.current) return false;
    writing.current = true; setBusy(true); setError('');
    try {
      const next = change(current.current);
      await store.current.save(next);
      current.current = next; setState(next); return true;
    } catch (e) { setError(`저장하지 못했습니다. 다시 시도해 주세요. ${e instanceof Error ? e.message : ''}`); return false; }
    finally { writing.current = false; setBusy(false); }
  }
  function openSession(s: Session) {
    const index = s.entries.findIndex(e => !s.answers[e.questionId]);
    go(index < 0 ? { type: 'result', sessionId: s.id, index: 0 } : { type: 'quiz', sessionId: s.id, index });
  }
  async function start() {
    let session: Session | undefined;
    if (await commit(data => { const next = createDailySession(data, bank, koreaDate()); session = next.session; return next.state; })) {
      openSession(session!); track('daily_start', { mode: session!.settings.mode, level: session!.settings.startLevel, course: session!.settings.courseId ?? '', day: session!.interviewDay ?? 0 });
    }
  }
  const tabs = <nav className="tabs" aria-label="학습 메뉴">{[['home', '오늘', '◉'], ['subjects', '과목', '▦'], ['review', '복습', '↺']].map(([type, label, icon]) => <button key={type} className={view.type === type ? 'active' : ''} onClick={() => go({ type: type as 'home' | 'subjects' | 'review' })}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav>;
  const header = <header className="brand"><a href="#" onClick={e => { e.preventDefault(); go({ type: 'home' }); }} aria-label="오늘의 CS 5 홈"><span className="brand-symbol">cs<span>5</span></span><span>오늘의 CS <b>5</b></span></a>{import.meta.env.DEV && <span className="dev-pill">개발 미리보기</span>}</header>;
  if (!state) return <div className="shell">{header}<main className="loading"><div className="spinner"/><h1>학습 기록을 준비하고 있어요</h1>{error && <><p role="alert">{error}</p><Button onClick={() => setLoadAttempt(n => n + 1)}>다시 시도</Button></>}</main></div>;
  const session = 'sessionId' in view ? state.sessions.find(s => s.id === view.sessionId) : undefined;
  const daily = state.sessions.find(s => s.date === today && s.kind === 'daily');
  const unfinished = state.sessions.filter(s => !isComplete(s));
  const mistakes = Object.keys(state.mistakes).filter(id => questionById[id]);
  const wrongCount = mistakes.filter(id => !state.mistakes[id].solved).length;
  const selected = selectedSubjects(state.settings);
  const course = interviewProgress(state);
  if (!state.preferencesSet || view.type === 'preferences') return <div className="shell">{header}<main>{error && <div className="error" role="alert">{error}</div>}<StudyPreferences key={view.type} settings={state.settings} busy={busy} first={!state.preferencesSet} onCancel={() => go({ type: 'home' })} onSave={async ids => {
    if (await commit(d => ({ ...updateSettings(d, { ...d.settings, selectedSubjects: ids, subject: ids.includes(d.settings.subject) ? d.settings.subject : ids[0] }), preferencesSet: true }))) { go({ type: 'home' }); track('study_preferences_save', { subjects: ids.join(',') }); }
  }}/></main></div>;
  return <div className="shell">{header}<main>
    {error && <div className="error" role="alert">{error}</div>}
    {view.type === 'home' && <>
      <section className="hero"><div className="eyebrow">작은 습관, 단단한 기본기</div><h1>오늘도 다섯 문제.<br/><span>개발자의 감각을 쌓아요.</span></h1><p>CS부터 언어, 그래픽스와 설계까지.<br/>짧게 풀고, 이유까지 이해해 보세요.</p><div className="hero-stamp" aria-hidden="true"><span>5</span><small>DAILY</small></div></section>
      <div className="stats"><div><strong>{Object.keys(state.firstAnswers).length}<small> / {allQuestions.length}</small></strong><span>풀어본 문제</span></div><div><strong>{state.sessions.filter(s => s.kind === 'daily' && isComplete(s)).length}<small>일</small></strong><span>완료한 학습</span></div><div><strong>{wrongCount}<small>개</small></strong><span>다시 볼 개념</span></div></div>
      <section className="card preference-summary"><div className="section-head"><h2>내 학습 범위</h2><button className="clear-selection" onClick={() => go({ type: 'preferences' })}>학습 과목 변경</button></div><p>{selected.map(subjectName).join(' · ')}</p></section>
      <section className="card daily-card"><div className="section-head"><h2>오늘의 학습</h2><span className="date-chip">{today.slice(5).replace('-', '. ')}</span></div>
        {state.settings.courseId ? <><h3>14일 게임 클라이언트 면접 준비</h3><p className="hint">{course.nextDay ? `${course.nextDay}일차 · ${interviewCourse.days[course.nextDay - 1].title}` : '14일 코스 완주'}<br/>C++·CS·그래픽스·Unreal 엔진을 순서대로 공부해요.</p><p className="course-home-progress">{course.completed.size}/14일 완료</p><button className="text-button" disabled={busy} onClick={() => void commit(d => updateSettings(d, { ...d.settings, courseId: undefined }))}>일반 학습으로 변경</button></> : <>
        <div className="segmented" aria-label="출제 모드">{(['random', 'focus'] as const).map(mode => <button aria-pressed={state.settings.mode === mode} key={mode} disabled={busy} onClick={() => void commit(d => updateSettings(d, { ...d.settings, mode }))}>{mode === 'random' ? '전체 랜덤' : '한 과목 집중'}</button>)}</div>
        {state.settings.mode === 'focus' ? <label className="field">공부할 과목<select aria-label="공부할 과목" value={state.settings.subject} disabled={busy} onChange={e => void commit(d => updateSettings(d, { ...d.settings, subject: e.target.value }))}>{subjects.filter(s => selected.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label> : <p className="hint">선택한 {selected.length}과목 안에서 랜덤으로 골라요.<br/>과목별로 먼저 배정하고 남은 문제를 채워요.</p>}
        <label className="field">시작 난이도<select aria-label="시작 난이도" value={state.settings.startLevel} disabled={busy} onChange={e => void commit(d => updateSettings(d, { ...d.settings, startLevel: e.target.value as typeof d.settings.startLevel }))}>{levels.map(l => <option key={l} value={l}>{levelLabel[l]}</option>)}</select></label>
        <p className="hint">단계의 문제를 모두 풀면 다음 단계로 이어져요.{daily && <><br/>오늘 세트는 고정되어 있어요. 변경은 다음 세트에 적용돼요.</>}</p>
        </>}
        {state.settings.courseId && daily && <p className="hint">오늘 세트는 고정되어 있어요. 코스 선택 변경은 다음 세트부터 적용돼요.</p>}
        {daily && <div className="progress-track"><i style={{ width: `${Object.keys(daily.answers).length / 5 * 100}%` }}/></div>}
        <Button display="block" loading={busy} disabled={!daily && !!state.settings.courseId && !course.nextDay} onClick={() => daily ? openSession(daily) : void start()}>{daily ? isComplete(daily) ? '오늘 결과 보기' : `이어서 풀기 · ${Object.keys(daily.answers).length}/5` : state.settings.courseId && !course.nextDay ? '면접 코스 완주' : '오늘의 5문제 시작'}</Button>
      </section>
      {unfinished.filter(s => s.id !== daily?.id).map(s => <button className="resume" key={s.id} onClick={() => openSession(s)}><span><b>{s.kind === 'bonus' ? '추가 학습' : '지난 학습'} 이어하기</b><small>{s.date} · {Object.keys(s.answers).length}/{s.entries.length}문제</small></span><span>→</span></button>)}
      <button className="feature-card" onClick={() => go({ type: 'interview' })}><div className="feature-icon">14</div><div><b>14일 게임 클라이언트 면접 준비</b><p>하루 5문제 + 면접 답변·꼬리질문 · {course.completed.size}/14일 완료</p></div><span>→</span></button>
      <button className="feature-card" onClick={() => go({ type: 'subjects' })}><div className="feature-icon">⌘</div><div><b>{subjects.length}개 과목, {bank.length}개의 질문</b><p>코드 빈칸부터 개념과 설계까지</p></div><span>→</span></button>
      <p className="footnote">기록은 이 기기에 저장돼요. 기기 변경·저장소 삭제 시 기록이 사라질 수 있어요.</p>
    </>}
    {view.type === 'interview' && <InterviewCourse state={state} busy={busy} onOpen={openSession} onSelect={async () => { if (await commit(d => updateSettings(d, { ...d.settings, courseId: 'game-client-14' }))) go({ type: 'home' }); }}/>}
    {view.type === 'subjects' && <><div className="page-title"><div className="eyebrow">나의 학습 지도</div><h1>기본기를 넓혀 볼까요?</h1><p>쉬움·중간·어려움으로 개념과 코드를 함께 익혀요.</p></div>{['CS', '언어', '게임 개발', '설계'].map(group => <section className="subject-group" key={group}><h2>{group}</h2>{subjects.filter(s => s.group === group).map(s => {
      const qs = bank.filter(q => q.subject === s.id), done = qs.filter(q => state.firstAnswers[q.id]).length;
      return <article className="card subject-card" key={s.id}><div className="section-head"><h3>{s.name}</h3><span>{done}/{qs.length}</span></div><p>{s.description}</p><div className="level-progress">{levels.map(l => <div key={l}><span>{levelLabel[l]}</span><b>{qs.filter(q => q.difficulty === l && state.firstAnswers[q.id]).length}/{qs.filter(q => q.difficulty === l).length}</b></div>)}</div><Button variant="weak" size="small" disabled={busy} onClick={async () => { if (await commit(d => updateSettings(d, { ...d.settings, courseId: undefined, mode: 'focus', subject: s.id, selectedSubjects: [...new Set([...selectedSubjects(d.settings), s.id])] }))) go({ type: 'home' }); }}>이 과목 선택</Button></article>;
    })}</section>)}</>}
    {view.type === 'review' && <><div className="page-title"><div className="eyebrow">틀린 만큼 더 단단하게</div><h1>오답을 다시 꺼내봐요.</h1><p>복습은 언제든 무료예요. 처음 점수는 그대로 유지돼요.</p></div><label className="field">과목 필터<select aria-label="복습 과목" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">모든 과목</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{!mistakes.length && <div className="empty"><span>✓</span><h2>아직 오답이 없어요</h2><p>오늘의 문제를 풀면 복습할 개념이 여기에 모여요.</p></div>}{mistakes.filter(id => filter === 'all' || questionById[id].subject === filter).sort((a,b) => Number(state.mistakes[a].solved) - Number(state.mistakes[b].solved)).map(id => <button className="review-row" key={id} onClick={() => { go({ type: 'review-question', questionId: id }); track('review_start', { subject: questionById[id].subject }); }}><div><small>{subjectName(questionById[id].subject)} · {levelLabel[questionById[id].difficulty]}</small><b>{questionById[id].topic}</b></div><span className={state.mistakes[id].solved ? 'solved' : ''}>{state.mistakes[id].solved ? '복습 완료' : '다시 풀기'} →</span></button>)}</>}
    {view.type === 'review-question' && <QuestionView key={view.questionId} question={questionById[view.questionId]} busy={busy} onSubmit={async choice => { return await commit(d => reviewAnswer(d, questionById[view.questionId], choice)); }} onNext={() => go({ type: 'review' })} review nextLabel="복습 목록으로"/>}
    {view.type === 'quiz' && session && (() => {
      const entry = session.entries[view.index], q = questionById[entry.questionId];
      return q ? <QuestionView key={`${session.id}:${view.index}`} question={q} number={view.index + 1} total={session.entries.length} busy={busy} answer={session.answers[q.id]?.choiceId} review={entry.review} onSubmit={async choice => {
        const saved = await commit(d => submitAnswer(d, allQuestions, session.id, q.id, choice));
        if (saved) track('answer_submit', { subject: q.subject, level: q.difficulty, correct: choice === q.correctChoiceId });
        return saved;
      }} onNext={() => { if (view.index + 1 < session.entries.length) go({ ...view, index: view.index + 1 }); else { go({ type: 'result', sessionId: session.id, index: 0 }); track('session_complete', { kind: session.kind, score: score(session) }); } }} nextLabel={view.index + 1 === session.entries.length ? '학습 결과 보기' : '다음 문제'}/> : <div role="alert">업데이트로 철회된 문항입니다. 홈으로 돌아가 주세요.</div>;
    })()}
    {view.type === 'result' && session?.interviewDay && <section className="card course-result"><h2>면접 코스 {session.interviewDay}일차 완료</h2><p>{course.completed.size}/14일을 완료했어요. {course.nextDay ? '다음 학습: ' + interviewCourse.days[course.nextDay - 1].title : '70문항을 모두 풀었어요. 면접 질문을 다시 설명하며 복습해 보세요.'}</p><Button display="block" variant="weak" onClick={() => go({ type: 'interview' })}>면접 질문·코스 보기</Button></section>}
    {view.type === 'result' && session && <><section className="result-hero"><div className="eyebrow">{session.kind === 'bonus' ? '추가 학습' : '오늘의 학습'} 완료</div><div className="score-ring"><b>{score(session)}</b><span>/ {session.entries.length}</span></div><h1>오늘도 한 걸음 나아갔어요.</h1><p>맞힌 문제보다 중요한 건 이해한 개념이에요.</p></section><section className="card"><h2>이번에 만난 개념</h2>{session.entries.map(e => <button className="result-row" key={e.questionId} onClick={() => go({ type: 'quiz', sessionId: session.id, index: session.entries.indexOf(e) })}><span className={session.answers[e.questionId]?.correct ? 'correct-mark' : 'wrong-mark'}>{session.answers[e.questionId]?.correct ? '✓' : '↺'}</span><span><b>{questionById[e.questionId]?.topic ?? '철회된 문항'}</b><small>{subjectName(questionById[e.questionId]?.subject ?? '')}{e.review ? ' · 복습' : ''}</small></span><span>→</span></button>)}</section><Button display="block" variant="weak" onClick={() => go({ type: 'review' })}>오답 복습하기</Button>{session.kind === 'daily' && session.date === today && <BonusCard key={session.id} state={state} daily={session} busy={busy} commit={commit} open={openSession} setError={setError} current={current}/>}<button className="text-button" onClick={() => go({ type: 'home' })}>홈으로 돌아가기</button></>}
  </main>{tabs}</div>;
}

function QuestionView({ question: q, number, total, busy, answer, onSubmit, onNext, review, nextLabel }: { question: Question; number?: number; total?: number; busy: boolean; answer?: string; onSubmit: (choice: string) => Promise<boolean>; onNext: () => void; review?: boolean; nextLabel: string }) {
  const [selected, setSelected] = useState('');
  const [reviewedAnswer, setReviewedAnswer] = useState('');
  const submitted = answer || reviewedAnswer;
  const correct = submitted === q.correctChoiceId;
  return <article className="question-view" data-question-id={q.id}>
    <div className="question-meta"><span>{subjectName(q.subject)}</span><span className={`level ${q.difficulty}`}>{levelLabel[q.difficulty]}</span>{q.kind && q.kind !== 'concept' && <span className="review-badge">{{ 'fill-blank': '코드 빈칸', output: '실행 결과', debug: '오류 분석' }[q.kind]}</span>}{q.exam && <span className="review-badge">기사 범위 연습</span>}{review && <span className="review-badge">복습</span>}{number && <b>{number} / {total}</b>}</div>
    {number && <div className="progress-track"><i style={{ width: `${number / total! * 100}%` }}/></div>}
    <div className="question-title"><div className="eyebrow">{q.topic}</div><h1>{q.prompt}</h1></div>
    <p className="environment">{q.environment}</p>{q.code && <pre><code>{q.code.split(/(____)/g).map((part, i) => part === '____' ? <mark className="code-blank" key={i} aria-label="코드 빈칸">____</mark> : part)}</code></pre>}{q.diagram && <Diagram kind={q.diagram}/>}
    <section className="interview-prompt" hidden={!q.interview}><h2>면접 질문부터 말해 보기</h2><p>{q.interview?.oralPrompt}</p></section>
    <div className="choices" role="group" aria-label="답 선택">{q.choices.map((c,i) => <button key={c.id} disabled={busy || !!submitted} aria-pressed={selected === c.id || submitted === c.id} className={`choice ${selected === c.id ? 'selected' : ''} ${submitted ? c.id === q.correctChoiceId ? 'right' : c.id === submitted ? 'wrong' : '' : ''}`} onClick={() => setSelected(c.id)}><span className="choice-number">{i + 1}</span><span>{c.text}</span>{submitted && c.id === q.correctChoiceId && <b>✓</b>}</button>)}</div>
    {!submitted ? <Button display="block" disabled={!selected} loading={busy} onClick={async () => { if (await onSubmit(selected)) setReviewedAnswer(selected); }}>답 제출</Button> : <><section className={`explanation ${correct ? 'correct' : ''}`} aria-live="polite"><h2>{correct ? '정답이에요' : '이렇게 생각해 보세요'}</h2><p>{q.explanation}</p><details><summary>다른 선택지는 왜 아닐까요?</summary>{q.choices.filter(c => c.id !== q.correctChoiceId).map(c => <div className="distractor" key={c.id}><b>{c.text}</b><p>{c.explanation}</p></div>)}</details><div className="sources"><span>개념의 근거</span>{q.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); openSource(s.url); }}>{s.title} ↗</a>)}</div></section>{q.interview && <InterviewAnswer question={q}/>}<Button display="block" onClick={onNext}>{nextLabel}</Button></>}
  </article>;
}

function BonusCard({ state, daily, busy, commit, open, setError, current }: { state: State; daily: Session; busy: boolean; commit: (fn: (s: State) => State) => Promise<boolean>; open: (s: Session) => void; setError: (error: string) => void; current: React.MutableRefObject<State | undefined> }) {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [showing, setShowing] = useState(false);
  const [retry, setRetry] = useState(0);
  const controller = useRef<AdController | null>(null);
  const selected = useRef<Entry[]>([]);
  const rewarded = useRef(false);
  const bonus = state.sessions.find(s => s.date === daily.date && s.kind === 'bonus');
  const eligible = !bonus && bonusEntries(state, bank, daily).length === 3;
  const pending = useRef(false);
  const [pendingSave, setPendingSave] = useState(false);
  async function saveReward() {
    if (pending.current) return;
    pending.current = true;
    const saved = await commit(s => grantBonus(s, daily.id, selected.current, bank));
    pending.current = false;
    if (saved) { setPendingSave(false); const s = current.current?.sessions.find(s => s.id === `bonus:${daily.date}`); if (s) open(s); }
    else setPendingSave(true);
  }
  const rewardCallback = useRef(saveReward); rewardCallback.current = saveReward;
  useEffect(() => {
    if (!eligible) return;
    let active = true;
    setReady(false); setAvailable(false); rewarded.current = false;
    prepareAd(event => {
      if (!active) return;
      track(`ad_${event}`, { development: import.meta.env.DEV && !native });
      if (event === 'loaded') setReady(true);
      if (event === 'userEarnedReward' && !rewarded.current) { rewarded.current = true; void rewardCallback.current(); }
      if (event === 'dismissed' || event === 'failedToShow') { setShowing(false); setReady(false); if (!rewarded.current) { setError(event === 'dismissed' ? '광고가 완료되지 않아 추가 문제를 지급하지 않았어요.' : '광고를 표시하지 못했어요. 기본 학습과 복습은 계속할 수 있어요.'); setRetry(n => n + 1); } }
    }, error => { if (active) { setError(error.message); setShowing(false); setReady(false); } }).then(c => { if (!active) c?.dispose(); else { controller.current = c; setAvailable(!!c); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; controller.current?.dispose(); controller.current = null; };
  }, [eligible, retry]);
  if (bonus) return <section className="card bonus-card"><h2>추가 학습이 열렸어요</h2><p>광고 보상으로 받은 문제는 다시 접속해도 남아 있어요.</p><Button display="block" variant="weak" onClick={() => open(bonus)}>{isComplete(bonus) ? '추가 학습 결과' : '추가 3문제 이어하기'}</Button></section>;
  if (pendingSave) return <Button display="block" loading={busy} onClick={() => void saveReward()}>추가 학습 저장 다시 시도</Button>;
  if (!eligible || !available) return null;
  return <section className="card bonus-card"><span className="eyebrow">조금 더 공부하고 싶다면</span><h2>새로운 3문제 더 풀기</h2><p>원할 때만 광고를 보고 추가 학습을 열어요.<br/>기본 해설과 오답 복습은 언제든 무료예요.{daily.interviewDay && <><br/>추가 문제는 선택한 일반 학습 과목에서 나오며, 면접 코스 진도와 별개예요.</>}</p><Button display="block" variant="weak" disabled={!ready || showing || busy} onClick={() => { selected.current = bonusEntries(current.current!, bank, daily); if (selected.current.length === 3) { setShowing(true); controller.current?.show(); } }}>{import.meta.env.DEV && !native ? '개발 광고 테스트 · 3문제' : showing ? '광고 진행 중' : ready ? '광고 보고 3문제 열기' : '광고 준비 중'}</Button>{!ready && !showing && <button className="text-button" onClick={() => setRetry(n => n + 1)}>광고 다시 준비</button>}</section>;
}
