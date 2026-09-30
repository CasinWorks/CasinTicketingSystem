import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadServiceAccountCreds } from './googleClient.js';
import { getOp, resolveSheetId } from './opsConfig.js';

dotenv.config();

/**
 * CasinWorks — IT Service Desk Tickets (source of truth)
 * Tab: Tickets
 * Columns:
 * Ticket ID | Opened | Client | Project | Title | Category | Priority |
 * Status | Requester | Assignee (IT) | Coordinator | Summary
 */
const SHEET_NAME = process.env.SHEET_TAB || 'Tickets';

const SHEET_HEADERS = [
  'Ticket ID',
  'Opened',
  'Client',
  'Project',
  'Title',
  'Category',
  'Priority',
  'Status',
  'Requester',
  'Assignee (IT)',
  'Coordinator',
  'Summary',
];

const CACHE_TTL_MS = Number(process.env.SHEETS_CACHE_TTL_MS || 5000);
const USE_MOCK = process.env.MOCK_SHEETS === 'true';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_FILE = path.join(__dirname, '.mock-tickets.json');

let cache = { tickets: null, fetchedAt: 0 };
let sheetsClient = null;
let headerRowIndex = 1; // 1-based sheet row where headers live

function readMockStore() {
  try {
    if (!fs.existsSync(MOCK_FILE)) return [];
    return JSON.parse(fs.readFileSync(MOCK_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeMockStore(tickets) {
  fs.writeFileSync(MOCK_FILE, JSON.stringify(tickets, null, 2));
}

function loadServiceAccount() {
  const creds = loadServiceAccountCreds();
  const op = getOp('service-desk');
  return {
    email: creds.email,
    privateKey: creds.privateKey,
    sheetId: op ? resolveSheetId(op) : '',
  };
}

function getAuth() {
  const { email, privateKey, sheetId } = loadServiceAccount();

  if (!email || !privateKey || !sheetId) {
    throw new Error(
      'Missing Google Sheets credentials. Set SHEET_ID and either GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY in server/.env'
    );
  }

  return { email, privateKey, sheetId };
}

function getSheets() {
  if (sheetsClient) return sheetsClient;

  const { email, privateKey } = getAuth();
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

function getSheetId() {
  return getAuth().sheetId;
}

function invalidateCache() {
  cache = { tickets: null, fetchedAt: 0 };
}

function todayOpened() {
  return new Date().toISOString().slice(0, 10);
}

function openedToIso(opened) {
  if (!opened) return '';
  const s = String(opened).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return `${s.slice(0, 10)}T12:00:00.000Z`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function sheetRowToTicket(row, rowNumber) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : '');

  const id = get(0);
  const opened = get(1);
  const status = get(7);
  const createdAt = openedToIso(opened);
  const resolvedLike = status === 'Resolved' || status === 'Closed';

  return {
    ID: id,
    Title: get(4),
    Description: get(11),
    Category: get(5),
    Priority: get(6),
    Status: status,
    Requester: get(8),
    Assignee: get(9),
    CreatedAt: createdAt,
    UpdatedAt: createdAt,
    ResolvedAt: resolvedLike ? createdAt : '',
    Client: get(2),
    Project: get(3),
    Coordinator: get(10),
    Opened: opened,
    _rowNumber: rowNumber,
  };
}

function ticketToSheetRow(ticket) {
  return [
    ticket.ID ?? '',
    ticket.Opened || (ticket.CreatedAt ? String(ticket.CreatedAt).slice(0, 10) : todayOpened()),
    ticket.Client ?? '',
    ticket.Project ?? '',
    ticket.Title ?? '',
    ticket.Category ?? '',
    ticket.Priority ?? '',
    ticket.Status ?? 'Open',
    ticket.Requester ?? '',
    ticket.Assignee ?? '',
    ticket.Coordinator ?? '',
    ticket.Description ?? '',
  ];
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

async function locateHeaderRow() {
  const sheets = getSheets();
  const sheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1:L30`,
  });

  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    const cell = normalizeHeader(rows[i][0]);
    if (cell === 'ticket id' || cell === 'id') {
      headerRowIndex = i + 1;
      return headerRowIndex;
    }
  }

  // No header found — write CasinWorks headers at row 1
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1:L1`,
    valueInputOption: 'RAW',
    requestBody: { values: [SHEET_HEADERS] },
  });
  headerRowIndex = 1;
  return headerRowIndex;
}

async function fetchAllTickets() {
  const now = Date.now();
  if (cache.tickets && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.tickets;
  }

  if (USE_MOCK) {
    const tickets = readMockStore().map((t) => ({ ...t }));
    cache = { tickets, fetchedAt: Date.now() };
    return tickets;
  }

  await locateHeaderRow();

  const sheets = getSheets();
  const sheetId = getSheetId();
  const dataStart = headerRowIndex + 1;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A${dataStart}:L`,
  });

  const rows = res.data.values || [];
  const tickets = rows
    .map((row, i) => ({ row, rowNumber: dataStart + i }))
    .filter(({ row }) => row[0] && /^TCK-/i.test(String(row[0]).trim()))
    .map(({ row, rowNumber }) => sheetRowToTicket(row, rowNumber));

  cache = { tickets, fetchedAt: Date.now() };
  return tickets;
}

function nextTicketId(tickets) {
  let max = 0;
  for (const t of tickets) {
    const match = String(t.ID).match(/^TCK-(\d+)$/i);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return `TCK-${String(max + 1).padStart(4, '0')}`;
}

export async function listTickets() {
  return fetchAllTickets();
}

export async function createTicket(data) {
  const tickets = await fetchAllTickets();
  const opened = todayOpened();
  const createdAt = openedToIso(opened);
  const id = nextTicketId(tickets);

  const ticket = {
    ID: id,
    Title: data.Title ?? '',
    Description: data.Description ?? '',
    Category: data.Category ?? '',
    Priority: data.Priority ?? '',
    Status: data.Status ?? 'Open',
    Requester: data.Requester ?? '',
    Assignee: data.Assignee ?? '',
    CreatedAt: createdAt,
    UpdatedAt: createdAt,
    ResolvedAt: data.Status === 'Resolved' || data.Status === 'Closed' ? createdAt : '',
    Client: data.Client ?? '',
    Project: data.Project ?? '',
    Coordinator: data.Coordinator ?? '',
    Opened: opened,
  };

  if (USE_MOCK) {
    const store = readMockStore();
    store.push({ ...ticket });
    writeMockStore(store);
    invalidateCache();
    return ticket;
  }

  const sheets = getSheets();
  const sheetId = getSheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A:L`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [ticketToSheetRow(ticket)] },
  });

  invalidateCache();
  return ticket;
}

