import { initialState } from './state';
import type { State } from './types';
import { positionError } from './engine';
export function parseState(raw: string | null): State {
  if (!raw) return initialState();
  const s = JSON.parse(raw) as State;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const nullable = (n: unknown) => n === null || finite(n);
  const validDate = (d:string) => { const date=new Date(`${d}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===d; };
  const valid = s && s.schemaVersion === 1 && finite(s.fx) && s.fx > 0 && Array.isArray(s.accounts) && s.accounts.length > 0 && Array.isArray(s.positions) && Array.isArray(s.receipts) && s.tax && s.fire && Array.isArray(s.checklist)
    && s.accounts.every(a => a && typeof a.id === 'string' && typeof a.name === 'string' && ['taxable','isa','pension','irp'].includes(a.kind) && [a.openedYear,a.settlementYear,a.isaExemption,a.cumulativeProfit,a.cumulativeLoss,a.pensionAge,a.pensionYear,a.afterTaxPrincipal,a.annualWithdrawal,a.contributionRemaining,a.isaLifetimeRemaining].every(finite) && a.pensionYear >= 1 && Number.isInteger(a.pensionYear) && a.isaLifetimeRemaining <= 100000000 && (a.kind === 'isa' || a.kind === 'taxable' || a.contributionRemaining <= 18000000) && typeof a.deferredRetirement === 'boolean')
    && new Set(s.accounts.map(a => a.id)).size === s.accounts.length
    && s.positions.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.ticker === 'string' && ['KR','US'].includes(p.market) && ['stock','etf'].includes(p.instrument) && ['ordinary','exempt','separate','high'].includes(p.taxClass) && [p.quantity,p.price,p.dividend,p.foreignRate,p.separateRate].every(finite) && p.foreignRate <= 100 && p.separateRate <= 100 && Array.isArray(p.months) && p.months.every(Number.isInteger) && typeof p.domesticProcedure === 'boolean' && typeof p.grossUp === 'boolean' && typeof p.highEvidence === 'string' && typeof p.highElected === 'boolean' && typeof p.manuallyEdited === 'boolean' && !positionError(p,s.accounts.find(a => a.id === p.accountId)))
    && new Set(s.positions.map(p => p.id)).size === s.positions.length
    && s.receipts.every(r => !r.incomeSnapshot || (Number.isInteger(r.incomeSnapshot.highThroughYear) && r.incomeSnapshot.highThroughYear>=2026 && r.incomeSnapshot.highThroughYear<=2030))
    && s.receipts.every(r => !r.incomeSnapshot || ([r.incomeSnapshot.gross,r.incomeSnapshot.foreignTax,r.incomeSnapshot.nationalPaid,r.incomeSnapshot.localPaid,r.incomeSnapshot.separateRate].every(finite) && ['taxable','isa','pension','irp'].includes(r.accountKind ?? '') && ['ordinary','exempt','separate','high'].includes(r.incomeSnapshot.taxClass) && typeof r.incomeSnapshot.foreign === 'boolean' && typeof r.incomeSnapshot.domesticProcedure === 'boolean' && typeof r.incomeSnapshot.grossUp === 'boolean' && typeof r.incomeSnapshot.highElected === 'boolean' && typeof r.incomeSnapshot.highEvidence === 'string'))
    && s.positions.every(p => typeof p.accountEligible === 'boolean' && typeof p.leveraged === 'boolean' && ['safe','risky'].includes(p.pensionRisk) && (!p.source || (Number.isInteger(p.source.year) && typeof p.source.stockKind === 'string' && /^\d{14}$/.test(p.source.receipt) && typeof p.source.asOf === 'string' && /^https:\/\/dart\.fss\.or\.kr\//.test(p.source.url))))
    && s.receipts.every(r => r && typeof r.id === 'string' && s.positions.some(p => p.id === r.positionId) && validDate(r.date) && [r.gross,r.foreignTax,r.nationalTax,r.localTax].every(finite) && r.foreignTax + r.nationalTax + r.localTax <= r.gross)
    && [s.tax.year,s.tax.interest].every(finite) && Number.isInteger(s.tax.year) && s.tax.year >= 2026 && s.tax.year <= 2030 && typeof s.tax.confirmed === 'boolean'
    && [s.tax.otherIncome,s.tax.deductions,s.tax.nationalCredits,s.tax.localCredits,s.tax.otherNationalPaid,s.tax.otherLocalPaid,s.tax.foreignEligibleTax,s.tax.foreignLocalCredit].every(nullable)
    && [s.fire.expense,s.fire.contribution,s.fire.reinvest,s.fire.inflation,s.fire.horizon].every(finite) && s.fire.reinvest <= 100 && s.fire.inflation <= 30 && Number.isInteger(s.fire.horizon) && s.fire.horizon >= 1 && s.fire.horizon <= 50 && [s.fire.dividendGrowth,s.fire.priceGrowth].every(n => Number.isFinite(n) && n >= -50 && n <= 50) && ['exclude','manual'].includes(s.fire.healthMode) && nullable(s.fire.healthMonthly) && s.checklist.every(v => typeof v === 'string');
  if (!valid) throw new Error('저장된 기록을 읽을 수 없어요. 기존 기록을 덮어쓰지 않았어요.');
  return s;
}
