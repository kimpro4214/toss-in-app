import data from './content/drinks.json';
import type { DrinkVariant } from './types';
export const drinks = data as DrinkVariant[];
export const drinkLabel = (d: DrinkVariant) => `${d.name} ${d.volumeMl}mL`;
export function searchDrinks(query: string, category = '전체'): DrinkVariant[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return drinks.filter(d => (category === '전체' || category === '디카페인' && d.decaf || category === '커피' && d.kind === 'coffee' || category === '차' && d.kind === 'tea' || category === '기타 음료' && ['energy', 'other'].includes(d.kind)) && terms.every(term => drinkLabel(d).toLocaleLowerCase().includes(term)));
}
