import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { bank } from '../src/bank';
const text = (id: string) => {const q=bank.find(q=>q.id===id)!;return q.choices.find(c=>c.id===q.correctChoiceId)!.text};
it('이진 표현·CPI·AMAT·Amdahl 계산을 확인한다',()=>{
  expect(text('architecture-003')).toBe(`${2**8}개`);
  expect(text('architecture-004')).toBe(String(parseInt('1010',2)));
  expect(text('architecture-010')).toBe(`${-(2**7)}부터 ${2**7-1}까지`);
  expect(text('architecture-016')).toBe(`${1e9*2/2e9}초`);
  expect(text('architecture-017')).toBe(`${1+.1*100}ns`);
  expect(text('architecture-021')).toBe(`${1/.2}배`);
});
it('작성한 JavaScript finally 코드의 출력을 실행해 확인한다',()=>{
  const q=bank.find(q=>q.id==='javascript-027')!;const output:unknown[]=[];
  runInNewContext(q.code!,{console:{log:(v:unknown)=>output.push(v)}});
  expect(output).toEqual([2]);expect(text(q.id)).toBe('2');
});
it('Promise 반응과 동기 실행의 출력 순서를 확인한다',async()=>{
  const q=bank.find(q=>q.id==='javascript-021')!;const output:string[]=[];
  runInNewContext(q.code!,{console:{log:(v:string)=>output.push(v)}});
  await Promise.resolve();expect(output).toEqual(['A','C','B']);expect(text(q.id)).toBe('A C B');
});
