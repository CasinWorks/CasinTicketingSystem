import { daysBetween } from './money.js';

function filterOffBooks(rows, includeOffBooks) {
  if (includeOffBooks) return rows;
  return rows.filter((r) => !r.offBooks);
}

function isFullyPaid(p) {
  if (/^paid$/i.test(p.status)) return true;
  if (!p.amountDue) return false;
  return (p.amountReceived || 0) >= p.amountDue;
}

function isOverduePayment(p, today = new Date().toISOString().slice(0, 10)) {
  if (/^overdue$/i.test(p.status)) return true;
  if (isFullyPaid(p)) return false;
  if (!p.dueDate) return false;
  return p.dueDate < today;
}

/**
 * @param {object} bundle from loadFinanceBundle
 * @param {{ includeOffBooks?: boolean }} opts
 */
export function financeDashboard(bundle, opts = {}) {
  const includeOffBooks = opts.includeOffBooks !== false;
  const billing = filterOffBooks(bundle.billing || [], includeOffBooks);
  const payments = filterOffBooks(bundle.payments || [], includeOffBooks);
  const settings = bundle.settings || {};
  const cashLatest = bundle.cash?.latest || null;
  const businessCash = cashLatest?.balance ?? 0;
  const cashDate = cashLatest?.date || null;

  const burn = settings.monthlyBusinessBurn;
  let runwayWeeks = null;
  let runwayNote = null;
  if (burn == null || burn <= 0) {
    runwayNote = 'Set monthly burn';
  } else {
    runwayWeeks = Math.round((businessCash / (burn / 4.33)) * 10) / 10;
  }

  const guaranteedPayments = payments.filter((p) => /^guaranteed$/i.test(p.projectStatus || ''));
  const guaranteedStillOwed = guaranteedPayments.reduce((s, p) => s + Math.max(0, (p.amountDue || 0) - (p.amountReceived || 0)), 0);

  // Always compute on-books-only figure (Off books = N), regardless of toggle
  const onBooksGuaranteed = (bundle.payments || [])
    .filter((p) => !p.offBooks && /^guaranteed$/i.test(p.projectStatus || ''))
    .reduce((s, p) => s + Math.max(0, (p.amountDue || 0) - (p.amountReceived || 0)), 0);

  const overdueList = payments.filter((p) => isOverduePayment(p));
  const overdueCount = overdueList.length;
  const overdueAmount = overdueList.reduce((s, p) => s + Math.max(0, (p.amountDue || 0) - (p.amountReceived || 0)), 0);

  const hopefulPipeline = billing
    .filter((b) => /^hopeful$/i.test(b.status))
    .reduce((s, b) => s + (b.contractValue || 0), 0);
  const atRiskEarlyPipeline = billing
    .filter((b) => /^(at risk|early stage)$/i.test(b.status))
    .reduce((s, b) => s + (b.contractValue || 0), 0);

  const totalAssets = (bundle.assets || []).reduce((s, a) => s + (a.cost || 0), 0);

  const pauseDays = settings.daysLateBeforeWorkPauses || 14;
  const today = new Date().toISOString().slice(0, 10);
  const alerts = [];

  for (const p of payments) {
    if (p.dueDate && !isFullyPaid(p)) {
      const late = daysBetween(p.dueDate, today);
      if (late != null && late > pauseDays) {
        alerts.push({
          type: 'pause-work',
          severity: 'critical',
          title: 'Pause work',
          detail: `${p.client || p.projectId} · ${p.milestone} is ${late} days past due (limit ${pauseDays}).`,
          amount: Math.max(0, (p.amountDue || 0) - (p.amountReceived || 0)),
          paymentId: p.paymentId,
          projectId: p.projectId,
        });
      }
    }
    if (/^partial$/i.test(p.status) || ((p.amountReceived || 0) > 0 && (p.amountReceived || 0) < (p.amountDue || 0))) {
      const shortfall = Math.max(0, (p.amountDue || 0) - (p.amountReceived || 0));
      if (shortfall > 0) {
        alerts.push({
          type: 'partial',
          severity: 'warn',
          title: `${p.client || p.projectId} · ${p.milestone}`,
          detail: `${formatShort(p.amountDue)} due, ${formatShort(p.amountReceived)} received, ${formatShort(shortfall)} short`,
          amount: shortfall,
          paymentId: p.paymentId,
          projectId: p.projectId,
        });
      }
    }
  }

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const until = in30.toISOString().slice(0, 10);
  const upcoming = payments
    .filter((p) => {
      if (isFullyPaid(p) || !p.dueDate) return false;
      return p.dueDate >= today && p.dueDate <= until;
    })
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    .slice(0, 20)
    .map((p) => ({
      paymentId: p.paymentId,
      projectId: p.projectId,
      client: p.client,
      milestone: p.milestone,
      dueDate: p.dueDate,
      amountDue: p.amountDue,
      amountReceived: p.amountReceived,
      balance: p.balance,
      status: p.status,
      offBooks: p.offBooks,
    }));

  const statusOrder = ['Guaranteed', 'Hopeful', 'At risk', 'Early stage', 'Lost'];
  const pipelineByStatusMap = {};
  for (const b of billing) {
    const st = b.status || 'Other';
    if (!pipelineByStatusMap[st]) pipelineByStatusMap[st] = { name: st, count: 0, value: 0 };
    pipelineByStatusMap[st].count += 1;
    pipelineByStatusMap[st].value += b.contractValue || 0;
  }
  const pipelineByStatus = [
    ...statusOrder.filter((s) => pipelineByStatusMap[s]).map((s) => pipelineByStatusMap[s]),
    ...Object.values(pipelineByStatusMap).filter((x) => !statusOrder.includes(x.name)),
  ];

  const byReferrerMap = {};
  let pipelineTotal = 0;
  for (const b of billing) {
    if (/^lost$/i.test(b.status)) continue;
    const ref = (b.referredBy || '').trim() || '(blank / internal)';
    if (!byReferrerMap[ref]) byReferrerMap[ref] = { name: ref, value: 0 };
    byReferrerMap[ref].value += b.contractValue || 0;
    pipelineTotal += b.contractValue || 0;
  }
  const concentration = Object.values(byReferrerMap)
    .map((r) => ({
      ...r,
      sharePct: pipelineTotal ? Math.round((r.value / pipelineTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const concentrationWarning = concentration.find((c) => c.sharePct > 50) || null;

  // Cross-check helpers (always from full bundle)
  const toyotaReceived = (bundle.payments || [])
    .filter((p) => p.paymentId === 'PAY-TMP-DP' || (p.projectId === 'CW-TMP' && /down payment/i.test(p.milestone)))
    .reduce((s, p) => s + (p.amountReceived || 0), 0);

  return {
    kind: 'finance',
    includeOffBooks,
    sheetWarning: bundle.sheetWarning,
    source: bundle.source,
    kpis: {
      businessCash,
      cashDate,
      runwayWeeks,
      runwayNote,
      monthlyBusinessBurn: burn,
      guaranteedStillOwed,
      guaranteedStillOwedOnBooks: onBooksGuaranteed,
      overdueCount,
      overdueAmount,
      hopefulPipeline,
      atRiskEarlyPipeline,
      totalAssets,
      toyotaReceived,
    },
    alerts,
    upcoming,
    pipelineByStatus,
    concentration,
    concentrationWarning,
    pipelineTotal,
  };
}

function formatShort(n) {
  const v = Math.round(Number(n) || 0);
  return `₱${v.toLocaleString('en-PH')}`;
}

export function expenseSummaries(expenses) {
  const business = expenses.filter((e) => !e.isPersonal);
  const byCategory = {};
  const byMonth = {};
  for (const e of business) {
    const cat = e.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
    const month = e.date ? e.date.slice(0, 7) : 'Unknown';
    byMonth[month] = (byMonth[month] || 0) + (e.amount || 0);
  }
  return {
    businessTotal: business.reduce((s, e) => s + (e.amount || 0), 0),
    personalTotal: expenses.filter((e) => e.isPersonal).reduce((s, e) => s + (e.amount || 0), 0),
    byCategory: Object.entries(byCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    byMonth: Object.entries(byMonth)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
  };
}
