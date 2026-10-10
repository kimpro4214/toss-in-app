import type { State } from './types';
import { isaSettlement, pensionIncome, portfolio, targetExpense } from './engine';
import { TAX_VERSION, won } from './tax';
export function simulate(s: State) {
  const metadata={ taxYear:s.tax.year,ruleVersion:TAX_VERSION,healthIncluded:s.fire.healthMode==='manual' };
  const monthly = targetExpense(s);
  if (monthly === null || monthly <= 0 || s.positions.length === 0) return { ...metadata,points: [], reached: null, deteriorates: false, incomplete: false, blocked: '생활비·건강보험료와 종목을 확인해 주세요.', uninvested: 0 };
  const current = portfolio(s);
  const weights = s.positions.map(p => p.quantity * p.price * (p.market === 'US' ? s.fx : 1) / current.value);
  let positions = structuredClone(s.positions), accounts = structuredClone(s.accounts), reached: number | null = null, incomplete = false, uninvested = 0;
  const points: { year: number; coverage: number; usable: number; expense: number; capital: number }[] = [];
  const reserves: Record<string,number> = Object.fromEntries(accounts.map(a => [a.id,0]));
  const lifetime: Record<string,number> = Object.fromEntries(accounts.map(a => [a.id,a.isaLifetimeRemaining]));
  for (let offset = 0; offset <= s.fire.horizon; offset++) {
    const year = s.tax.year + offset;
    if (offset > 0) positions = positions.map(p => ({ ...p,price:p.price*(1+s.fire.priceGrowth/100),dividend:p.dividend*(1+s.fire.dividendGrowth/100) }));
    const snapshot = portfolio({ ...s,positions,accounts },year);
    incomplete ||= !snapshot.tax.complete;
    const expense = monthly * 12 * Math.pow(1+s.fire.inflation/100,offset);
    const coverage = snapshot.usable / expense;
    points.push({ year,coverage,usable:snapshot.usable,expense:won(expense),capital:snapshot.value });
    if (coverage >= 1 && reached === null && !incomplete) reached = year;
    if (offset === s.fire.horizon) break;
    const allowance: Record<string,number> = Object.fromEntries(accounts.map(a => [a.id,offset === 0 ? a.contributionRemaining : a.kind === 'isa' ? Math.min(20000000+(reserves[`${a.id}:carry`] || 0),lifetime[a.id]) : 18000000]));
    let pensionAllowance = Math.min(18000000,accounts.filter(a => a.kind === 'pension' || a.kind === 'irp').reduce((v,a) => v+allowance[a.id],0));
    const isaProfit: Record<string,number> = Object.fromEntries(accounts.map(a => [a.id,0]));
    for (let month = 1; month <= 12; month++) {
      const before = portfolio({ ...s,positions,accounts },year);
      const dividends = positions.map(p => p.months.includes(month) ? p.quantity*p.dividend*(p.market === 'US' ? s.fx : 1)/p.months.length : 0);
      const cashGross = positions.reduce((v,p,i) => { const a = accounts.find(a => a.id === p.accountId)!; return a.kind === 'taxable' || (a.kind === 'isa' && year > a.settlementYear) ? v+dividends[i] : v; },0);
      const pensionCash = Math.max(0,before.pensionCash-before.pensionTax)/12;
      const cashRatio = before.tax.gross > 0 ? Math.max(0,Math.min(1,before.tax.usable/before.tax.gross)) : 0;
      const freeReinvest = reached === null ? (cashGross*cashRatio+pensionCash)*s.fire.reinvest/100 : 0;
      const fresh = reached === null ? s.fire.contribution : 0;
      const riskRoom: Record<string,number> = Object.fromEntries(accounts.filter(a => a.kind==='irp').map(a => { const ps=positions.filter(p => p.accountId===a.id), total=ps.reduce((v,p) => v+p.quantity*p.price,0), risky=ps.filter(p => p.pensionRisk==='risky').reduce((v,p) => v+p.quantity*p.price,0); return [a.id,Math.max(0,(total*.7-risky)/.3)]; }));
      // 같은 달의 배당은 월말 매수 전 보유 수량으로 확정해요.
      positions = positions.map((p,index) => {
        const a = accounts.find(a => a.id === p.accountId)!, fx = p.market === 'US' ? s.fx : 1;
        let lockedReinvest = 0;
        if (a.kind === 'isa' && year <= a.settlementYear) {
          isaProfit[a.id] += dividends[index];
          if (year === a.settlementYear) reserves[a.id] += dividends[index];
          else if (reached === null) lockedReinvest = dividends[index]*s.fire.reinvest/100;
        } else if (a.kind === 'pension' || a.kind === 'irp') {
          const ps = positions.filter(p => p.accountId === a.id), gross = ps.reduce((v,p) => v+p.quantity*p.dividend*(p.market === 'US' ? s.fx : 1),0);
          const value=ps.reduce((v,p) => v+p.quantity*p.price,0);
          const withdrawalFraction = pensionIncome(a,gross,value,year,s.tax.year).usable/Math.max(1,gross);
          if (reached === null) lockedReinvest = dividends[index]*(1-withdrawalFraction)*s.fire.reinvest/100;
        }
        let buy = (fresh+freeReinvest)*weights[index];
        if (a.kind === 'irp' && p.pensionRisk === 'risky') {
          const permitted=Math.min(buy+lockedReinvest,riskRoom[a.id]);
          const lockedAllowed=Math.min(lockedReinvest,permitted);
          uninvested+=lockedReinvest-lockedAllowed; lockedReinvest=lockedAllowed;
          buy=Math.min(buy,permitted-lockedAllowed); riskRoom[a.id]-=permitted;
        }
        if (a.kind === 'isa' && year <= a.settlementYear) { buy = Math.min(buy,allowance[a.id],lifetime[a.id]); allowance[a.id] -= buy; lifetime[a.id] -= buy; }
        if (a.kind === 'pension' || a.kind === 'irp') { buy = Math.min(buy,allowance[a.id],pensionAllowance); allowance[a.id] -= buy; pensionAllowance -= buy; }
        uninvested += Math.max(0,(fresh+freeReinvest)*weights[index]-buy);
        return { ...p,quantity:p.quantity+(buy+lockedReinvest)/(p.price*fx) };
      });
    }
    accounts = accounts.map(a => {
      if (a.kind === 'isa' && year <= a.settlementYear) {
        const cumulativeProfit = a.cumulativeProfit+isaProfit[a.id];
        reserves[`${a.id}:carry`] = allowance[a.id];
        if (year === a.settlementYear) {
          const tax = isaSettlement({ ...a,cumulativeProfit }).tax;
          if (reserves[a.id] < tax) { incomplete = true; reached = null; }
          else if (reached === null) {
            const net = Math.max(0,reserves[a.id]-tax)*s.fire.reinvest/100;
            const ps = positions.filter(p => p.accountId === a.id), total = ps.reduce((v,p) => v+p.quantity*p.price,0);
            positions = positions.map(p => p.accountId === a.id ? { ...p,quantity:p.quantity+net*(p.quantity*p.price/Math.max(1,total))/p.price } : p);
          }
          reserves[a.id]=0;
        }
        return { ...a,cumulativeProfit };
      }
      if (a.kind === 'pension' || a.kind === 'irp') {
        const ps = positions.filter(p => p.accountId === a.id), gross = ps.reduce((v,p) => v+p.quantity*p.dividend,0), value = ps.reduce((v,p) => v+p.quantity*p.price,0);
        const pension = pensionIncome(a,gross,value,year,s.tax.year);
        return { ...a,afterTaxPrincipal:Math.max(0,a.afterTaxPrincipal-pension.exempt) };
      }
      return a;
    });
  }
  return { ...metadata,points,reached,deteriorates:reached !== null && points.some(p => p.year > reached! && p.coverage < 1),incomplete,blocked:'',uninvested:won(uninvested) };
}
