import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let sheetsClient = null;

export function loadServiceAccountCreds() {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (filePath) {
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
    const raw = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    return { email: raw.client_email, privateKey: raw.private_key };
  }

  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

export function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const { email, privateKey } = loadServiceAccountCreds();
  if (!email || !privateKey) {
    throw new Error('Missing Google service account credentials');
  }
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export function getServiceAccountEmail() {
  try {
    return loadServiceAccountCreds().email || null;
  } catch {
    return null;
  }
}

export function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Read a sheet tab into objects keyed by detected headers.
 * Throws a friendly error if the file is still an uploaded Excel/Office doc.
 */
export async function readSheetTable(spreadsheetId, tabName) {
  const sheets = getSheetsClient();

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('Office file') || err?.status === 400) {
      const friendly = new Error(
        'This file is still an Excel/Office upload. Open it in Google Drive → File → Save as Google Sheets, then share the new sheet with the service account as Editor.'
      );
      friendly.status = 400;
      friendly.code = 'OFFICE_FILE';
      throw friendly;
    }
    throw err;
  }

  const tabs = meta.data.sheets.map((s) => s.properties.title);
  const resolvedTab = resolveTabName(tabs, tabName);
  if (!resolvedTab) {
    const err = new Error(
      `Tab "${tabName}" not found. Available tabs: ${tabs.join(', ') || '(none)'}`
    );
    err.status = 404;
    err.tabs = tabs;
    throw err;
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${resolvedTab}'!A1:Z200`,
  });

  return rowsToTable(resolvedTab, res.data.values || [], tabs);
}

function resolveTabName(tabs, tabName) {
  if (tabs.includes(tabName)) return tabName;
  return tabs.find((t) => t.toLowerCase() === String(tabName).toLowerCase()) || null;
}

function rowsToTable(tab, rows, tabs = []) {
  if (!rows.length) return { tab, headers: [], records: [], tabs };

  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const filled = (rows[i] || []).filter((c) => String(c || '').trim()).length;
    if (filled >= 3) {
      headerIdx = i;
      break;
    }
  }

  const headers = (rows[headerIdx] || []).map((h) => String(h || '').trim());
  const records = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some((c) => String(c || '').trim())) continue;
    const obj = { _rowNumber: r + 1, _tab: tab };
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = row[i] != null ? String(row[i]).trim() : '';
    });
    records.push(obj);
  }

  return { tab, headers, records, tabs };
}

/**
 * Fetch many tabs in one API round-trip (1 meta + 1 batchGet).
 * Returns a map of requestedTabName → table (empty table if tab missing).
 */
export async function readSheetTables(spreadsheetId, tabNames) {
  const sheets = getSheetsClient();
  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('Office file') || err?.status === 400) {
      const friendly = new Error(
        'This file is still an Excel/Office upload. Open it in Google Drive → File → Save as Google Sheets, then share the new sheet with the service account as Editor.'
      );
      friendly.status = 400;
      friendly.code = 'OFFICE_FILE';
      throw friendly;
    }
    throw err;
  }

  const tabs = meta.data.sheets.map((s) => s.properties.title);
  const resolved = tabNames.map((name) => ({
    requested: name,
    resolved: resolveTabName(tabs, name),
  }));

  const ranges = resolved
    .filter((r) => r.resolved)
    .map((r) => `'${r.resolved}'!A1:Z200`);

  const valueRanges = [];
  if (ranges.length) {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });
    valueRanges.push(...(res.data.valueRanges || []));
  }

  let valueIdx = 0;
  const out = {};
  for (const item of resolved) {
    if (!item.resolved) {
      out[item.requested] = { tab: item.requested, headers: [], records: [], tabs };
      continue;
    }
    const vr = valueRanges[valueIdx++] || {};
    out[item.requested] = rowsToTable(item.resolved, vr.values || [], tabs);
  }
  return out;
}

export function pickField(record, candidates) {
  const entries = Object.entries(record).filter(([k]) => !k.startsWith('_'));
  for (const cand of candidates) {
    const want = normalizeHeader(cand);
    for (const [key, value] of entries) {
      if (normalizeHeader(key) === want) return value;
    }
  }
  // fuzzy contains
  for (const cand of candidates) {
    const want = normalizeHeader(cand);
    for (const [key, value] of entries) {
      const n = normalizeHeader(key);
      if (n.includes(want) || want.includes(n)) return value;
    }
  }
  return '';
}

export async function listSpreadsheetTabs(spreadsheetId) {
  const sheets = getSheetsClient();
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    return meta.data.sheets.map((s) => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
    }));
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('Office file') || err?.status === 400) {
      const friendly = new Error(
        'This file is still an Excel/Office upload. Open it → File → Save as Google Sheets, share with the service account, then retry.'
      );
      friendly.status = 400;
      friendly.code = 'OFFICE_FILE';
      throw friendly;
    }
    throw err;
  }
}
