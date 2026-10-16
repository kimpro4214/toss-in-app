import type { SearchResult } from './types';
export async function searchBooks(query: string, page: number, signal: AbortSignal): Promise<SearchResult> {
  const base = import.meta.env.VITE_SEARCH_API_ORIGIN || '';
  const url = new URL('/api/books', base || location.origin);
  url.search = new URLSearchParams({ q: query, page: String(page) }).toString();
  const response = await fetch(url, { signal, credentials: 'omit' });
  let data: SearchResult & { message?: string };
  try { data = await response.json(); } catch { throw new Error('검색 연결을 확인할 수 없어요. 직접 입력으로 등록할 수 있어요.'); }
  if (!response.ok) throw new Error(data.message || '검색을 불러오지 못했어요. 직접 입력으로 등록할 수 있어요.');
  if (!Array.isArray(data.books) || typeof data.hasMore !== 'boolean') throw new Error('검색 결과를 읽을 수 없어요.');
  return data;
}
