import app from '../server/index.js';

function requestUrl(req) {
  const current = new URL(req.url || '/', 'http://localhost');
  const forwarded = req.query?.__path || current.searchParams.get('__path');
  if (forwarded) {
    current.searchParams.delete('__path');
    const qs = current.searchParams.toString();
    return `/api/${forwarded}${qs ? `?${qs}` : ''}`;
  }
  if (String(req.url || '').startsWith('/api')) return req.url;
  return '/api/health';
}

export default function handler(req, res) {
  try {
    req.url = requestUrl(req);
    if (req.query && typeof req.query === 'object') delete req.query.__path;
    return app(req, res);
  } catch (err) {
    console.error(err);
    const body = { error: err?.message || 'API failed to start' };
    if (typeof res.status === 'function') {
      res.status(500).json(body);
      return;
    }
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  }
}
