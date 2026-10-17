import fs from 'node:fs';
const drinks = JSON.parse(fs.readFileSync(new URL('../src/content/drinks.json', import.meta.url), 'utf8'));
const ids = new Set(), combinations = new Set();
const hosts = ['www.efsa.europa.eu', 'www.fda.gov'];
for (const d of drinks) {
  const key = `${d.name}:${d.volumeMl}`;
  if (ids.has(d.id) || combinations.has(key) || !d.id || !d.name || 'brand' in d || 'country' in d || !Number.isFinite(d.caffeineMg) || d.caffeineMg < 0 || d.caffeineMg > 2000 || !Number.isFinite(d.volumeMl) || d.volumeMl <= 0 || !['cup', 'liquid'].includes(d.volumeBasis) || !d.sourceNote || !/^\d{4}-\d{2}-\d{2}$/.test(d.checkedAt) || !hosts.includes(new URL(d.sourceUrl).hostname) || new URL(d.sourceUrl).protocol !== 'https:') throw new Error(`음료 참고값 확인 필요: ${d.id}`);
  if (Date.parse(d.checkedAt) > Date.now()) throw new Error(`미래 확인일: ${d.id}`);
  ids.add(d.id); combinations.add(key);
}
if (!['coffee', 'tea', 'energy', 'other'].every(kind => drinks.some(d => d.kind === kind)) || !drinks.some(d => d.decaf && d.caffeineMg > 0)) throw new Error('일반 음료 종류와 디카페인 참고값을 확인하세요.');
console.log(`브랜드 없는 일반 음료 ${drinks.length}개 예시의 단위·근거·필수값 검사를 통과했어요.`);
