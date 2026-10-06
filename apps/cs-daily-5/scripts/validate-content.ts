import { readdirSync, readFileSync } from 'node:fs';
import { subjects } from '../src/subjects';
import { levels, type Question } from '../src/types';
import { contentTargets, totalQuestions } from '../src/content-targets';
const directory = new URL('../src/content/', import.meta.url);
const files = readdirSync(directory).filter(f => f.endsWith('.json'));
const bank = files.flatMap(f => JSON.parse(readFileSync(new URL(f, directory), 'utf8')) as Question[]);
const errors: string[] = [];
const check = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
check(files.length === subjects.length, `과목 파일 ${subjects.length}개 필요`);
check(bank.length === totalQuestions, `총 ${totalQuestions}개 필요: ${bank.length}`);
check(new Set(bank.map(q => q.id)).size === bank.length, '중복 ID');
check(new Set(bank.map(q => q.prompt.trim())).size === bank.length, '같은 질문 중복');
for (const s of subjects) {
  const qs = bank.filter(q => q.subject === s.id);
  check(qs.length === contentTargets[s.id], `${s.name}: ${contentTargets[s.id]}개 필요`);
  for (const l of levels) check(qs.filter(q => q.difficulty === l).length === contentTargets[s.id] / 3, `${s.name}/${l}: ${contentTargets[s.id] / 3}개 필요`);
}
for (const q of bank) {
  check(subjects.some(s => s.id === q.subject), `${q.id}: 없는 과목`);
  check(new RegExp(`^${q.subject}-\\d{3}$`).test(q.id), `${q.id}: ID 형식`);
  check(levels.includes(q.difficulty), `${q.id}: 난이도`);
  check(q.choices.length === 4 && new Set(q.choices.map(c => c.id)).size === 4 && new Set(q.choices.map(c => c.text)).size === 4, `${q.id}: 선택지 4개/중복`);
  check(q.choices.filter(c => c.id === q.correctChoiceId).length === 1, `${q.id}: 정답 하나 필요`);
  check(q.choices.every(c => c.text.trim().length && c.explanation.trim().length > 3), `${q.id}: 오답 해설 누락`);
  check(q.prompt.length > 10 && q.topic.length && q.explanation.length > 10 && q.environment.length > 10, `${q.id}: 내용 누락`);
  check(q.sources.length && q.sources.every(s => s.title.length && /^https:\/\//.test(s.url)), `${q.id}: 출처 누락`);
  check(q.review.status === 'source-checked' && /^\d{4}-\d{2}-\d{2}$/.test(q.review.date) && q.review.method.length, `${q.id}: 검수 기록`);
  check(!q.kind || ['concept','fill-blank','output','debug'].includes(q.kind), `${q.id}: 문제 유형`);
  check(!q.language || [...subjects.filter(s => s.group === '언어').map(s => s.id), 'sql', 'pseudocode'].includes(q.language), `${q.id}: 코드 언어`);
  check(!q.kind || q.kind === 'concept' || !!q.code, `${q.id}: 코드 누락`);
  if (q.kind === 'fill-blank') check(q.code?.includes('____'), `${q.id}: 빈칸 누락`);
  check(!q.exam || q.exam === 'engineer-practice', `${q.id}: 시험 범위 태그`);
}
const graphics = bank.filter(q => q.subject === 'graphics');
check(graphics.filter(q => q.area === 'rendering').length === 20 && graphics.filter(q => q.area === 'engine').length === 10, '그래픽스 20/엔진 10 필요');
const patterns = ['Factory Method','Abstract Factory','Builder','Prototype','Singleton','Adapter','Bridge','Composite','Decorator','Facade','Flyweight','Proxy','Chain of Responsibility','Command','Interpreter','Iterator','Mediator','Memento','Observer','State','Strategy','Template Method','Visitor'];
for (const p of patterns) check(bank.some(q => q.subject === 'gof' && q.topic === p), `GoF ${p} 누락`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`콘텐츠 통과: ${bank.length}문제 / ${subjects.length}과목 / C++ ${contentTargets.cpp}개 / 코드 빈칸 ${bank.filter(q => q.kind === 'fill-blank').length}개 / GoF 23개`);
