import app from '../server/index.js';

function sendError(res, err) {
  const body = JSON.stringify({
    error: err?.message || 'API failed to start',
  });
  if (res && typeof res.status === 'function') {
    res.status(500).json({ error: err?.message || 'API failed to start' });
    return;
  }
  if (res && typeof res.end === 'function') {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(body);
  }
}

export default function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    console.error(err);
    sendError(res, err);
  }
}
