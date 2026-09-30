function startOfDayISO(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function isResolvedLike(status) {
  return status === 'Resolved' || status === 'Closed';
}

const SPRINT_DAYS = 10;

export function computeStats(tickets) {
  const byCategoryMap = {};
  const byStatusMap = {};

  for (const t of tickets) {
    byCategoryMap[t.Category] = (byCategoryMap[t.Category] || 0) + 1;
    byStatusMap[t.Status] = (byStatusMap[t.Status] || 0) + 1;
  }

  const byCategory = Object.entries(byCategoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const byStatus = Object.entries(byStatusMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const total = tickets.length;
  const open =
    (byStatusMap['Open'] || 0) + (byStatusMap['In Progress'] || 0);
  const resolved =
    (byStatusMap['Resolved'] || 0) + (byStatusMap['Closed'] || 0);
  const completionPct = total === 0 ? 0 : Math.round((resolved / total) * 100);

  // Burn-up for a 10 working-day sprint window (including today)
  const burnup = [];
  const windowStart = daysAgo(SPRINT_DAYS - 1);
  const scopeJumps = [];

  for (let i = 0; i < SPRINT_DAYS; i++) {
    const day = daysAgo(SPRINT_DAYS - 1 - i);
    const dayStr = startOfDayISO(day);
    const endOfDay = new Date(day);
    endOfDay.setUTCHours(23, 59, 59, 999);

    let scope = 0;
    let completed = 0;

    for (const t of tickets) {
      const created = t.CreatedAt ? new Date(t.CreatedAt) : null;
      if (created && created <= endOfDay) {
        scope += 1;
      }

      const resolvedAt = t.ResolvedAt ? new Date(t.ResolvedAt) : null;
      if (resolvedAt && resolvedAt <= endOfDay && isResolvedLike(t.Status)) {
        completed += 1;
      } else if (
        !t.ResolvedAt &&
        isResolvedLike(t.Status) &&
        created &&
        created <= endOfDay
      ) {
        completed += 1;
      }
    }

    const label = `D${i + 1}`;
    if (i > 0) {
      const delta = scope - burnup[i - 1].scope;
      if (delta >= 2) {
        scopeJumps.push({ day: i + 1, delta });
      }
    }

    burnup.push({
      date: dayStr,
      day: label,
      completed,
      scope,
    });
  }

  const finalScope = burnup[burnup.length - 1]?.scope || 0;
  const burnupWithIdeal = burnup.map((point, i) => ({
    ...point,
    ideal: Math.round((finalScope * i) / (SPRINT_DAYS - 1) * 10) / 10,
  }));

  // Mention the two largest mid-sprint scope jumps (matches the reference caption style)
  const topJumps = [...scopeJumps].sort((a, b) => b.delta - a.delta).slice(0, 2).sort((a, b) => a.day - b.day);
  let scopeNote = '';
  if (topJumps.length === 1) {
    scopeNote = `Scope rose on day ${topJumps[0].day} when new tickets were added mid-sprint.`;
  } else if (topJumps.length > 1) {
    scopeNote = `Scope rose on days ${topJumps.map((j) => j.day).join(' and ')} when new tickets were added mid-sprint.`;
  }

  return {
    byCategory,
    byStatus,
    burnup: burnupWithIdeal,
    totals: {
      total,
      open,
      resolved,
      closed: byStatusMap['Closed'] || 0,
      inProgress: byStatusMap['In Progress'] || 0,
      completionPct,
    },
    sprintDays: SPRINT_DAYS,
    scopeNote,
    windowStart: startOfDayISO(windowStart),
  };
}
