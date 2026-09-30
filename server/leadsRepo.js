import { pickField, readSheetTable } from './googleClient.js';
import { getOp, resolveSheetId } from './opsConfig.js';

function useLiveSheet() {
  if (process.env.MOCK_SHEETS === 'true') return false;
  const op = getOp('leads');
  return Boolean(op && resolveSheetId(op));
}

function parseDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(0, 10)}T12:00:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Pull first ₱ amount from notes/actions text (e.g. ₱300k → 300000) */
export function extractPesoValue(...texts) {
  const blob = texts.filter(Boolean).join(' ');
  const match = blob.match(/₱\s*([\d,.]+)\s*(k|m)?/i);
  if (!match) return 0;
  let n = Number(match[1].replace(/,/g, ''));
  if (Number.isNaN(n)) return 0;
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'k') n *= 1000;
  if (suffix === 'm') n *= 1_000_000;
  return Math.round(n);
}

/**
 * CasinWorks Leads tab columns:
 * Name | Follow up | Last update | Next action | Notes | Priority | Source | Status | Type | Notion link
 */
function mapSheetRecord(raw, index) {
  const status = pickField(raw, ['Status']) || 'New';
  const notes = pickField(raw, ['Notes']) || '';
  const nextAction = pickField(raw, ['Next action', 'Next Action']) || '';
  const lastUpdate = pickField(raw, ['Last update', 'Last Update']);
  const followUp = pickField(raw, ['Follow up', 'Follow Up']);
  const closed = /won|lost|closed|dead/i.test(status);

  const value = extractPesoValue(notes, nextAction, pickField(raw, ['Name']));

  return {
    ID: `LED-${String(index + 1).padStart(4, '0')}`,
    Company: pickField(raw, ['Name', 'Company', 'Account']) || 'Unknown',
    Contact: '',
    Title: nextAction || notes.slice(0, 80),
    Source: pickField(raw, ['Source']) || 'Unknown',
    Status: status,
    Type: pickField(raw, ['Type']) || 'Lead',
    Priority: pickField(raw, ['Priority']) || 'P2',
    Owner: '',
    Value: value,
    Notes: notes,
    NextAction: nextAction,
    FollowUp: followUp ? String(followUp).slice(0, 10) : '',
    NotionLink: pickField(raw, ['Notion link', 'Notion Link']) || '',
    CreatedAt: parseDate(lastUpdate) || new Date().toISOString(),
    UpdatedAt: parseDate(lastUpdate) || new Date().toISOString(),
    ClosedAt: closed ? parseDate(lastUpdate) : '',
    _source: 'sheet',
    _rowNumber: raw._rowNumber,
  };
}

export async function listLeadsSafe() {
  if (!useLiveSheet()) {
    return { items: [], sheetWarning: 'No leads sheet configured.', source: 'sample' };
  }

  const op = getOp('leads');
  const sheetId = resolveSheetId(op);
  const tab = process.env.SHEET_TAB_LEADS || 'Leads';

  try {
    const { records } = await readSheetTable(sheetId, tab);
    const items = records
      .filter((r) => pickField(r, ['Name', 'Company']))
      .map((r, i) => mapSheetRecord(r, i));
    return { items, sheetWarning: null, source: 'sheet' };
  } catch (err) {
    return { items: [], sheetWarning: err.message, source: 'error' };
  }
}

export async function listLeads() {
  const { items } = await listLeadsSafe();
  return items;
}

export async function createLead() {
  const err = new Error(
    'Add new leads in the Google Sheet (or Notion). API create will be enabled after write-mapping is confirmed.'
  );
  err.status = 501;
  throw err;
}

export async function updateLead(id) {
  const err = new Error(
    `Update ${id} in the Google Sheet / Notion source of truth. Writable API mapping coming next.`
  );
  err.status = 501;
  throw err;
}
