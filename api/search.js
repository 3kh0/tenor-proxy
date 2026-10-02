import { searchTenor } from '../lib/tenor.js';

export function createHandler(search = searchTenor) {
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => {
      res.statusCode = status;
      if (body) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(body ? JSON.stringify(body) : undefined);
    };
    const fail = (status, code, message) => send(status, { error: { code, message } });
    if (req.method === 'OPTIONS') return send(204);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return fail(405, 'method_not_allowed', 'Use GET.');
    }
    const params = new URL(req.url, 'http://localhost').searchParams;
    if ([...params.keys()].some(key => !['q', 'limit'].includes(key) || params.getAll(key).length !== 1)) {
      return fail(400, 'invalid_query', 'Only q and limit are supported, once each.');
    }
    const q = (params.get('q') ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
    const rawLimit = params.get('limit') ?? '20';
    if (!q || q.length > 100 || /[\u0000-\u001f\u007f]/u.test(q) || !/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50) {
      return fail(400, 'invalid_query', 'q must be 1–100 characters; limit must be an integer from 1 to 50.');
    }
    const limit = Number(rawLimit);
    try {
      const results = await search(q, limit);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
      return send(200, { query: q, count: results.length, results });
    } catch (error) {
      const timeout = error.status === 504;
      return timeout
        ? fail(504, 'upstream_timeout', 'Tenor request timed out.')
        : fail(502, 'upstream_error', 'Tenor search is currently unavailable.');
    }
  };
}

export default createHandler();
