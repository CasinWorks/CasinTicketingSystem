import { pickField, readSheetTable } from './googleClient.js';
import { getOp, resolveSheetId } from './opsConfig.js';

function useLiveSheet() {
  if (process.env.MOCK_SHEETS === 'true') return false;
  const op = getOp('project-manager');
  return Boolean(op && resolveSheetId(op));
}

function parseDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(0, 10)}T12:00:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * CasinWorks Projects tab columns:
 * Name | Blockers | Deadline | Depends on | Focus now | Last update |
 * Next actions | Notes | Priority | Stage | Status | Notion link
 */
function mapSheetRecord(raw, index) {
  const status = pickField(raw, ['Status']) || 'Active';
  const lastUpdate = pickField(raw, ['Last update', 'Last Update']);
  const deadline = pickField(raw, ['Deadline', 'Due', 'Due Date']);
  const done = /done|complete|shipped|closed/i.test(status);

  return {
    ID: `PRJ-${String(index + 1).padStart(4, '0')}`,
    Title: pickField(raw, ['Name', 'Title', 'Project']) || 'Untitled',
    Description: pickField(raw, ['Notes', 'Focus now', 'Next actions']) || '',
    Blockers: pickField(raw, ['Blockers']) || '',
    DependsOn: pickField(raw, ['Depends on', 'Depends On']) || '',
    FocusNow: pickField(raw, ['Focus now', 'Focus Now']) || '',
    NextActions: pickField(raw, ['Next actions', 'Next Actions']) || '',
    Notes: pickField(raw, ['Notes']) || '',
    Type: pickField(raw, ['Stage', 'Type', 'Category']) || 'Idea',
    Stage: pickField(raw, ['Stage']) || 'Idea',
    Priority: pickField(raw, ['Priority']) || 'P2',
    Status: status,
    Client: pickField(raw, ['Depends on', 'Client']) || '',
    Owner: '',
    DueDate: deadline ? String(deadline).slice(0, 10) : '',
    Progress: done ? 100 : /live/i.test(pickField(raw, ['Stage']) || '') ? 80 : /mvp|beta/i.test(pickField(raw, ['Stage']) || '') ? 50 : 20,
    NotionLink: pickField(raw, ['Notion link', 'Notion Link']) || '',
    CreatedAt: parseDate(lastUpdate) || new Date().toISOString(),
    UpdatedAt: parseDate(lastUpdate) || new Date().toISOString(),
    CompletedAt: done ? parseDate(lastUpdate) : '',
    _source: 'sheet',
    _rowNumber: raw._rowNumber,
  };
}

export async function listProjectsSafe() {
  if (!useLiveSheet()) {
    return { items: [], sheetWarning: 'No project sheet configured.', source: 'sample' };
  }

  const op = getOp('project-manager');
  const sheetId = resolveSheetId(op);
  const tab = process.env.SHEET_TAB_PROJECT_MANAGER || 'Projects';

  try {
    const { records } = await readSheetTable(sheetId, tab);
    const items = records
      .filter((r) => pickField(r, ['Name', 'Title']))
      .map((r, i) => mapSheetRecord(r, i));
    return { items, sheetWarning: null, source: 'sheet' };
  } catch (err) {
    return { items: [], sheetWarning: err.message, source: 'error' };
  }
}

export async function listProjects() {
  const { items } = await listProjectsSafe();
  return items;
}

export async function createProject() {
  const err = new Error(
    'Add new projects in the Google Sheet (or Notion). API create will be enabled after write-mapping is confirmed.'
  );
  err.status = 501;
  throw err;
}

export async function updateProject(id, patch) {
  // Allow in-memory-style updates only if we later map columns; for now reject writes to protect Notion-synced sheet
  const err = new Error(
    `Update ${id} in the Google Sheet / Notion source of truth. Writable API mapping coming next.`
  );
  err.status = 501;
  throw err;
}
