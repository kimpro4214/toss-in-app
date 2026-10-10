import type { Account, Income, Position, State } from './types';
import { calculateTax, incomeWithholding, won } from './tax';
export function positionError(p: Position, a?: Account): string | null {
  if (!a) return '계좌를 선택해 주세요.';
  if (!p.name.trim()) return '종목 이름을 입력해 주세요.';
  if (p.quantity <= 0 || p.price <= 0 || p.dividend < 0 || ![p.quantity, p.price, p.dividend].every(Number.isFinite)) return '수량·가격은 0보다 크게, 배당금은 0 이상으로 입력해 주세요.';
  if (p.months.length === 0 || p.months.some(m => m < 1 || m > 12) || new Set(p.months).size !== p.months.length) return '배당 지급월을 선택해 주세요.';
  if (a.kind !== 'taxable' && (p.market === 'US' || ((a.kind === 'pension' || a.kind === 'irp') && p.instrument === 'stock'))) return '이 계좌에는 국내 상장 ETF만 등록할 수 있어요. ISA는 국내 주식도 가능해요.';
  if (a.kind !== 'taxable' && !p.accountEligible) return '증권사에서 이 계좌에 편입할 수 있는 상품인지 확인해 주세요.';
  if ((a.kind === 'pension' || a.kind === 'irp') && p.leveraged) return '연금계좌에는 레버리지·인버스 ETF를 등록할 수 없어요.';
  if (p.taxClass === 'high' && (p.instrument !== 'stock' || p.market !== 'KR')) return '고배당기업 특례는 국내 대상 기업의 현금배당에만 적용해요.';
  if (!Number.isInteger(p.highThroughYear) || p.highThroughYear < 2026 || p.highThroughYear > 2030) return '특례의 마지막 배당 수령연도를 확인해 주세요.';
  return null;
}
export function toIncome(p: Position, gross: number): Income {
  const basic = { foreign: p.market === 'US', domesticProcedure: p.domesticProcedure, taxClass: p.taxClass, separateRate: p.separateRate, grossUp: p.grossUp, highEvidence: p.highEvidence, highElected: p.highElected,highThroughYear:p.highThroughYear };
  return { gross, ...basic, ...incomeWithholding(gross, { ...basic, foreignRate: p.foreignRate }) };
}
export function isaSettlement(a: Account, addedProfit = 0) {
  const netProfit = Math.max(0, a.cumulativeProfit + addedProfit - a.cumulativeLoss);
  return { netProfit, exemption: Math.min(netProfit, a.isaExemption), tax: won(Math.max(0, netProfit - a.isaExemption) * .099) };
}
export function pensionIncome(a: Account, annualDividend: number, value: number, year: number, startYear: number) {
  const age = a.pensionAge + year - startYear, pensionYear = a.pensionYear + year - startYear;
  const eligible = age >= 55 && year - a.openedYear >= 5 && !a.deferredRetirement;
  const requested = Math.min(a.annualWithdrawal, annualDividend);
  const limit = pensionYear >= 11 ? Infinity : value / (11 - pensionYear) * 1.2;
  const exempt = Math.min(a.afterTaxPrincipal, requested);
  const taxable = Math.max(0, requested - exempt);
  const normal = Math.max(0, Math.min(requested, limit) - exempt);
  const outside = taxable - normal;
  const rate = age >= 80 ? .033 : age >= 70 ? .044 : .055;
  return { usable: eligible ? requested : 0, exempt: eligible ? exempt : 0, taxable: eligible ? taxable : 0, normal: eligible ? normal : 0, outside: eligible ? outside : 0, tax: eligible ? normal * rate + outside * .165 : 0, eligible, limit };
}
export function portfolio(s: State, year = s.tax.year) {
  const factor = (p: Position) => p.market === 'US' ? s.fx : 1;
  const grossOf = (p: Position) => p.quantity * p.dividend * factor(p);
  const incomes: Income[] = [], locked: { name: string; gross: number; note: string; settlement?: ReturnType<typeof isaSettlement> }[] = [];
  let pensionCash = 0, pensionTax = 0, totalPensionNormal = 0;
  const pensions: ReturnType<typeof pensionIncome>[] = [];
  for (const a of s.accounts) {
    const positions = s.positions.filter(p => p.accountId === a.id);
    const gross = positions.reduce((v, p) => v + grossOf(p), 0), value = positions.reduce((v, p) => v + p.quantity * p.price * factor(p), 0);
    if (a.kind === 'taxable' || (a.kind === 'isa' && year > a.settlementYear)) { positions.forEach(p => incomes.push(toIncome(p, grossOf(p)))); }
    else if (a.kind === 'isa') locked.push({ name: a.name, gross, note: '만기 정산 전 운용수익이에요. 현재 생활비에서 제외해요.', settlement: isaSettlement(a, gross) });
    else {
      const pension = pensionIncome(a, gross, value, year, s.tax.year);
      pensions.push(pension); totalPensionNormal += pension.normal; pensionCash += pension.usable; pensionTax += pension.tax;
      locked.push({ name: a.name, gross: gross - pension.usable, note: a.deferredRetirement ? '퇴직급여 이연분의 세액 계산은 지원하지 않아요. 인출액을 제외해요.' : pension.eligible ? '직접 입력한 인출액만 생활비에 포함해요.' : '55세·가입 5년 조건을 충족하지 않아 생활비에서 제외해요.' });
    }
  }
  // 사적연금 합산 과세대상액 1,500만 원 초과 시 16.5% 분리과세 선택을 가정해요.
  if (totalPensionNormal > 15000000) pensionTax = pensions.reduce((v, p) => v + (p.normal + p.outside) * .165, 0);
  const tax = calculateTax(incomes, { ...s.tax, year });
  const gross = s.positions.reduce((v, p) => v + grossOf(p), 0);
  const value = s.positions.reduce((v, p) => v + p.quantity * p.price * factor(p), 0);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, cash: 0 }));
  for (const p of s.positions) {
    const a = s.accounts.find(a => a.id === p.accountId)!;
    if (a.kind === 'taxable' || (a.kind === 'isa' && year > a.settlementYear)) {
      const inc = toIncome(p, grossOf(p));
      for (const m of p.months) months[m - 1].cash += (inc.gross - inc.foreignTax - inc.nationalPaid - inc.localPaid) / p.months.length;
    }
  }
  return { tax, gross: won(gross), value: won(value), usable: won(tax.usable + pensionCash - pensionTax), pensionTax: won(pensionTax), pensionCash: won(pensionCash), months, locked, healthIncluded: s.fire.healthMode === 'manual', year };
}
export function targetExpense(s: State): number | null {
  return s.fire.healthMode === 'manual' && s.fire.healthMonthly === null ? null : s.fire.expense + (s.fire.healthMode === 'manual' ? s.fire.healthMonthly! : 0);
}
export function requiredCapital(s: State): { value: number | null; reason: string } {
  const expense = targetExpense(s);
  if (expense === null) return { value: null, reason: '건강보험료를 입력해 주세요. 0원도 입력할 수 있어요.' };
  if (expense <= 0) return { value:null,reason:'목표 월 생활비를 0원보다 크게 입력해 주세요.' };
  const current = portfolio(s);
  if (!s.positions.length || current.value <= 0 || current.gross <= 0) return { value: null, reason: '배당이 있는 종목을 먼저 등록해 주세요.' };
  const scaled = (scale: number) => portfolio({ ...s, positions: s.positions.map(p => ({ ...p, quantity: p.quantity * scale })) });
  let high = 1;
  while (high < 1024 && scaled(high).usable < expense * 12) high *= 2;
  if (scaled(high).usable < expense * 12) return { value: null, reason: '인출 제한 또는 배당 부족으로 현재 구성에서 목표에 도달하지 못해요.' };
  let low = 0;
  for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (scaled(mid).usable >= expense * 12) high = mid; else low = mid; }
  const result = scaled(high);
  if (!result.tax.complete) return { value: null, reason: '필요 투자금의 종합과세 계산에 상세 세금 정보가 필요해요.' };
  return { value: won(current.value * high), reason: '현재 비중·배당률·올해 세법으로 세금을 반복 계산했어요. 계좌 납입 한도와 미래 편입은 별도로 확인해 주세요.' };
}
export { simulate } from './simulation';
