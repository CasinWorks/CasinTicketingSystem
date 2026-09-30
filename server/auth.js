import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function resolveRole(password) {
  const ownerPass = process.env.APP_OWNER_PASSWORD;
  const memberPass = process.env.APP_PASSWORD;

  if (ownerPass && password === ownerPass) return 'owner';
  if (memberPass && password === memberPass) {
    // If no separate owner password is configured, the shared password is the owner.
    return ownerPass ? 'member' : 'owner';
  }
  return null;
}

function tokenSecret() {
  return process.env.TOKEN_SECRET || process.env.APP_OWNER_PASSWORD || process.env.APP_PASSWORD || '';
}

function signToken(role) {
  const payload = Buffer.from(
    JSON.stringify({ role, exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data?.role || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function login(password) {
  if (!process.env.APP_PASSWORD && !process.env.APP_OWNER_PASSWORD) {
    const err = new Error('APP_PASSWORD is not configured on the server');
    err.status = 500;
    throw err;
  }

  const role = resolveRole(password);
  if (!role) {
    const err = new Error('Invalid password');
    err.status = 401;
    throw err;
  }

  return { token: signToken(role), role };
}

function getSession(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const data = readToken(token);
  if (!data) return null;
  return { token, role: data.role, createdAt: data.exp - TOKEN_TTL_MS };
}

export function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  req.session = session;
  next();
}

/** Finance module — owner/admin only (Christian). */
export function requireOwner(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  if (session.role !== 'owner') {
    return res.status(403).json({ error: 'Finance is restricted to the owner account.' });
  }
  req.session = session;
  next();
}

export function getMe(req) {
  const session = getSession(req);
  if (!session) return null;
  return { role: session.role, isOwner: session.role === 'owner' };
}

export function logout(_token) {
  // Tokens are signed and stateless so they stay valid across Vercel instances.
}
