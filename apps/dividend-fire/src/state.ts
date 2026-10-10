import type { Account, Position, State } from './types';
export const defaultAccount = (id: string = crypto.randomUUID()): Account => ({ id, name: '일반계좌', kind: 'taxable', openedYear: 2021, settlementYear: 2029, isaExemption: 2000000, cumulativeProfit: 0, cumulativeLoss: 0, pensionAge: 55, pensionYear: 1, afterTaxPrincipal: 0, annualWithdrawal: 0, deferredRetirement: false, contributionRemaining: 0, isaLifetimeRemaining: 0 });
export const defaultPosition = (accountId: string): Position => ({ id: crypto.randomUUID(), accountId, name: '', ticker: '', market: 'KR', instrument: 'stock', quantity: 0, price: 0, dividend: 0, months: [4], foreignRate: 15, domesticProcedure: true, taxClass: 'ordinary', separateRate: 14, grossUp: false, highEvidence: '', highElected: false, highThroughYear: 2029, manuallyEdited: true, accountEligible: false, pensionRisk: 'risky', leveraged: false });
export function initialState(): State {
  return { schemaVersion: 1, fx: 1350, accounts: [defaultAccount('general')], positions: [], receipts: [],
    tax: { year: 2026, interest: 0, otherIncome: null, deductions: null, nationalCredits: null, localCredits: null, otherNationalPaid: null, otherLocalPaid: null, foreignEligibleTax: null, foreignLocalCredit: null, confirmed: false },
    fire: { expense: 2000000, contribution: 1000000, reinvest: 100, dividendGrowth: 0, priceGrowth: 0, inflation: 2, horizon: 30, healthMode: 'exclude', healthMonthly: null }, checklist: [] };
}
export function exampleState(): State {
  const s = initialState();
  s.positions = [{ ...defaultPosition('general'), id: 'example', name: '예시 배당 자산', ticker: '직접 입력', quantity: 1000, price: 100000, dividend: 5000, months: [3, 6, 9, 12] }];
  s.tax = { ...s.tax, otherIncome: 0, deductions: 1500000, nationalCredits: 0, localCredits: 0, otherNationalPaid: 0, otherLocalPaid: 0, foreignEligibleTax: 0, foreignLocalCredit: 0, confirmed: true };
  return s;
}
