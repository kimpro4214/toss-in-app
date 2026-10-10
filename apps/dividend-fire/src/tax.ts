import type { Income, TaxProfile } from './types';
export const TAX_VERSION = 'KR-2026.10 / 배당가산 2026:10%, 2027~:11%';
export const THRESHOLD = 20000000;
const positive = (n: number) => Math.max(0, n);
export const won = (n: number) => Math.round(n);
export function progressive(base: number): number {
  const bands = [[14000000, .06], [50000000, .15], [88000000, .24], [150000000, .35], [300000000, .38], [500000000, .40], [1000000000, .42], [Infinity, .45]];
  let result = 0, previous = 0;
  for (const [end, rate] of bands) { result += positive(Math.min(base, end) - previous) * rate; previous = end; if (base <= end) break; }
  return result;
}
export function highDividendTax(gross: number): number {
  if (gross <= THRESHOLD) return gross * .14;
  if (gross <= 300000000) return 2800000 + (gross - THRESHOLD) * .20;
  if (gross <= 5000000000) return 58800000 + (gross - 300000000) * .25;
  return 1233800000 + (gross - 5000000000) * .30;
}
export function isHigh(i: Income, year: number): boolean {
  return i.taxClass === 'high' && !i.foreign && i.highElected && i.highEvidence.trim().length > 0 && year >= 2026 && year <= i.highThroughYear;
}
export function incomeWithholding(gross: number, p: Pick<Income, 'foreign' | 'domesticProcedure' | 'taxClass' | 'separateRate'> & { foreignRate: number }): Pick<Income, 'foreignTax' | 'nationalPaid' | 'localPaid'> {
  const foreignTax = p.foreign ? gross * p.foreignRate / 100 : 0;
  const rate = p.taxClass === 'exempt' ? 0 : p.taxClass === 'separate' ? p.separateRate / 100 : .14;
  const nationalPaid = p.domesticProcedure ? positive(gross * rate - foreignTax) : 0;
  return { foreignTax, nationalPaid, localPaid: nationalPaid * .1 };
}
function rawTax(incomes: Income[], profile: TaxProfile) {
  const ordinary = incomes.filter(i => i.taxClass !== 'exempt' && i.taxClass !== 'separate' && !isHigh(i, profile.year));
  const financial = ordinary.reduce((v, i) => v + i.gross, profile.interest);
  const forced = ordinary.some(i => !i.domesticProcedure && i.gross > 0);
  const aggregated = financial > THRESHOLD || forced;
  const eligible = ordinary.filter(i => !i.foreign && i.grossUp).reduce((v, i) => v + i.gross, 0);
  const grossUp = Math.min(eligible, positive(financial - THRESHOLD)) * (profile.year >= 2027 ? .11 : .10);
  const other = profile.otherIncome ?? 0, deductions = profile.deductions ?? 0;
  const baseline = progressive(positive(other - deductions));
  const a = progressive(positive(other + positive(financial - THRESHOLD) + grossUp - deductions)) + Math.min(financial, THRESHOLD) * .14;
  const b = financial * .14 + baseline;
  const dividendCredit = Math.min(grossUp, positive(a - b));
  const calculated = financial > THRESHOLD ? Math.max(a, b) - dividendCredit : b;
  const separate = incomes.filter(i => i.taxClass === 'separate').reduce((v, i) => v + i.gross * i.separateRate / 100, 0);
  const specialGross = incomes.filter(i => isHigh(i, profile.year)).reduce((v, i) => v + i.gross, 0);
  const special = highDividendTax(specialGross);
  const foreignGross = ordinary.filter(i => i.foreign).reduce((v, i) => v + i.gross, 0);
  const foreignPaid = ordinary.filter(i => i.foreign).reduce((v, i) => v + i.foreignTax, 0);
  const foreignLimit = calculated * foreignGross / Math.max(1, other + financial + grossUp);
  const foreignCredit = aggregated ? Math.min(foreignPaid, profile.foreignEligibleTax ?? 0, foreignLimit) : 0;
  const national = aggregated ? positive(calculated - (profile.nationalCredits ?? 0) - foreignCredit) + separate + special : positive(baseline - (profile.nationalCredits ?? 0)) + ordinary.reduce((v, i) => v + i.nationalPaid, profile.interest * .14) + separate + special;
  const local = aggregated ? positive(calculated * .1 - (profile.localCredits ?? 0) - Math.min(profile.foreignLocalCredit ?? 0, calculated * .1)) + (separate + special) * .1 : positive(baseline * .1 - (profile.localCredits ?? 0)) + ordinary.reduce((v, i) => v + i.localPaid, profile.interest * .014) + (separate + special) * .1;
  return { financial, aggregated, forced, a, b, grossUp, dividendCredit, foreignCredit, foreignLimit, national, local, specialGross, special };
}
export function calculateTax(incomes: Income[], profile: TaxProfile) {
  const raw = rawTax(incomes, profile), base = rawTax([], profile);
  const gross = incomes.reduce((v, i) => v + i.gross, 0);
  const foreign = incomes.reduce((v, i) => v + i.foreignTax, 0);
  const nationalPaid = incomes.reduce((v, i) => v + i.nationalPaid, 0);
  const localPaid = incomes.reduce((v, i) => v + i.localPaid, 0);
  const missing: string[] = [];
  if (raw.aggregated) {
    const required: (keyof TaxProfile)[] = ['otherIncome', 'deductions', 'nationalCredits', 'localCredits', 'otherNationalPaid', 'otherLocalPaid'];
    if (!profile.confirmed || required.some(k => profile[k] === null)) missing.push('다른 소득금액·공제·기납부세액을 확인해 주세요.');
    if (incomes.some(i => i.foreign && i.gross > 0) && (profile.foreignEligibleTax === null || profile.foreignLocalCredit === null)) missing.push('외국납부세액 공제 대상액과 지방소득세 공제액을 확인해 주세요.');
  }
  if (incomes.some(i => i.taxClass === 'high' && i.highElected && !i.highEvidence.trim() && profile.year <= i.highThroughYear)) missing.push('고배당기업 특례 자격 증빙을 확인해 주세요. 일반 배당으로 계산했어요.');
  const complete = missing.length === 0;
  const incrementalNational = raw.national - base.national, incrementalLocal = raw.local - base.local;
  const withholdingNet = gross - foreign - nationalPaid - localPaid;
  const usable = complete ? gross - foreign - incrementalNational - incrementalLocal : withholdingNet;
  const paidNational = nationalPaid + profile.interest * .14 + (profile.otherNationalPaid ?? 0);
  const paidLocal = localPaid + profile.interest * .014 + (profile.otherLocalPaid ?? 0);
  const canSettle = complete && profile.confirmed && [profile.otherIncome,profile.deductions,profile.nationalCredits,profile.localCredits,profile.otherNationalPaid,profile.otherLocalPaid].every(v => v !== null);
  return { ...raw, year: profile.year, ruleVersion: TAX_VERSION, gross, foreign, nationalPaid, localPaid,
    complete, missing, incrementalNational: complete ? won(incrementalNational) : null,
    incrementalLocal: complete ? won(incrementalLocal) : null, withholdingNet: won(withholdingNet), usable: won(usable),
    settlementNational: canSettle ? won(raw.national - paidNational) : null, settlementLocal: canSettle ? won(raw.local - paidLocal) : null,
    reporting: raw.aggregated || raw.specialGross > 0,
    reason: raw.financial > THRESHOLD ? '세전 이자와 합산 대상 배당이 연 2,000만 원을 넘어요.' : raw.forced ? '국내 원천징수 절차가 없는 금융소득이 있어요. 기준 이하라도 신고를 확인해 주세요.' : raw.specialGross > 0 ? '고배당기업 특례를 신청하려면 신고가 필요해요.' : '입력한 합산 대상 금융소득은 연 2,000만 원 이하예요. 다른 신고 사유는 별도로 확인해 주세요.' };
}
