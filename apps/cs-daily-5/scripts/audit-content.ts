import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Question } from '../src/types';

const directory = new URL('../src/content/', import.meta.url);
const bank = readdirSync(directory).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(new URL(f, directory), 'utf8')) as Question[]);
const course = JSON.parse(readFileSync(new URL('../src/courses/game-client-14.json', import.meta.url), 'utf8')).questions as Question[];
const legacyDirectory = new URL('../src/content-archive/', import.meta.url);
const legacy = [...readdirSync(legacyDirectory).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(new URL(f, legacyDirectory), 'utf8')) as Question[]), ...JSON.parse(readFileSync(new URL('../src/courses/game-client-14-legacy.json', import.meta.url), 'utf8')).questions as Question[]];

function audit(questions: Question[]) {
  const longest: string[] = [], shortest: string[] = [], repeated: string[] = [];
  const positions = [0, 0, 0, 0];
  for (const q of questions) {
    const correct = q.choices.find(c => c.id === q.correctChoiceId)!;
    const other = q.choices.filter(c => c.id !== q.correctChoiceId);
    if (other.every(c => c.text.length < correct.text.length)) longest.push(q.id);
    if (other.every(c => c.text.length > correct.text.length)) shortest.push(q.id);
    if (other.some(c => c.explanation.startsWith('이 조건에서'))) repeated.push(q.id);
    positions[q.choices.indexOf(correct)]++;
  }
  return { count: questions.length, uniqueLongest: longest.length, uniqueShortest: shortest.length, correctPositions: positions, templateExplanations: repeated.length, longestIds: longest, shortestIds: shortest };
}

const report = {
  checkedAt: new Date().toISOString(),
  note: '길이·위치·문구 통계는 편집 검토의 보조 지표이며 정답의 정확성이나 교육적 품질을 증명하지 않습니다.',
  previous: audit(legacy), current: audit([...bank, ...course]),
  subjects: Object.fromEntries([...new Set(bank.map(q => q.subject))].map(subject => [subject, audit(bank.filter(q => q.subject === subject))])),
};
mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
writeFileSync(new URL('../reports/content-quality.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`문항 감사: 이전 ${report.previous.count} → 검수 ${report.current.count}; 정답만 최장 ${report.previous.uniqueLongest} → ${report.current.uniqueLongest}; 최단 ${report.current.uniqueShortest}; 정답 위치 ${report.current.correctPositions.join('/')}; 반복 틀 해설 ${report.current.templateExplanations}`);
