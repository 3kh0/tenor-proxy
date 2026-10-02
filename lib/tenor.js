const FORMATS = ['gif', 'mediumgif', 'tinygif', 'gifpreview', 'mp4', 'tinymp4', 'webm', 'webp', 'tinywebp'];
const dimension = n => Number.isFinite(n) && n > 0 ? n : null;
const text = s => typeof s === 'string' ? s : '';

export class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function safeUrl(value, media = false) {
  try {
    const url = new URL(value);
    const allowed = media ? /^media\d*\.tenor\.com$/ : /^(?:www\.)?tenor\.com$/;
    return url.protocol === 'https:' && allowed.test(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function parseSearch(html, limit) {
  return parsePage(html, limit, store => {
    const pages = Object.values(store.universal.search);
    if (pages.length !== 1) throw new Error('Unexpected search data');
    return pages[0].results;
  });
}

export function parseTop(html, limit) {
  return parsePage(html, limit, store => store.gifs.featured.results);
}

function parsePage(html, limit, selectResults) {
  const match = html.match(/<script\b(?=[^>]*\bid\s*=\s*["']store-cache["'])[^>]*>([\s\S]*?)<\/script\s*>/i);
  try {
    if (!match) throw new Error('Missing page data');
    const items = selectResults(JSON.parse(match[1]));
    if (!Array.isArray(items)) throw new Error('Unexpected page data');
    const results = items.map(item => {
      if (typeof item?.id !== 'string' || !/^\d+$/.test(item.id)) return;
      const media = {};
      for (const name of FORMATS) {
        const f = item.media_formats?.[name];
        const url = safeUrl(f?.url, true);
        const [w, h] = Array.isArray(f?.dims) ? f.dims : [];
        if (url) media[name] = { url, width: dimension(w), height: dimension(h) };
      }
      const gif = media.gif ?? media.mediumgif ?? media.tinygif;
      const url = safeUrl(item.itemurl);
      if (!gif || !url) return;
      return {
        id: item.id,
        title: text(item.h1_title),
        description: text(item.content_description),
        url,
        gif: gif.url,
        preview: media.gifpreview?.url ?? media.tinygif?.url ?? gif.url,
        width: gif.width,
        height: gif.height,
        media,
      };
    }).filter(Boolean).slice(0, limit);
    if (items.length && !results.length) throw new Error('No usable GIFs');
    return results;
  } catch {
    throw new UpstreamError('Tenor returned an unsupported page format.');
  }
}

export async function searchTenor(q, limit, fetchImpl = fetch) {
  const url = `https://tenor.com/search/${encodeURIComponent(q.replace(/\s+/gu, '-'))}-gifs`;
  return fetchPage(url, limit, parseSearch, fetchImpl);
}

export async function topTenor(limit, fetchImpl = fetch) {
  return fetchPage('https://tenor.com/', limit, parseTop, fetchImpl);
}

async function fetchPage(url, limit, parse, fetchImpl) {
  const signal = AbortSignal.timeout(8000);
  try {
    const response = await fetchImpl(url, {
      signal,
      redirect: 'error',
      headers: { Accept: 'text/html', 'User-Agent': 'TenorProxy/0.1' },
    });
    if (!response.ok) throw new UpstreamError('Tenor is temporarily unavailable.');
    if (!response.headers.get('content-type')?.includes('text/html') || !response.body) {
      throw new UpstreamError('Tenor returned an unsupported response.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 4 * 1024 * 1024) throw new UpstreamError('Tenor response exceeded the size limit.');
      chunks.push(Buffer.from(chunk));
    }
    return parse(Buffer.concat(chunks).toString('utf8'), limit);
  } catch (error) {
    if (signal.aborted || error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new UpstreamError('Tenor request timed out.', 504);
    }
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError('Could not reach Tenor.');
  }
}
