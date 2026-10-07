import { useState } from 'react';
import { Button } from '@toss/tds-mobile';
import { interviewCourse, interviewQuestions, interviewProgress } from './interview';
import { openSource, track } from './platform';
import type { Question, Session, State } from './types';
import './interview.css';

export function InterviewAnswer({ question }: { question: Question }) {
  const speaking = question.interview;
  if (!speaking) return null;
  return <section className="interview-answer">
    <h2>면접 답변의 핵심</h2>
    <ul>{speaking.answerOutline.map(point => <li key={point}>{point}</li>)}</ul>
    {speaking.followUps.map(f => <details key={f.question}><summary>꼬리질문 · {f.question}</summary><p>{f.answer}</p></details>)}
    <p className="hint">정의 → 원리 → 게임 개발 예시 → 주의사항 순서로 다시 말해 보세요.</p>
    <a href={speaking.topicReference} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); openSource(speaking.topicReference); }}>주제를 참고한 모의 면접 기록 ↗</a>
  </section>;
}

export function InterviewCourse({ state, busy, onSelect, onOpen }: { state: State; busy: boolean; onSelect: () => Promise<void>; onOpen: (session: Session) => void }) {
  const [practiceDay, setPracticeDay] = useState<number>();
  const progress = interviewProgress(state);
  const current = interviewCourse.days.find(d => d.day === practiceDay);
  if (current) return <>
    <div className="page-title"><div className="eyebrow">{current.day}일차 · 말하기 연습</div><h1>{current.title}</h1><p>질문마다 60~90초 동안 직접 답하고, 답변 핵심과 꼬리질문을 확인해요.</p></div>
    {interviewQuestions.filter(q => q.interview?.day === current.day).map((q, i) => <article className="card oral-question" key={q.id} data-oral-question-id={q.id}>
      <div className="eyebrow">질문 {i + 1} · {q.topic}</div><h2>{q.interview!.oralPrompt}</h2>
      <details><summary>답변 핵심 확인하기</summary><InterviewAnswer question={q}/><div className="sources">{q.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); openSource(s.url); }}>{s.title} ↗</a>)}</div></details>
    </article>)}
    <Button display="block" variant="weak" onClick={() => { setPracticeDay(undefined); window.scrollTo({ top: 0 }); }}>14일 코스 목록으로</Button>
  </>;
  return <>
    <div className="page-title"><div className="eyebrow">하루 5문제 · 70문항</div><h1>{interviewCourse.title}</h1><p>{interviewCourse.description}</p></div>
    <section className="card course-overview"><div className="section-head"><h2>퀴즈 진행</h2><b>{progress.completed.size} / 14일</b></div>
      <div className="progress-track" aria-label={`면접 코스 ${progress.completed.size}일 완료`}><i style={{ width: `${progress.completed.size / 14 * 100}%` }}/></div>
      <p>오늘의 기본 5문제를 이 코스로 풀어요. 순서대로 진행하며, 말하기 연습은 모든 일차에서 언제든 열 수 있어요.</p>
      <p className="hint">C++·CS·그래픽스·Unreal 엔진을 함께 다뤄요. 코스의 과목·난이도 순서는 고정되어 있어요. 이미 시작한 오늘 세트는 유지하고 변경은 다음 세트부터 적용돼요.</p>
      {progress.nextDay ? <Button display="block" disabled={busy} onClick={() => void onSelect()}>{state.settings.courseId ? '면접 코스 이어가기' : '면접 코스로 학습하기'}</Button> : <p className="course-complete">14일 퀴즈를 완주했어요. 각 일차의 면접 질문을 다시 말하며 복습해 보세요.</p>}
    </section>
    <div className="course-days">{interviewCourse.days.map(d => {
      const session = progress.sessions.find(s => s.interviewDay === d.day);
      const complete = progress.completed.has(d.day);
      return <article className={`card course-day ${complete ? 'completed' : ''}`} key={d.day}>
        <div className="section-head"><span className="eyebrow">{d.day}일차</span><span>{complete ? '퀴즈 완료' : session ? `${Object.keys(session.answers).length}/5 진행` : '5문제'}</span></div>
        <h2>{d.title}</h2><p>{interviewQuestions.filter(q => q.interview?.day === d.day).map(q => q.topic).join(' · ')}</p>
        <div className="course-actions"><Button variant="weak" size="small" onClick={() => { setPracticeDay(d.day); window.scrollTo({ top: 0 }); track('interview_oral_start', { day: d.day }); }}>말로 연습하기</Button>
          {session && <Button variant="weak" size="small" onClick={() => onOpen(session)}>{complete ? '퀴즈 결과 보기' : '퀴즈 이어하기'}</Button>}
        </div>
      </article>;
    })}</div>
  </>;
}
