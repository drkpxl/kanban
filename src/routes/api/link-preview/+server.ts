import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface PreviewResult {
  url: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
}

const MAX_CACHE_SIZE = 500;
const cache = new Map<string, PreviewResult>();

function extractMeta(html: string, rawUrl: string): PreviewResult {
  const og = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))?.[1] ?? '';

  const base = new URL(rawUrl);

  const title =
    og('title') ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ||
    base.hostname;

  const description =
    og('description') ||
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    '';

  const rawImage = og('image') || null;
  const image = rawImage
    ? rawImage.startsWith('http')
      ? rawImage
      : `${base.origin}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
    : null;

  const iconHref = html.match(
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i
  )?.[1];
  const favicon = iconHref
    ? iconHref.startsWith('http')
      ? iconHref
      : `${base.origin}${iconHref.startsWith('/') ? '' : '/'}${iconHref}`
    : `${base.origin}/favicon.ico`;

  return {
    url: rawUrl,
    title: title.trim(),
    description: description.trim(),
    image,
    favicon,
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get('url');
  if (!target) throw error(400, 'url parameter required');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw error(400, 'Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw error(400, 'Only http/https URLs allowed');
  }

  const cached = cache.get(target);
  if (cached) return json(cached);

  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KanbanBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw error(502, 'Could not fetch URL');

    const contentType = res.headers.get('Content-Type') ?? '';
    if (!contentType.includes('text/html')) throw error(502, 'URL did not return HTML');

    const contentLength = res.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
      throw error(502, 'Response too large');
    }

    const html = await res.text();
    const result = extractMeta(html, target);
    if (cache.size >= MAX_CACHE_SIZE) {
      cache.delete(cache.keys().next().value!);
    }
    cache.set(target, result);
    return json(result);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) throw e;
    throw error(502, 'Failed to fetch URL');
  }
};
