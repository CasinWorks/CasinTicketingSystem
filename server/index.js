import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listProjects, createProject, updateProject, listProjectsSafe } from './projectRepo.js';
import { listLeads, createLead, updateLead, listLeadsSafe } from './leadsRepo.js';
import { getServiceAccountEmail } from './googleClient.js';
import { listTickets, createTicket, updateTicket } from './sheetsRepo.js';
import { login, logout, requireAuth, requireOwner, getMe } from './auth.js';
import {
  validateCreateTicket,
  validateUpdateTicket,
  validateCreateProject,
  validateUpdateProject,
  validateCreateLead,
  validateUpdateLead,
} from './validate.js';
import { computeStats } from './stats.js';
import { projectStats, leadStats } from './opsStats.js';
import { listOpsPublic, getOp, resolveSheetId } from './opsConfig.js';
import { loadFinanceBundle } from './financeRepo.js';
import { financeDashboard, expenseSummaries } from './financeStats.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const USE_MOCK = process.env.MOCK_SHEETS === 'true';
const CLIENT_DIST =
  process.env.CLIENT_DIST || path.join(__dirname, '../client/dist');

app.set('trust proxy', 1);
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '100kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    product: 'CasinWorks OPS',
    dataSource: USE_MOCK ? 'mock' : 'google-sheets',
    sheetId: USE_MOCK ? null : resolveSheetId(getOp('service-desk')) || null,
    serviceAccount: USE_MOCK ? null : getServiceAccountEmail(),
    ops: listOpsPublic().map((o) => ({ id: o.id, status: o.status })),
  });
});


app.post('/api/login', loginLimiter, (req, res) => {
  try {
    const result = login(req.body?.password);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  logout(token);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json(getMe(req) || { role: 'member', isOwner: false });
});

app.get('/api/ops', requireAuth, (req, res) => {
  const role = req.session?.role || 'member';
  res.json(listOpsPublic(role));
});

app.get('/api/ops/:opId', requireAuth, (req, res) => {
  const op = getOp(req.params.opId);
  if (!op) return res.status(404).json({ error: 'Unknown operation' });
  if (op.ownerOnly && req.session?.role !== 'owner') {
    return res.status(403).json({ error: 'This operation is restricted to the owner account.' });
  }
  const publicOps = listOpsPublic(req.session?.role || 'member');
  const found = publicOps.find((o) => o.id === op.id);
  if (!found) return res.status(403).json({ error: 'This operation is restricted to the owner account.' });
  res.json(found);
});

/* ── Service Desk ─────────────────────────────────────────── */

app.get('/api/ops/service-desk/tickets', requireAuth, async (_req, res) => {
  try {
    res.json(await listTickets());
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list tickets' });
  }
});

app.post('/api/ops/service-desk/tickets', requireAuth, async (req, res) => {
  try {
    const result = validateCreateTicket(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.status(201).json(await createTicket(result.data));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create ticket' });
  }
});

app.patch('/api/ops/service-desk/tickets/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !/^TCK-\d+$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid ticket ID. Expected format TCK-0001' });
    }
    const result = validateUpdateTicket(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.json(await updateTicket(id.toUpperCase(), result.data));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update ticket' });
  }
});

app.get('/api/ops/service-desk/stats', requireAuth, async (_req, res) => {
  try {
    res.json(computeStats(await listTickets()));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to compute stats' });
  }
});

/* ── Project Manager ──────────────────────────────────────── */

app.get('/api/ops/project-manager/projects', requireAuth, async (_req, res) => {
  try {
    const { items, sheetWarning, source } = await listProjectsSafe();
    res.json({ items, sheetWarning, source });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list projects' });
  }
});

app.post('/api/ops/project-manager/projects', requireAuth, async (req, res) => {
  try {
    const result = validateCreateProject(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.status(201).json(await createProject(result.data));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create project' });
  }
});

app.patch('/api/ops/project-manager/projects/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !/^PRJ-\d+$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid project ID. Expected format PRJ-0001' });
    }
    const result = validateUpdateProject(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.json(await updateProject(id.toUpperCase(), result.data));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update project' });
  }
});

app.get('/api/ops/project-manager/stats', requireAuth, async (_req, res) => {
  try {
    const { items, sheetWarning, source } = await listProjectsSafe();
    res.json({ ...projectStats(items), sheetWarning, source });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to compute stats' });
  }
});

