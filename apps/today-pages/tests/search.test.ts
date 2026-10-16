import { describe, expect, it, vi } from 'vitest';
import { handleRequest, normalizeBooks, type Env } from '../worker';

const env = (): Env => ({ KAKAO_REST_API_KEY: 'test-secret', ALLOWED_ORIGINS: 'http://127.0.0.1:5176,https://app.apps.tossmini.com', SEARCH_LIMITER: { limit: async () => ({ success: true }) } });
const request = (query = 'q=책&page=1', origin = 'http://127.0.0.1:5176') => new Request(`https://search.example/api/books?${query}`, { headers: { Origin: origin } });
describe('도서 검색 중계', () => {
  it('ISBN13과 HTTPS 출처만 정규화하고 소개·가격은 전달하지 않는다', () => {
    expect(normalizeBooks({ meta: { is_end: false }, documents: [{ title: '책', authors: ['작가'], isbn: '123456789X 9781234567890', thumbnail: 'http://unsafe/image', url: 'https://search.daum.net/book', contents: '소개', price: 1000 }] })).toEqual({ books: [{ title: '책', authors: ['작가'], isbn: '9781234567890', thumbnail: undefined, sourceUrl: 'https://search.daum.net/book' }], hasMore: true });
  });
  it('키를 서버 요청에만 넣고 앱 응답에 포함하지 않는다', async () => {
    const provider = vi.fn(async () => Response.json({ meta: { is_end: true }, documents: [] }));
    const response = await handleRequest(request(), env(), provider);
    const [url, init] = provider.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe('/v3/search/book'); expect(url.searchParams.get('size')).toBe('10');
    expect(init.headers).toEqual({ Authorization: 'KakaoAK test-secret' });
    expect(await response.text()).not.toContain('secret'); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5176');
  });
  it('허용하지 않은 출처와 잘못된 검색을 차단한다', async () => {
    const provider = vi.fn();
    expect((await handleRequest(request('q=책', 'https://evil.example'), env(), provider)).status).toBe(403);
    for (const query of ['q=&page=1', 'q=책&page=0', 'q=책&page=51', 'q=책&page=1.5']) expect((await handleRequest(request(query), env(), provider)).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it('키 누락·빈 결과·제한·실패를 구분하고 내부 오류를 노출하지 않는다', async () => {
    expect((await handleRequest(request(), { ...env(), KAKAO_REST_API_KEY: '' })).status).toBe(503);
    expect((await handleRequest(request(), { ...env(), SEARCH_LIMITER: { limit: async () => ({ success: false }) } })).status).toBe(429);
    expect((await handleRequest(request(), env(), async () => new Response('', { status: 429 }))).status).toBe(429);
    const response = await handleRequest(request(), env(), async () => { throw new Error('private-provider-key'); });
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('private-provider');
  });
});
