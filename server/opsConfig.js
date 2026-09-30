/**
 * CasinWorks OPS — operation registry.
 * Sheet IDs can be filled later; ops without a sheet run on sample data.
 */
export const OPS = [
  {
    id: 'service-desk',
    name: 'Service Desk',
    short: 'IT tickets & incidents',
    description: 'Intake, triage, and resolve IT service tickets from the live CasinWorks sheet.',
    itemLabel: 'ticket',
    itemLabelPlural: 'tickets',
    idPrefix: 'TCK',
    routes: {
      list: 'tickets',
      new: 'new',
    },
    sheetEnv: 'SHEET_ID_SERVICE_DESK',
    sheetEnvFallback: 'SHEET_ID',
    tabEnv: 'SHEET_TAB_SERVICE_DESK',
    tabDefault: 'Tickets',
    accent: '#5BA3D9',
  },
  {
    id: 'project-manager',
    name: 'Project Manager',
    short: 'Delivery & milestones',
    description: 'Track client projects, owners, and delivery status. Sheet link coming from Geoff.',
    itemLabel: 'project',
    itemLabelPlural: 'projects',
    idPrefix: 'PRJ',
    routes: {
      list: 'projects',
      new: 'new',
    },
    sheetEnv: 'SHEET_ID_PROJECT_MANAGER',
    tabEnv: 'SHEET_TAB_PROJECT_MANAGER',
    tabDefault: 'Projects',
    accent: '#7BC67E',
  },
  {
    id: 'leads',
    name: 'Leads',
    short: 'Pipeline & outreach',
    description: 'Manage inbound and outbound leads through the sales pipeline. Sheet link coming from Geoff.',
    itemLabel: 'lead',
    itemLabelPlural: 'leads',
    idPrefix: 'LED',
    routes: {
      list: 'leads',
      new: 'new',
    },
    sheetEnv: 'SHEET_ID_LEADS',
    tabEnv: 'SHEET_TAB_LEADS',
    tabDefault: 'Leads',
    accent: '#E8A838',
  },
  {
    id: 'finance',
    name: 'Finance',
    short: 'Cash, billing & runway',
    description: 'Owner-only view of business cash, billing pipeline, payments, expenses, and assets (Manny sheet).',
    itemLabel: 'record',
    itemLabelPlural: 'records',
    idPrefix: 'FIN',
    routes: {
      list: 'billing',
      new: 'settings',
    },
    sheetEnv: 'FINANCE_SHEET_ID',
    tabEnv: 'FINANCE_SHEET_TAB',
    tabDefault: 'Billing',
    accent: '#5DBF9A',
    ownerOnly: true,
    readOnly: true,
  },
];

export function getOp(opId) {
  return OPS.find((o) => o.id === opId) || null;
}

/** Used when the host has no sheet env vars (Vercel). Override with env. */
const DEFAULT_SHEET_IDS = {
  SHEET_ID_SERVICE_DESK: '1bxVxKX3X5oWD43V--GLSpXyyrKXikEjIMKwJPLmCT3M',
  SHEET_ID: '1bxVxKX3X5oWD43V--GLSpXyyrKXikEjIMKwJPLmCT3M',
  SHEET_ID_PROJECT_MANAGER: '1GTFZwxfy3A5QP7SGPu1B_Viofc518Q7teF_wwRGSjYg',
  SHEET_ID_LEADS: '1GTFZwxfy3A5QP7SGPu1B_Viofc518Q7teF_wwRGSjYg',
  FINANCE_SHEET_ID: '15qECt9vONPGPot0GsNo43NUlUanMbwpA41uyBJhQ4Ys',
};

export function resolveSheetId(op) {
  const primary = process.env[op.sheetEnv] || DEFAULT_SHEET_IDS[op.sheetEnv];
  if (primary && String(primary).trim()) return String(primary).trim();
  if (op.sheetEnvFallback) {
    const fallback = process.env[op.sheetEnvFallback] || DEFAULT_SHEET_IDS[op.sheetEnvFallback];
    if (fallback && String(fallback).trim()) return String(fallback).trim();
  }
  return '';
}

export function isOpConfigured(op) {
  if (process.env.MOCK_SHEETS === 'true') return false;
  return Boolean(resolveSheetId(op));
}

export function listOpsPublic(viewerRole = 'owner') {
  return OPS.filter((op) => {
    if (op.ownerOnly && viewerRole !== 'owner') return false;
    return true;
  }).map((op) => {
    const configured = isOpConfigured(op);
    return {
      id: op.id,
      name: op.name,
      short: op.short,
      description: op.description,
      itemLabel: op.itemLabel,
      itemLabelPlural: op.itemLabelPlural,
      idPrefix: op.idPrefix,
      routes: op.routes,
      accent: op.accent,
      ownerOnly: Boolean(op.ownerOnly),
      readOnly: Boolean(op.readOnly),
      status: configured ? 'live' : 'ready',
      statusLabel: configured ? 'Live sheet' : 'Awaiting sheet link',
      sheetConfigured: configured,
    };
  });
}
