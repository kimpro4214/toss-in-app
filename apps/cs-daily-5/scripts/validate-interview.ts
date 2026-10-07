import { readdirSync, readFileSync } from 'node:fs';
import { interviewCourse, interviewQuestions } from '../src/interview';
import { subjects } from '../src/subjects';
import { levels, type Question } from '../src/types';

const directory = new URL('../src/content/', import.meta.url);
const allQuestions = [...readdirSync(directory).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(new URL(f, directory), 'utf8')) as Question[]), ...interviewQuestions];

const errors: string[] = [];
const check = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
check(interviewCourse.days.length === 14 && interviewQuestions.length === 70, '14일 / 70문항 필요');
check(new Set(allQuestions.map(q => q.id)).size === allQuestions.length, '전체 문제은행의 ID 충돌');
check(new Set(interviewQuestions.map(q => q.prompt)).size === 70, '면접 퀴즈 질문 중복');
check(new Set(interviewQuestions.map(q => q.interview?.oralPrompt)).size === 70, '구술 질문 중복');
for (let day = 1; day <= 14; day++) {
  check(interviewCourse.days.filter(d => d.day === day && d.title.length).length === 1, `${day}일차 제목`);
  check(interviewQuestions.filter(q => q.interview?.day === day).length === 5, `${day}일차 5문항 필요`);
}
for (const q of interviewQuestions) {
  const oral = q.interview;
  check(/^interview-game-client-\d{2}-[1-5]$/.test(q.id), `${q.id}: ID 형식`);
  check(subjects.some(s => s.id === q.subject) && levels.includes(q.difficulty), `${q.id}: 과목·난이도`);
  check(q.prompt.length > 10 && q.environment.length > 10 && q.explanation.length > 20, `${q.id}: 퀴즈 내용`);
  check(q.choices.length === 4 && new Set(q.choices.map(c => c.id)).size === 4 && new Set(q.choices.map(c => c.text)).size === 4, `${q.id}: 선택지`);
  check(q.choices.filter(c => c.id === q.correctChoiceId).length === 1 && q.choices.every(c => c.text.length && c.explanation.length > 5), `${q.id}: 정답·오답 해설`);
  check(q.sources.length && q.sources.every(s => s.title.length && /^https:\/\//.test(s.url) && !s.url.includes('tistory.com')), `${q.id}: 기술 근거`);
  check(q.review.status === 'source-checked' && /^\d{4}-\d{2}-\d{2}$/.test(q.review.date) && q.review.method.length, `${q.id}: 검수`);
  check(oral?.courseId === interviewCourse.id && oral.oralPrompt.length > 10 && oral.answerOutline.length === 3 && oral.answerOutline.every(p => p.length > 5), `${q.id}: 구술 질문·핵심 3개`);
  check(oral?.followUps.length && oral.followUps.every(f => f.question.length > 5 && f.answer.length > 10), `${q.id}: 꼬리질문·답변`);
  check(/^https:\/\/yuu5666.tistory.com\/\d+$/.test(oral?.topicReference ?? ''), `${q.id}: 주제 참고`);
  check(q.kind === 'concept' || q.kind === 'output' && q.language === 'cpp' && !!q.code, `${q.id}: 코드 유형`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`면접 콘텐츠 통과: 14일 × 5문항 / 70문항 / 구술 질문·핵심·꼬리질문 / 전체 ${allQuestions.length}문항`);
