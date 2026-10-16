import type { BookResult, SearchResult } from '../src/types';

export interface Env {
  KAKAO_REST_API_KEY: string;
  ALLOWED_ORIGINS: string;
  SEARCH_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
}
const secureURL = (value: unknown): string | undefined => typeof value === 'string' && value.startsWith('https://') ? value : undefined;
export function normalizeBooks(value: unknown): SearchResult {
  const data = value as { meta?: { is_end?: boolean }; documents?: Record<string, unknown>[] };
  if (!data || !Array.isArray(data.documents) || typeof data.meta?.is_end !== 'boolean') throw new Error('Invalid provider response');
  const books: BookResult[] = data.documents.filter(d => typeof d.title === 'string' && d.title.trim()).map(d => {
    const isbn = typeof d.isbn === 'string' ? d.isbn.split(' ').filter(Boolean) : [];
    return {
      title: d.title as string,
      authors: Array.isArray(d.authors) ? d.authors.filter((a): a is string => typeof a === 'string') : [],
      isbn: isbn.find(v => /^\d{13}$/.test(v)) ?? isbn.find(v => /^[\dX]{10}$/.test(v)),
      thumbnail: secureURL(d.thumbnail), sourceUrl: secureURL(d.url),
    };
  });
  return { books, hasMore: !data.meta.is_end };
}
export async function handleRequest(request: Request, env: Env, upstream: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map(v => v.trim()).filter(Boolean);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || !allowed.includes(origin)) return json({ message: '허용되지 않은 요청이에요.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  if (request.method !== 'GET') return json({ message: '지원하지 않는 요청이에요.' }, 405);
  const url = new URL(request.url);
  if (url.pathname !== '/api/books') return json({ message: '요청을 찾을 수 없어요.' }, 404);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const page = url.searchParams.get('page') ?? '1';
  if (query.length < 1 || query.length > 100 || !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 50) return json({ message: '검색어와 페이지를 확인해 주세요.' }, 400);
  if (!env.KAKAO_REST_API_KEY || !env.SEARCH_LIMITER) return json({ message: '도서 검색을 준비 중이에요. 직접 입력으로 등록할 수 있어요.' }, 503);
  try {
    // 검색 경로의 빈도 제한입니다. Origin 검사나 이 제한은 사용자 인증·전역 쿼터 보장을 대신하지 않습니다.
    const limit = await env.SEARCH_LIMITER.limit({ key: 'book-search-global' });
    if (!limit.success) return json({ message: '검색 요청이 많아요. 잠시 뒤 다시 시도해 주세요.' }, 429);
    const provider = new URL('https://dapi.kakao.com/v3/search/book');
    provider.search = new URLSearchParams({ query, page, size: '10', sort: 'accuracy' }).toString();
    const response = await upstream(provider, { headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return json({ message: response.status === 429 ? '검색 이용 한도에 도달했어요. 잠시 뒤 다시 시도해 주세요.' : '검색을 불러오지 못했어요. 직접 입력으로 등록할 수 있어요.' }, response.status === 429 ? 429 : 502);
    return json(normalizeBooks(await response.json()));
  } catch {
    return json({ message: '검색 연결이 원활하지 않아요. 다시 시도하거나 직접 입력해 주세요.' }, 502);
  }
}
export default { fetch: (request: Request, env: Env) => handleRequest(request, env) };
