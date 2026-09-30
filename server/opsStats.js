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

function countBy(items, field) {
  const map = {};
  for (const item of items) {
    const key = item[field] || 'Other';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function priorityRank(p) {
  const m = String(p || '').match(/p?\s*(\d+)/i);
  return m ? Number(m[1]) : 99;
}

function isOverdueOrSoon(dueDate, withinDays = 3) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (due - today) / 86400000;
  return diff <= withinDays;
}

function isDoneStatus(status) {
  return /done|complete|shipped|closed/i.test(status || '');
}

/** Portfolio stats tuned to CasinWorks Projects sheet (Status / Stage / Priority) */
export function projectStats(projects) {
  const total = projects.length;
  const active = projects.filter((p) => /^active$/i.test(String(p.Status || '').trim())).length;
  const onHold = projects.filter((p) => /hold/i.test(p.Status || '')).length;
  const blocked = projects.filter((p) => /block/i.test(p.Status || '')).length;
  const done = projects.filter((p) => isDoneStatus(p.Status)).length;
  const liveStage = projects.filter((p) => /live/i.test(p.Stage || p.Type || '')).length;
  const openProjects = projects.filter((p) => !isDoneStatus(p.Status));
  const atRisk = openProjects.filter(
    (p) =>
      /block/i.test(p.Status || '') ||
      Boolean(p.Blockers) ||
      isOverdueOrSoon(p.DueDate, 3)
  ).length;

  const STATUS_ORDER = ['Active', 'On hold', 'Blocked', 'Done'];
  const byStatusRaw = countBy(projects, 'Status');
  const byStatus = [
    ...STATUS_ORDER.filter((name) => byStatusRaw.some((x) => x.name === name)).map((name) =>
      byStatusRaw.find((x) => x.name === name)
    ),
    ...byStatusRaw.filter((x) => !STATUS_ORDER.includes(x.name)),
  ];
  const byStage = countBy(projects, 'Stage');
  const byPriority = countBy(projects, 'Priority').sort(
    (a, b) => priorityRank(a.name) - priorityRank(b.name)
  );

  const attention = [...openProjects]
    .filter(
      (p) =>
        /block|hold/i.test(p.Status || '') ||
        Boolean(p.Blockers) ||
        isOverdueOrSoon(p.DueDate, 7)
    )
    .sort((a, b) => priorityRank(a.Priority) - priorityRank(b.Priority))
    .slice(0, 10)
    .map((p) => ({
      id: p.ID,
      title: p.Title,
      status: p.Status,
      stage: p.Stage,
      priority: p.Priority,
      dueDate: p.DueDate,
      blockers: p.Blockers,
      focus: p.FocusNow,
    }));

  return {
    kind: 'project-manager',
    byCategory: byStage,
    byStatus,
    byStage,
    byPriority,
    byOwner: [],
    burnup: [],
    scopeNote: '',
    sprintDays: 10,
    attention,
    totals: {
      total,
      open: active + onHold + blocked,
      resolved: done,
      active,
      atRisk,
      onHold,
      blocked,
      done,
      liveStage,
      completionPct: total === 0 ? 0 : Math.round((done / total) * 100),
      avgProgress:
        total === 0
          ? 0
          : Math.round(projects.reduce((s, p) => s + (Number(p.Progress) || 0), 0) / total),
    },
  };
}

/** Pipeline stats tuned to CasinWorks Leads sheet (New / Warm / Waiting) */
export function leadStats(leads) {
  const total = leads.length;
  const openLeads = leads.filter((l) => !/won|lost|closed|dead/i.test(l.Status || ''));
  const waiting = leads.filter((l) => /wait/i.test(l.Status || ''));
  const warm = leads.filter((l) => /warm/i.test(l.Status || ''));
  const neu = leads.filter((l) => /new/i.test(l.Status || ''));

  const pipelineValue = openLeads.reduce((s, l) => s + (Number(l.Value) || 0), 0);
  const waitingValue = waiting.reduce((s, l) => s + (Number(l.Value) || 0), 0);
  const avgDealSize =
    openLeads.filter((l) => Number(l.Value) > 0).length === 0
      ? 0
      : Math.round(
          pipelineValue / openLeads.filter((l) => Number(l.Value) > 0).length
        );

  const STAGE_ORDER = ['New', 'Warm', 'Waiting', 'Won', 'Lost'];
  const byStatusMap = countBy(leads, 'Status');
  const byStage = STAGE_ORDER.filter((s) => byStatusMap.some((x) => x.name === s)).map((name) => {
    const found = byStatusMap.find((x) => x.name === name);
    const value = leads
      .filter((l) => l.Status === name)
      .reduce((s, l) => s + (Number(l.Value) || 0), 0);
    return { name, count: found?.count || 0, value };
  });
  for (const row of byStatusMap) {
    if (!STAGE_ORDER.includes(row.name)) {
      const value = leads
        .filter((l) => l.Status === row.name)
        .reduce((s, l) => s + (Number(l.Value) || 0), 0);
      byStage.push({ name: row.name, count: row.count, value });
    }
  }

  const bySource = countBy(leads, 'Source');
  const byPriority = countBy(leads, 'Priority').sort(
    (a, b) => priorityRank(a.name) - priorityRank(b.name)
  );

  const followUpsDue = leads
    .filter((l) => l.FollowUp && isOverdueOrSoon(l.FollowUp, 0))
    .sort((a, b) => priorityRank(a.Priority) - priorityRank(b.Priority));

  const hotLeads = [...openLeads]
    .sort((a, b) => {
      const pr = priorityRank(a.Priority) - priorityRank(b.Priority);
      if (pr !== 0) return pr;
      return (Number(b.Value) || 0) - (Number(a.Value) || 0);
    })
    .slice(0, 8)
    .map((l) => ({
      id: l.ID,
      company: l.Company,
      title: l.NextAction || l.Title,
      status: l.Status,
      priority: l.Priority,
      owner: l.Owner,
      value: l.Value,
      followUp: l.FollowUp,
    }));

  return {
    kind: 'leads',
    byCategory: bySource,
    byStatus: byStatusMap,
    byStage,
    byPriority,
    byOwner: [],
    valueBySource: [],
    burnup: [],
    scopeNote: '',
    sprintDays: 10,
    hotLeads,
    followUpsDue: followUpsDue.slice(0, 8).map((l) => ({
      id: l.ID,
      company: l.Company,
      followUp: l.FollowUp,
      priority: l.Priority,
      nextAction: l.NextAction,
    })),
    totals: {
      total,
      open: openLeads.length,
      resolved: waiting.length,
      lost: 0,
      newCount: neu.length,
      warmCount: warm.length,
      waitingCount: waiting.length,
      completionPct: 0,
      pipelineValue,
      wonValue: waitingValue,
      avgDealSize,
      winRate: 0,
      followUpsDueCount: followUpsDue.length,
    },
  };
}

// keep unused helpers referenced for lint silence if tree-shaken elsewhere
void startOfDayISO;
void daysAgo;
