import { topTenor } from '../lib/tenor.js';

export function createHandler(top = topTenor) {
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
    if ([...params.keys()].some(key => key !== 'limit' || params.getAll(key).length !== 1)) {
      return fail(400, 'invalid_query', 'Only limit is supported, once.');
    }
    const rawLimit = params.get('limit') ?? '20';
    if (!/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50) {
      return fail(400, 'invalid_query', 'limit must be an integer from 1 to 50.');
    }
    try {
      const results = await top(Number(rawLimit));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
      return send(200, { query: '', count: results.length, results });
    } catch (error) {
      return error.status === 504
        ? fail(504, 'upstream_timeout', 'Tenor request timed out.')
        : fail(502, 'upstream_error', 'Tenor homepage is currently unavailable.');
    }
  };
}

export default createHandler();
