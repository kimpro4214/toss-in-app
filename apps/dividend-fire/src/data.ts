export interface DartDividend { amount: number; year: number; stockKind: string; receipt: string; asOf: string; url: string; company: string }
export const dividendLookupAvailable = Boolean(import.meta.env.VITE_DART_PROXY_URL?.trim());
export async function lookupDividend(corp: string, year: number, stockKind: string): Promise<DartDividend> {
  if (!/^\d{8}$/.test(corp)) throw new Error('DART 고유번호 8자리를 입력해 주세요. 종목코드 6자리와 달라요.');
  const endpoint = import.meta.env.VITE_DART_PROXY_URL;
  if (!endpoint) throw new Error('배당 조회가 아직 연결되지 않았어요. 공시를 확인해서 직접 입력할 수 있어요.');
  const query = new URLSearchParams({ corp_code: corp, year: String(year), stock_kind: stockKind });
  const response = await fetch(`${endpoint}/dividend?${query}`, { signal: AbortSignal.timeout(10000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || '조회에 실패했어요. 직접 입력해 주세요.');
  if (!Number.isFinite(result.amount) || result.amount < 0) throw new Error('배당 자료가 없어요. 0원과는 달라요.');
  return result;
}
