import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// generate로 검증 소스를 만들고 C++20 컴파일 후 run으로 실제 출력을 대조합니다.
const course = JSON.parse(readFileSync(new URL('../src/courses/game-client-14.json', import.meta.url), 'utf8'));
const questions = course.questions.filter(q => q.kind === 'output');
const reports = new URL('../reports/', import.meta.url);
mkdirSync(reports, { recursive: true });
if (process.argv[2] === 'generate') {
  let source = '#include <iostream>\n#include <vector>\n#include <memory>\n#include <utility>\n';
  questions.forEach((q, i) => {
    source += `\nnamespace check_${i} {\n`;
    source += q.code.includes('int main()') ? q.code.replace('int main()', 'void run()') : `void run() {\n${q.code}\n}`;
    source += '\n}\n';
  });
  source += '\nint main() {\n';
  questions.forEach((q, i) => { source += `std::cout << "@@${q.id}\\n"; check_${i}::run(); std::cout << "\\n@@END\\n";\n`; });
  source += '}\n';
  writeFileSync(new URL('interview-check.cpp', reports), source);
  console.log(`C++20 검증 소스: reports/interview-check.cpp / ${questions.length}개`);
} else if (process.argv[2] === 'run') {
  const output = execFileSync(fileURLToPath(new URL('interview-check.exe', reports)), { encoding: 'utf8', windowsHide: true }).replaceAll('\r\n', '\n');
  const results = questions.map(q => {
    const expected = q.choices.find(c => c.id === q.correctChoiceId).text;
    const actual = output.split(`@@${q.id}\n`)[1]?.split('\n@@END')[0].trim();
    return { id: q.id, expected, actual, passed: expected === actual };
  });
  writeFileSync(new URL('interview-code-results.json', reports), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
  if (results.some(r => !r.passed)) throw new Error(JSON.stringify(results.filter(r => !r.passed)));
  console.log(`C++20 실행 출력 통과: ${results.length}개`);
} else throw new Error('generate 또는 run을 지정해 주세요.');
