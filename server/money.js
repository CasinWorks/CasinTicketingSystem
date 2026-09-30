/** PHP money helpers — parse sheet cells, format as ₱1,234,567 (no decimals). */

export function parseMoney(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
  const s = String(value).trim();
  if (!s || /^[—–-]$/.test(s)) return 0;
  // Ranges like 270000–330000 or ~20000 → take first number
  const cleaned = s.replace(/₱/g, '').replace(/,/g, '').replace(/~/g, '');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function parsePercent(value) {
  if (value == null || value === '') return 0;
  const s = String(value).trim().replace(/%/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function formatPhp(amount) {
  const n = Math.round(Number(amount) || 0);
  return `₱${n.toLocaleString('en-PH')}`;
}

export function isYes(value) {
  const s = String(value || '')
    .trim()
    .toLowerCase();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1';
}

export function parseDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Ignore section headers / labels
  if (!/\d{4}/.test(s) && !/^\d{1,2}[\/\-]\d{1,2}/.test(s)) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso = new Date().toISOString().slice(0, 10)) {
  if (!fromIso) return null;
  const a = new Date(`${fromIso}T12:00:00`);
  const b = new Date(`${toIso}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.floor((b - a) / 86400000);
}
