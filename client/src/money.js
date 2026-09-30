/** Format PHP amounts as ₱1,234,567 (no decimals). */
export function formatPhp(amount) {
  if (amount == null || amount === '') return '—';
  const n = Math.round(Number(amount));
  if (!Number.isFinite(n)) return '—';
  return `₱${n.toLocaleString('en-PH')}`;
}

export function formatPhpOrZero(amount) {
  const n = Math.round(Number(amount) || 0);
  return `₱${n.toLocaleString('en-PH')}`;
}
