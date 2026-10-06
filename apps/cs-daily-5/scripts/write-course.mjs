import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 문항은 사람이 읽을 수 있는 원고로 작성하고, 이 도구는 JSON 직렬화만 합니다.
export function writeCourse(subject, environment, sources, rows, extras = {}) {
  const lines = rows.trim().split('\n').filter(Boolean);
  if (lines.length !== 30) throw new Error(`${subject}: 원고 ${lines.length}개 (30개 필요)`);
  const questions = lines.map((line, i) => {
    const parts = line.split('|');
    if (parts.length !== 7) throw new Error(`${subject} ${i + 1}: 필드 수 ${parts.length}`);
    const [topic, prompt, correct, reason, w1, w2, w3] = parts;
    const wrong = [w1, w2, w3].map(w => {
      const pair = w.split('~'); if (pair.length !== 2) throw new Error(`${subject} ${topic}: 오답 해설 누락`);
      return pair;
    });
    const choices = [{ id: 'c0', text: correct, explanation: reason }, ...wrong.map(([text, explanation], k) => ({ id: `c${k + 1}`, text, explanation }))];
    const shift = (i * 7 + subject.length) % 4;
    const extra = extras[i + 1] ?? {};
    return { id: `${subject}-${String(i + 1).padStart(3, '0')}`, subject, difficulty: ['easy', 'medium', 'hard'][Math.floor(i / 10)], topic, prompt, choices: [...choices.slice(shift), ...choices.slice(0, shift)], correctChoiceId: 'c0', explanation: reason, environment, sources: extra.sources ?? sources, review: { status: 'source-checked', date: '2026-10-05', method: '직접 작성한 정답·오답을 원자료의 개념·적용 조건과 대조' }, ...extra };
  });
  const directory = fileURLToPath(new URL('../src/content/', import.meta.url));
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}${subject}.json`, JSON.stringify(questions, null, 2) + '\n');
  console.log(`${subject}: ${questions.length}문제`);
}
