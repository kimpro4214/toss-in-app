export type AccountKind = 'taxable' | 'isa' | 'pension' | 'irp';
export interface Account {
  id: string; name: string; kind: AccountKind;
  openedYear: number; settlementYear: number; isaExemption: number; cumulativeProfit: number; cumulativeLoss: number;
  pensionAge: number; pensionYear: number; afterTaxPrincipal: number; annualWithdrawal: number; deferredRetirement: boolean;
  contributionRemaining: number; isaLifetimeRemaining: number;
}
export type TaxClass = 'ordinary' | 'exempt' | 'separate' | 'high';
export interface Position {
  id: string; accountId: string; name: string; ticker: string; market: 'KR' | 'US'; instrument: 'stock' | 'etf';
  quantity: number; price: number; dividend: number; months: number[]; foreignRate: number; domesticProcedure: boolean;
  taxClass: TaxClass; separateRate: number; grossUp: boolean; highEvidence: string; highElected: boolean;
  source?: { year: number; stockKind: string; receipt: string; asOf: string; url: string }; manuallyEdited: boolean;
  accountEligible: boolean; pensionRisk: 'safe' | 'risky'; leveraged: boolean;
  highThroughYear: number;
}
export interface Receipt {
  id: string; positionId: string; date: string; gross: number; foreignTax: number; nationalTax: number; localTax: number;
  incomeSnapshot?: Income; accountKind?: AccountKind;
}
export interface TaxProfile {
  year: number; interest: number; otherIncome: number | null; deductions: number | null;
  nationalCredits: number | null; localCredits: number | null; otherNationalPaid: number | null; otherLocalPaid: number | null;
  foreignEligibleTax: number | null; foreignLocalCredit: number | null; confirmed: boolean;
}
export interface FireSettings {
  expense: number; contribution: number; reinvest: number; dividendGrowth: number; priceGrowth: number; inflation: number; horizon: number;
  healthMode: 'exclude' | 'manual'; healthMonthly: number | null;
}
export interface State {
  schemaVersion: 1; fx: number; accounts: Account[]; positions: Position[]; receipts: Receipt[];
  tax: TaxProfile; fire: FireSettings; checklist: string[];
}
export interface Income {
  gross: number; foreignTax: number; nationalPaid: number; localPaid: number;
  foreign: boolean; domesticProcedure: boolean; taxClass: TaxClass; separateRate: number; grossUp: boolean;
  highEvidence: string; highElected: boolean;
  highThroughYear: number;
}
export const accountLabels: Record<AccountKind, string> = { taxable: '일반계좌', isa: 'ISA', pension: '연금저축', irp: 'IRP' };
