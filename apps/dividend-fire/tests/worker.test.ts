import { afterEach,expect,it,vi } from 'vitest';
import worker from '../worker/index';
afterEach(() => vi.unstubAllGlobals());
const env={ DART_KEY:'test-only-key',ALLOWED_ORIGINS:'https://dividend.example' };
const request=() => new Request('https://worker.example/dividend?corp_code=00126380&year=2025&stock_kind=보통주',{ headers:{ Origin:'https://dividend.example' } });
it('알 수 없는 Origin과 보유 정보를 포함한 POST 요청을 거절',async () => {
  expect((await worker.fetch(new Request('https://worker.example/dividend'),env)).status).toBe(403);
  const r=await worker.fetch(new Request('https://worker.example/dividend',{ method:'POST',headers:{ Origin:'https://dividend.example' },body:'{"holdings":100}' }),env);
  expect(r.status).toBe(400);
});
it('연간 현재연도 자료를 캐시하고 서버 응답에는 인증키를 포함하지 않음',async () => {
  const stored=new Map<string,Response>();
  vi.stubGlobal('caches',{ default:{ match:async (r:Request) => stored.get(r.url)?.clone(),put:async (r:Request,v:Response) => { stored.set(r.url,v); } } });
  const fetch=vi.fn(async (url:string) => { const q=new URL(url).searchParams; expect(q.get('reprt_code')).toBe('11011'); expect(q.has('quantity')).toBe(false); return Response.json({ status:'000',list:[{ se:'(현금)주당배당금(원)',stock_knd:'보통주',thstrm:'1,500',rcept_no:'20260301000001',corp_name:'예시 기업' }] }); });
  vi.stubGlobal('fetch',fetch);
  const r=await worker.fetch(request(),env); expect(r.status).toBe(200); expect(await r.text()).not.toContain(env.DART_KEY);
  expect((await (await worker.fetch(request(),env)).json() as { amount:number }).amount).toBe(1500); expect(fetch).toHaveBeenCalledTimes(1);
});
it('무료 한도 오류는 직접 입력 안내로 반환',async () => {
  vi.stubGlobal('caches',{ default:{ match:async () => undefined } });
  vi.stubGlobal('fetch',async () => Response.json({ status:'020' }));
  const r=await worker.fetch(request(),env); expect(r.status).toBe(503); expect(await r.text()).toContain('직접 입력');
});
