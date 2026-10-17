export type AgeBand = '19-29' | '30-49' | '50-64' | '65-74' | '75+';
export type ReferenceSex = 'male' | 'female';
export type DrinkKind = 'coffee' | 'tea' | 'energy' | 'packaged' | 'water' | 'other';
export interface DrinkVariant {
  id: string; name: string; kind: DrinkKind; decaf: boolean; caffeineMg: number;
  volumeMl: number; volumeBasis: 'cup' | 'liquid'; sourceUrl: string; checkedAt: string;
  sourceNote: string;
}
export interface IntakeRecord {
  id: string; variantId: string | null; name: string; kind: DrinkKind;
  caffeineMg: number; volumeMl: number; volumeEstimated: boolean; consumedAt: string;
  sourceUrl: string | null; sourceCheckedAt: string | null;
}
export interface Preferences {
  bedtime: string; halfLifeHours: 3 | 5 | 7; cutoffHours: 6 | 9 | 12;
  ageBand: AgeBand | null; referenceSex: ReferenceSex | null;
  waterGoalMode: 'none' | 'reference' | 'custom'; customWaterGoalMl: number | null;
}
export interface PersistedState {
  version: 1; preferences: Preferences; records: IntakeRecord[]; favorites: string[];
}
