interface Env { DART_KEY: string; ALLOWED_ORIGINS: string }
interface DartRow { se: string; stock_knd: string; thstrm: string; rcept_no: string; corp_name: string }
export function parseDart(data: { status: string; list?: DartRow[] }, stockKind: string) {
  if (data.status !== '000') throw new Error(data.status === '013' ? '해당 연도 배당 자료가 없어요.' : data.status === '020' ? '무료 조회 한도를 넘었어요. 직접 입력해 주세요.' : 'DART 조회에 실패했어요. 직접 입력해 주세요.');
  const rows = (data.list ?? []).filter(row => row.se.replace(/\s/g, '') === '(현금)주당배당금(원)' && row.stock_knd === stockKind);
  // 연간 보고서의 현재연도 수치 하나만 사용하고 분기 누계는 합산하지 않아요.
  if (rows.length !== 1) throw new Error('주식 종류에 맞는 배당 자료가 없거나 여러 건이에요. 공시를 직접 확인해 주세요.');
  const row = rows[0], amount = Number(row.thstrm.replace(/,/g, ''));
  if (!row.thstrm.trim() || row.thstrm === '-' || !Number.isFinite(amount) || amount < 0) throw new Error('배당 금액이 확인되지 않았어요.');
  return { amount, stockKind, receipt: row.rcept_no, company: row.corp_name, url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${row.rcept_no}` };
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim());
    if (!origin || !origins.includes(origin)) return new Response('Forbidden', { status: 403 });
    const headers = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Content-Type': 'application/json; charset=utf-8' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    const url = new URL(request.url), corp = url.searchParams.get('corp_code') ?? '', year = Number(url.searchParams.get('year')), stockKind = url.searchParams.get('stock_kind') ?? '';
    const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (request.method !== 'GET' || url.pathname !== '/dividend' || !/^\d{8}$/.test(corp) || !Number.isInteger(year) || year < 2015 || year > new Date().getUTCFullYear() || !['보통주','우선주'].includes(stockKind)) return respond({ message: '조회 조건을 확인해 주세요.' }, 400);
    if (!env.DART_KEY) return respond({ message: '조회 연결을 준비 중이에요. 직접 입력해 주세요.' }, 503);
    const cache = (caches as unknown as { default: Cache }).default;
    const cacheKey = new Request(`https://dividend-cache.invalid/${corp}/${year}/${encodeURIComponent(stockKind)}`);
    const cached = await cache.match(cacheKey);
    if (cached) return respond(await cached.json());
    try {
      const query = new URLSearchParams({ crtfc_key: env.DART_KEY, corp_code: corp, bsns_year: String(year), reprt_code: '11011' });
      const response = await fetch(`https://opendart.fss.or.kr/api/alotMatter.json?${query}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('공시 조회에 실패했어요.');
      const result = { ...parseDart(await response.json() as Parameters<typeof parseDart>[0], stockKind), year, asOf: new Date().toISOString() };
      await cache.put(cacheKey, Response.json(result, { headers: { 'Cache-Control': 'public, max-age=86400' } }));
      return respond(result);
    } catch (error) { return respond({ message: error instanceof Error ? error.message : '직접 입력해 주세요.' }, 503); }
  },
};
