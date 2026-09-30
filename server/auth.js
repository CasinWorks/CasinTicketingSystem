import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map();

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

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now(), role });
  return { token, role };
}

function getSession(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (Date.now() - session.createdAt > TOKEN_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
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

export function logout(token) {
  if (token) sessions.delete(token);
}
