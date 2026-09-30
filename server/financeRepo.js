import { pickField, readSheetTables } from './googleClient.js';
import { getOp, resolveSheetId } from './opsConfig.js';
import { parseMoney, parsePercent, parseDateOnly, isYes } from './money.js';
import { listProjectsSafe } from './projectRepo.js';

const CACHE_TTL_MS = Number(process.env.FINANCE_CACHE_TTL_MS || process.env.SHEETS_CACHE_TTL_MS || 45000);
let cache = { at: 0, payload: null };

function financeSheetId() {
  const id = (process.env.FINANCE_SHEET_ID || '').trim();
  if (id) return id;
  // Allow opsConfig sheetEnv for finance op
  const op = getOp('finance');
  return op ? resolveSheetId(op) : '';
}

function useLiveSheet() {
  if (process.env.MOCK_SHEETS === 'true') return false;
  return Boolean(financeSheetId());
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreNameMatch(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  const ta = new Set(na.split(' ').filter((w) => w.length > 2));
  const tb = new Set(nb.split(' ').filter((w) => w.length > 2));
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  if (!ta.size || !tb.size) return 0;
  return Math.round((hit / Math.max(ta.size, tb.size)) * 60);
}

function linkProject(projectId, clientName, pmProjects) {
  const byId = pmProjects.find((p) => String(p.ID).toUpperCase() === String(projectId || '').toUpperCase());
  if (byId) {
    return { pmId: byId.ID, pmTitle: byId.Title, pmPath: `/ops/project-manager/projects` };
  }
  let best = null;
  let bestScore = 0;
  for (const p of pmProjects) {
    const s = Math.max(scoreNameMatch(clientName, p.Title), scoreNameMatch(projectId, p.Title));
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  if (best && bestScore >= 40) {
    return { pmId: best.ID, pmTitle: best.Title, pmPath: `/ops/project-manager/projects` };
  }
  return { pmId: null, pmTitle: null, pmPath: null };
}

function mapBilling(raw, pmProjects) {
  const projectId = pickField(raw, ['Project ID', 'ProjectID']) || '';
  if (!projectId || /^note$/i.test(projectId)) return null;
  const client = pickField(raw, ['Client/Project', 'Client', 'Project']) || '';
  const status = pickField(raw, ['Status']) || '';
  if (!client && !status) return null;
  const contractValue = parseMoney(pickField(raw, ['Contract value', 'Contract Value']));
  const dpPct = parsePercent(pickField(raw, ['Down payment %', 'Down payment', 'DP %']));
  const link = linkProject(projectId, client, pmProjects);
  return {
    projectId,
    client,
    contractValue,
    status,
    downPaymentPct: dpPct,
    downPaymentAmount: Math.round((contractValue * dpPct) / 100),
    referredBy: pickField(raw, ['Referred by', 'Referred By']) || '',
    offBooks: isYes(pickField(raw, ['Off books (Y/N)', 'Off books', 'Off Books'])),
    notes: pickField(raw, ['Notes']) || '',
    ...link,
  };
}

function mapPayment(raw, billingById) {
  const paymentId = pickField(raw, ['Payment ID', 'PaymentID']) || '';
  if (!paymentId) return null;
  const projectId = pickField(raw, ['Project ID', 'ProjectID']) || '';
  const amountDue = parseMoney(pickField(raw, ['Amount due', 'Amount Due']));
  const amountReceived = parseMoney(pickField(raw, ['Amount received', 'Amount Received']));
  const dueDate = parseDateOnly(pickField(raw, ['Due date', 'Due Date']));
  const dateReceived = parseDateOnly(pickField(raw, ['Date received', 'Date Received']));
  const status = pickField(raw, ['Status']) || 'Not billed';
  const billing = billingById.get(projectId);
  const projectStatus =
    pickField(raw, ['Project Status (from Billing)', 'Project Status']) || billing?.status || '';
  const balance = Math.max(0, amountDue - amountReceived);
  return {
    paymentId,
    projectId,
    milestone: pickField(raw, ['Milestone']) || '',
    amountDue,
    dueDate,
    amountReceived,
    dateReceived,
    status,
    offBooks: isYes(pickField(raw, ['Off books', 'Off Books'])),
    notes: pickField(raw, ['Notes']) || '',
    projectStatus,
    balance,
    client: billing?.client || '',
    pmId: billing?.pmId || null,
    pmTitle: billing?.pmTitle || null,
    pmPath: billing?.pmPath || null,
  };
}

function mapExpense(raw) {
  const description = pickField(raw, ['Description']) || '';
  const category = pickField(raw, ['Category']) || '';
  if (!description && !category) return null;
  const paidFrom = pickField(raw, ['Paid from (Business/Personal)', 'Paid from', 'Paid From']) || '';
  return {
    date: parseDateOnly(pickField(raw, ['Date'])) || '',
    category,
    description,
    amount: parseMoney(pickField(raw, ['Amount'])),
    paidFrom,
    isPersonal: /personal/i.test(paidFrom),
    projectId: pickField(raw, ['Project ID', 'ProjectID']) || '',
    receiptLink: pickField(raw, ['Receipt link', 'Receipt Link']) || '',
    notes: pickField(raw, ['Notes']) || '',
  };
}

function mapAsset(raw) {
  const item = pickField(raw, ['Item']) || '';
  if (!item) return null;
  if (/^(total|expected total|related files|formal books|off-books)/i.test(item.trim())) return null;
  const cost = parseMoney(pickField(raw, ['Cost']));
  // Keep rows with a name even if cost blank; exclude pure note rows without cost/serial
  const serial = pickField(raw, ['Serial / Specs', 'Serial', 'Specs']) || '';
  if (!cost && !serial && !pickField(raw, ['Purchase date'])) {
    // likely section notes
    if (/^https?:/i.test(serial)) return null;
  }
  const extra = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    extra[k] = v;
  }
  return {
    item,
    serial,
    purchaseDate: parseDateOnly(pickField(raw, ['Purchase date', 'Purchase Date'])) || '',
    cost,
    fundedBy: pickField(raw, ['Funded by', 'Funded By']) || '',
    category: pickField(raw, ['Category']) || '',
    bookTreatment: pickField(raw, ['Book treatment', 'Book Treatment']) || '',
    receiptLink: pickField(raw, ['Receipt link', 'Receipt Link']) || '',
    notes: pickField(raw, ['Notes']) || '',
    extra,
  };
}

function mapCashRows(records) {
  const business = [];
  const personal = [];
  let inPersonal = false;
  let skipHeader = false;

  for (const raw of records) {
    const dateCell = pickField(raw, ['Date']) || '';
    const balCell = pickField(raw, ['Business cash balance', 'Business Cash Balance']) || '';
    const note = pickField(raw, ['Note', 'Notes']) || '';

    if (/personal\s*\(excluded/i.test(dateCell) || /^personal$/i.test(dateCell.trim())) {
      inPersonal = true;
      skipHeader = true;
      continue;
    }
    if (inPersonal && skipHeader && /^(item|amount)/i.test(dateCell)) {
      skipHeader = false;
      continue;
    }

    if (!inPersonal) {
      const date = parseDateOnly(dateCell);
      if (!date) continue;
      business.push({
        date,
        balance: parseMoney(balCell),
        note,
        kind: 'business',
      });
    } else {
      if (!dateCell.trim()) continue;
      personal.push({
        item: dateCell,
        amountText: balCell,
        amount: parseMoney(balCell),
        note,
        kind: 'personal',
      });
    }
  }

  business.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latest = business.length ? business[business.length - 1] : null;
  return { business, personal, latest };
}

function mapSettings(records) {
  const out = {
    monthlyBusinessBurn: null,
    monthlyLivingBurn: null,
    defaultDownPaymentPct: 40,
    daysLateBeforeWorkPauses: 14,
    rows: [],
  };
  for (const raw of records) {
    const key = pickField(raw, ['Setting', 'Key']) || '';
    const value = pickField(raw, ['Value']) || '';
    const notes = pickField(raw, ['Notes']) || '';
    if (!key) continue;
    out.rows.push({ key, value, notes });
    const nk = key.toLowerCase();
    if (nk.includes('monthly business burn')) {
      out.monthlyBusinessBurn = value.trim() ? parseMoney(value) : null;
    } else if (nk.includes('monthly living burn')) {
      out.monthlyLivingBurn = value.trim() ? parseMoney(value) : null;
    } else if (nk.includes('default down payment')) {
      out.defaultDownPaymentPct = parsePercent(value) || 40;
    } else if (nk.includes('days late')) {
      const n = Number(String(value).replace(/[^\d.]/g, ''));
      out.daysLateBeforeWorkPauses = Number.isFinite(n) && n > 0 ? n : 14;
    }
  }
  return out;
}

function mapGenericTable(records, headers) {
  return {
    headers: headers.filter(Boolean),
    rows: records.map((raw) => {
      const row = {};
      for (const h of headers) {
        if (!h) continue;
        row[h] = raw[h] != null ? String(raw[h]) : '';
      }
      return row;
    }),
  };
}

async function loadFresh() {
  const sheetId = financeSheetId();
  if (!sheetId) {
    return {
      source: 'none',
      sheetWarning: 'FINANCE_SHEET_ID is not configured.',
      billing: [],
      payments: [],
      expenses: [],
      assets: [],
      cash: { business: [], personal: [], latest: null },
      settings: mapSettings([]),
      journal: { headers: [], rows: [] },
      notes: { headers: [], rows: [] },
      toyotaMemo: { headers: [], rows: [] },
    };
  }

  const { items: pmProjects } = await listProjectsSafe().catch(() => ({ items: [] }));

  const FINANCE_TABS = [
    'Billing',
    'Payments',
    'Expenses',
    'Assets',
    'Cash',
    'Settings',
    'Journal',
    'Notes',
    'Toyota memo (off books)',
  ];
  const tables = await readSheetTables(sheetId, FINANCE_TABS);
  const empty = { headers: [], records: [] };
  const billingRaw = tables.Billing || empty;
  const paymentsRaw = tables.Payments || empty;
  const expensesRaw = tables.Expenses || empty;
  const assetsRaw = tables.Assets || empty;
  const cashRaw = tables.Cash || empty;
  const settingsRaw = tables.Settings || empty;
  const journalRaw = tables.Journal || empty;
  const notesRaw = tables.Notes || empty;
  const toyotaRaw = tables['Toyota memo (off books)'] || empty;
  const billing = billingRaw.records
    .map((r) => mapBilling(r, pmProjects))
    .filter(Boolean);
  const billingById = new Map(billing.map((b) => [b.projectId, b]));

  const payments = paymentsRaw.records
    .map((r) => mapPayment(r, billingById))
    .filter(Boolean);

  // Enrich billing with received-to-date from payments
  for (const b of billing) {
    const related = payments.filter((p) => p.projectId === b.projectId);
    b.receivedToDate = related.reduce((s, p) => s + (p.amountReceived || 0), 0);
    b.balance = Math.max(0, (b.contractValue || 0) - b.receivedToDate);
  }

  return {
    source: 'sheet',
    sheetWarning: null,
    billing,
    payments,
    expenses: expensesRaw.records.map(mapExpense).filter(Boolean),
    assets: assetsRaw.records.map(mapAsset).filter(Boolean),
    cash: mapCashRows(cashRaw.records),
    settings: mapSettings(settingsRaw.records),
    journal: mapGenericTable(journalRaw.records, journalRaw.headers),
    notes: mapGenericTable(notesRaw.records, notesRaw.headers),
    toyotaMemo: mapGenericTable(toyotaRaw.records, toyotaRaw.headers),
  };
}

export async function loadFinanceBundle() {
  if (!useLiveSheet()) {
    return {
      source: 'sample',
      sheetWarning: 'Finance sheet not configured (set FINANCE_SHEET_ID).',
      billing: [],
      payments: [],
      expenses: [],
      assets: [],
      cash: { business: [], personal: [], latest: null },
      settings: mapSettings([]),
      journal: { headers: [], rows: [] },
      notes: { headers: [], rows: [] },
      toyotaMemo: { headers: [], rows: [] },
    };
  }

  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_TTL_MS) return cache.payload;

  try {
    const payload = await loadFresh();
    cache = { at: now, payload };
    return payload;
  } catch (err) {
    return {
      source: 'error',
      sheetWarning: err.message,
      billing: [],
      payments: [],
      expenses: [],
      assets: [],
      cash: { business: [], personal: [], latest: null },
      settings: mapSettings([]),
      journal: { headers: [], rows: [] },
      notes: { headers: [], rows: [] },
      toyotaMemo: { headers: [], rows: [] },
    };
  }
}

export function invalidateFinanceCache() {
  cache = { at: 0, payload: null };
}