/* ── Leads ────────────────────────────────────────────────── */

app.get('/api/ops/leads/leads', requireAuth, async (_req, res) => {
  try {
    const { items, sheetWarning, source } = await listLeadsSafe();
    res.json({ items, sheetWarning, source });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list leads' });
  }
});

app.post('/api/ops/leads/leads', requireAuth, async (req, res) => {
  try {
    const result = validateCreateLead(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.status(201).json(await createLead(result.data));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create lead' });
  }
});

app.patch('/api/ops/leads/leads/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !/^LED-\d+$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid lead ID. Expected format LED-0001' });
    }
    const result = validateUpdateLead(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.json(await updateLead(id.toUpperCase(), result.data));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update lead' });
  }
});

app.get('/api/ops/leads/stats', requireAuth, async (_req, res) => {
  try {
    const { items, sheetWarning, source } = await listLeadsSafe();
    res.json({ ...leadStats(items), sheetWarning, source });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to compute stats' });
  }
});

/* ── Finance (owner-only, read-only) ─────────────────────── */

app.get('/api/ops/finance/dashboard', requireOwner, async (req, res) => {
  try {
    const includeOffBooks = String(req.query.includeOffBooks ?? 'true') !== 'false';
    const bundle = await loadFinanceBundle();
    res.json(financeDashboard(bundle, { includeOffBooks }));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load finance dashboard' });
  }
});

app.get('/api/ops/finance/billing', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({
      items: bundle.billing,
      sheetWarning: bundle.sheetWarning,
      source: bundle.source,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list billing' });
  }
});

app.get('/api/ops/finance/payments', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({
      items: bundle.payments,
      sheetWarning: bundle.sheetWarning,
      source: bundle.source,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list payments' });
  }
});

app.get('/api/ops/finance/expenses', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({
      items: bundle.expenses,
      summaries: expenseSummaries(bundle.expenses),
      sheetWarning: bundle.sheetWarning,
      source: bundle.source,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list expenses' });
  }
});

app.get('/api/ops/finance/assets', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    const totalCost = bundle.assets.reduce((s, a) => s + (a.cost || 0), 0);
    res.json({
      items: bundle.assets,
      totalCost,
      sheetWarning: bundle.sheetWarning,
      source: bundle.source,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list assets' });
  }
});

app.get('/api/ops/finance/cash', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({
      ...bundle.cash,
      sheetWarning: bundle.sheetWarning,
      source: bundle.source,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list cash' });
  }
});

app.get('/api/ops/finance/settings', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({
      settings: bundle.settings,
      sheetWarning: bundle.sheetWarning,
      source: bundle.source,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load settings' });
  }
});

app.get('/api/ops/finance/journal', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({ ...bundle.journal, sheetWarning: bundle.sheetWarning, source: bundle.source });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load journal' });
  }
});

app.get('/api/ops/finance/notes', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({ ...bundle.notes, sheetWarning: bundle.sheetWarning, source: bundle.source });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load notes' });
  }
});

app.get('/api/ops/finance/toyota-memo', requireOwner, async (_req, res) => {
  try {
    const bundle = await loadFinanceBundle();
    res.json({ ...bundle.toyotaMemo, sheetWarning: bundle.sheetWarning, source: bundle.source });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load Toyota memo' });
  }
});

/* Legacy aliases → Service Desk (backwards compatible) */
app.get('/api/tickets', requireAuth, async (_req, res) => {
  try {
    res.json(await listTickets());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to list tickets' });
  }
});
app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const result = validateCreateTicket(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.status(201).json(await createTicket(result.data));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to create ticket' });
  }
});
app.patch('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const result = validateUpdateTicket(req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
    res.json(await updateTicket(req.params.id.toUpperCase(), result.data));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to update ticket' });
  }
});
app.get('/api/stats', requireAuth, async (_req, res) => {
  try {
    res.json(computeStats(await listTickets()));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to compute stats' });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve the React build when packaged as desktop (SERVE_CLIENT=true)
if (process.env.SERVE_CLIENT === 'true') {
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    console.warn(`CLIENT_DIST missing index.html at ${CLIENT_DIST}`);
  } else {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }
}

export function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`CasinWorks OPS listening on http://127.0.0.1:${PORT}`);
      console.log(`CORS allowed origin: ${CLIENT_ORIGIN}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

const isDirectRun =
  !process.env.VERCEL &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

export default app;