export async function updateTicket(id, patch) {
  const tickets = await fetchAllTickets();
  const index = tickets.findIndex((t) => t.ID === id);

  if (index === -1) {
    const err = new Error(`Ticket ${id} not found`);
    err.status = 404;
    throw err;
  }

  const existing = tickets[index];
  const updated = {
    ...existing,
    ...patch,
    ID: existing.ID,
    UpdatedAt: new Date().toISOString(),
  };

  if (patch.Status === 'Resolved' && existing.Status !== 'Resolved') {
    updated.ResolvedAt = updated.UpdatedAt;
  } else if (patch.Status && patch.Status !== 'Resolved' && patch.Status !== 'Closed') {
    if (existing.Status === 'Resolved' || existing.Status === 'Closed') {
      updated.ResolvedAt = '';
    }
  }

  if (USE_MOCK) {
    const store = readMockStore();
    store[index] = { ...updated };
    writeMockStore(store);
    invalidateCache();
    return updated;
  }

  const sheets = getSheets();
  const sheetId = getSheetId();
  const rowNumber = existing._rowNumber;

  if (!rowNumber) {
    const err = new Error(`Could not locate sheet row for ${id}`);
    err.status = 500;
    throw err;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A${rowNumber}:L${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [ticketToSheetRow(updated)] },
  });

  invalidateCache();
  return updated;
}

export async function replaceAllTickets(tickets) {
  if (USE_MOCK) {
    writeMockStore(tickets.map((t) => ({ ...t })));
    invalidateCache();
    return tickets;
  }

  throw new Error(
    'Refusing to wipe the live Google Sheet. Seed only works with MOCK_SHEETS=true, or edit the sheet directly / via the API.'
  );
}

export function getServiceAccountEmail() {
  try {
    return loadServiceAccount().email || null;
  } catch {
    return null;
  }
}

export { SHEET_HEADERS, SHEET_NAME };
