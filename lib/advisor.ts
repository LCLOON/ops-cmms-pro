// The OpsCMMSPro Advisor: a deterministic, local reasoning engine that knows
// every module, table and workflow in this application. It answers operator
// questions with real data pulled from lib/operations.ts and, when an LLM key
// is configured, can additionally ask a hosted model for narrative guidance.
//
// Design rule: the advisor always works. With no API key it answers from live
// data using the knowledge base below. With a key it augments that answer.

import {
  getAssets, getWorkOrders, getPmSchedules, getInventory, getAnalytics,
  getDashboardStats, getComplianceObligations, getInspections, getDocuments,
  getSafetyPermits, getElectricalTests, getVendors, getPurchaseOrders, getBacklogAging,
} from './operations';
import { KNOWLEDGE, type KnowledgeEntry } from './knowledge';

export interface AdvisorAnswer {
  answer: string;
  intent: string;
  sources: string[];
  data?: unknown;
  suggestedPage?: string;
  usedModel: boolean;
  modelError?: string;
}

export type { KnowledgeEntry };
export { KNOWLEDGE };

export interface AdvisorContext {
  question: string;
  role: string;
}

function score(question: string, entry: KnowledgeEntry): number {
  const q = question.toLowerCase();
  let s = 0;
  if (q.includes(entry.module.toLowerCase())) s += 10;
  for (const word of entry.module.toLowerCase().split(/\s+/)) {
    if (word.length > 3 && q.includes(word)) s += 4;
  }
  for (const field of entry.fields) {
    if (q.includes(field.toLowerCase().replace(/([A-Z])/g, ' $1').toLowerCase())) s += 2;
  }
  for (const rel of entry.related) if (q.includes(rel.toLowerCase())) s += 1;
  for (const step of entry.how) {
    for (const w of step.toLowerCase().split(/\s+/)) {
      if (w.length > 5 && q.includes(w)) s += 1;
    }
  }
  return s;
}

function detectIntent(q: string): string {
  const t = q.toLowerCase();
  if (/\b(how do i|how to|where do i|how can i|steps?)\b/.test(t)) return 'howto';
  if (/\b(what is|what are|explain|tell me about|overview|describe|what does)\b/.test(t)) return 'explain';
  if (/\b(critical|worst|top|risk|attention|problem|issues?|trouble)\b/.test(t)) return 'diagnose';
  if (/\b(how many|count|total|list|show me|status|summary|kpi|overdue|down|backlog)\b/.test(t)) return 'status';
  if (/\b(help|guide|get started|onboard|train)\b/.test(t)) return 'help';
  return 'general';
}

// Data-grounded answers. Every branch reads live records, so the advisor can
// never quote a number that is not in the database.
async function dataAnswer(intent: string, question: string): Promise<{ text: string; sources: string[]; data?: unknown; page?: string } | null> {
  const q = question.toLowerCase();
  const wants = (re: RegExp) => re.test(q);

  if (intent === 'diagnose' || wants(/\b(critical|risk|attention|priorit|what should)\b/)) {
    const [assets, wos, pms, stats, backlog, analytics] = await Promise.all([
      getAssets(), getWorkOrders(), getPmSchedules(), getDashboardStats(), getBacklogAging(), getAnalytics(),
    ]);
    const downCritical = assets.filter(a => a.status === 'down' && a.criticality === 'critical');
    const overduePms = pms.filter(p => p.active && p.nextDue && new Date(p.nextDue) < new Date());
    const openCriticalWos = wos.filter(w => w.priority === 'critical' && ['open', 'in_progress'].includes(w.status));
    const lines: string[] = [];
    lines.push(`Live risk picture across ${assets.length} assets and ${wos.length} work orders:`);
    lines.push('');
    lines.push(`• Down & critical assets: ${downCritical.length}`);
    for (const a of downCritical.slice(0, 6)) lines.push(`   – ${a.name} (${a.id})${a.location ? ' at ' + a.location : ''}`);
    lines.push(`• Overdue PMs: ${overduePms.length} of ${pms.filter(p => p.active).length} active schedules`);
    for (const p of overduePms.slice(0, 6)) lines.push(`   – ${p.title} — due ${p.nextDue}`);
    lines.push(`• Open critical work orders: ${openCriticalWos.length}`);
    for (const w of openCriticalWos.slice(0, 6)) lines.push(`   – ${w.title} (${w.id}) — ${w.status}`);
    lines.push(`• Backlog: ${stats.openWorkOrders} open, low stock lines: ${stats.lowStock}`);
    if (backlog.length > 0) {
      lines.push('• Backlog aging:');
      for (const b of backlog) lines.push(`   – ${b.aging}: ${b.count} WO(s)`);
    }
    lines.push('');
    lines.push('Suggested priority: clear down + critical assets first, then overdue PMs on critical assets, then aged backlog.');
    return {
      text: lines.join('\n'),
      sources: ['getAssets', 'getWorkOrders', 'getPmSchedules', 'getDashboardStats', 'getBacklogAging', 'getAnalytics'],
      data: { downCritical, overduePms, openCriticalWos, backlog, pmCompliance: analytics.pmCompliance },
      page: 'dashboard',
    };
  }

  if (intent === 'status' || intent === 'general') {
    const [stats, analytics] = await Promise.all([getDashboardStats(), getAnalytics()]);
    const lines = [
      'Current site status:',
      '',
      `• Assets on file: ${stats.totalAssets}`,
      `• Assets down: ${stats.downAssets}`,
      `• Open work orders: ${stats.openWorkOrders}`,
      `• Overdue PMs: ${stats.overduePMs}`,
      `• Low stock items: ${stats.lowStock}`,
      `• Completed this month: ${stats.completedThisMonth}`,
      '',
      `PM compliance: ${analytics.pmCompliance.complianceRate}% (${analytics.pmCompliance.completed} completed / ${analytics.pmCompliance.overdue} overdue of ${analytics.pmCompliance.total})`,
      `Compliance obligations overdue: ${analytics.complianceOverdue} of ${analytics.complianceTotal}`,
      `YTD: ${analytics.ytdStats.totalWOs} work orders, ${analytics.ytdStats.totalLaborHours} labor hours, $${analytics.ytdStats.totalPartsCost} parts, avg resolution ${analytics.ytdStats.avgResolutionDays} days`,
      `Inventory: ${analytics.inventoryValue.totalItems} items worth $${analytics.inventoryValue.totalValue} (${analytics.inventoryValue.lowStockCount} low)`,
    ];
    return {
      text: lines.join('\n'),
      sources: ['getDashboardStats', 'getAnalytics'],
      data: { stats, analytics },
      page: 'dashboard',
    };
  }

  if (wants(/\b(asset|register|equipment)\b/)) {
    const assets = await getAssets();
    const byStatus = assets.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {});
    const byCrit = assets.reduce<Record<string, number>>((acc, a) => { acc[a.criticality] = (acc[a.criticality] ?? 0) + 1; return acc; }, {});
    const lines = [
      `Asset register: ${assets.length} assets.`,
      `By status: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`,
      `By criticality: ${Object.entries(byCrit).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`,
      '',
      'Open Assets in the sidebar to add, edit, import, or build the register from a document.',
    ];
    return { text: lines.join('\n'), sources: ['getAssets'], data: { byStatus, byCrit }, page: 'assets' };
  }

  if (wants(/\b(work order|wo\b|backlog|corrective|emergency)\b/)) {
    const [wos, backlog] = await Promise.all([getWorkOrders(), getBacklogAging()]);
    const open = wos.filter(w => ['open', 'in_progress', 'on_hold'].includes(w.status));
    const lines = [
      `Work orders: ${wos.length} total, ${open.length} still open.`,
      `Open by priority: critical ${open.filter(w => w.priority === 'critical').length}, high ${open.filter(w => w.priority === 'high').length}, medium ${open.filter(w => w.priority === 'medium').length}, low ${open.filter(w => w.priority === 'low').length}.`,
    ];
    if (backlog.length > 0) {
      lines.push('Backlog aging:');
      for (const b of backlog) lines.push(`• ${b.aging}: ${b.count} (${b.totalCost} parts cost)`);
    }
    return { text: lines.join('\n'), sources: ['getWorkOrders', 'getBacklogAging'], data: { open: open.length, backlog }, page: 'work-orders' };
  }

  if (wants(/\b(pm|preventive|schedule|overdue pm)\b/)) {
    const pms = await getPmSchedules();
    const active = pms.filter(p => p.active);
    const overdue = active.filter(p => p.nextDue && new Date(p.nextDue) < new Date());
    const lines = [
      `PM schedules: ${active.length} active of ${pms.length}.`,
      `Overdue: ${overdue.length}.`,
      ...overdue.slice(0, 8).map(p => `• ${p.title} — due ${p.nextDue}${p.assignedTo ? ' (' + p.assignedTo + ')' : ''}`),
    ];
    return { text: lines.join('\n'), sources: ['getPmSchedules'], data: { overdue: overdue.length, active: active.length }, page: 'pm-schedule' };
  }

  if (wants(/\b(inventory|stock|spare|parts)\b/)) {
    const items = await getInventory();
    const low = items.filter(i => i.quantityOnHand <= i.minQuantity);
    const value = items.reduce((sum, i) => sum + i.quantityOnHand * i.unitCost, 0);
    const lines = [
      `Inventory: ${items.length} lines, on-hand value $${Math.round(value)}.`,
      `At or below minimum: ${low.length}.`,
      ...low.slice(0, 8).map(i => `• ${i.name}${i.partNumber ? ' (' + i.partNumber + ')' : ''} — ${i.quantityOnHand} on hand, min ${i.minQuantity}`),
    ];
    return { text: lines.join('\n'), sources: ['getInventory'], data: { low: low.length, value }, page: 'inventory' };
  }

  if (wants(/\b(compliance|ferc|obligation|licence|license|dam safety|nerc)\b/)) {
    const obligations = await getComplianceObligations();
    const overdue = obligations.filter(o => o.status === 'overdue' || (o.nextDue && new Date(o.nextDue) < new Date() && o.status !== 'completed' && o.status !== 'waived'));
    const lines = [
      `Compliance obligations: ${obligations.length}. Overdue or past due: ${overdue.length}.`,
      ...overdue.slice(0, 8).map(o => `• ${o.title} (${o.obligationType}) — due ${o.nextDue || 'unset'}, status ${o.status}`),
    ];
    return { text: lines.join('\n'), sources: ['getComplianceObligations'], data: { overdue: overdue.length }, page: 'compliance' };
  }

  if (wants(/\b(inspection|finding|walkdown)\b/)) {
    const inspections = await getInspections();
    const open = inspections.filter(i => i.status !== 'completed');
    const deficient = inspections.filter(i => i.status === 'deficient');
    const lines = [
      `Inspections: ${inspections.length}. Not completed: ${open.length}. Deficient: ${deficient.length}.`,
      ...deficient.slice(0, 6).map(i => `• ${i.title} — ${i.findings || 'no findings recorded'}`),
    ];
    return { text: lines.join('\n'), sources: ['getInspections'], data: { open: open.length, deficient: deficient.length }, page: 'inspections' };
  }

  if (wants(/\b(document|manual|drawing|sop|eap|loto procedure)\b/)) {
    const docs = await getDocuments();
    const due = docs.filter(d => d.active && d.reviewDueDate && new Date(d.reviewDueDate) < new Date());
    const lines = [
      `Documents: ${docs.length} on file. Review overdue: ${due.length}.`,
      ...due.slice(0, 6).map(d => `• ${d.title} (${d.documentType}) — review due ${d.reviewDueDate}`),
      '',
      'Use Document ingestion on the Documents page to turn a register, nameplate list, or pasted manual text into asset candidates before importing them.',
    ];
    return { text: lines.join('\n'), sources: ['getDocuments'], data: { due: due.length }, page: 'documents' };
  }

  if (wants(/\b(permit|safety|loto|hot work|confined)\b/)) {
    const permits = await getSafetyPermits();
    const active = permits.filter(p => ['issued', 'active'].includes(p.status));
    const lines = [
      `Safety permits: ${permits.length}. Issued or active: ${active.length}.`,
      ...active.slice(0, 6).map(p => `• ${p.permitType} ${p.permitNumber || p.id} — ${p.status}, expires ${p.expiryDate || 'unset'}`),
    ];
    return { text: lines.join('\n'), sources: ['getSafetyPermits'], data: { active: active.length }, page: 'safety' };
  }

  if (wants(/\b(electrical|relay|dga|transformer|breaker timing|battery test)\b/)) {
    const tests = await getElectricalTests();
    const failed = tests.filter(t => t.status === 'failed' || t.status === 'attention');
    const lines = [
      `Electrical tests: ${tests.length}. Failed or needing attention: ${failed.length}.`,
      ...failed.slice(0, 6).map(t => `• ${t.testType} on ${t.assetId || 'unlinked asset'} — ${t.status}, tested ${t.testDate}`),
    ];
    return { text: lines.join('\n'), sources: ['getElectricalTests'], data: { failed: failed.length }, page: 'electrical' };
  }

  if (wants(/\b(vendor|supplier|purchase order|po\b|procurement)\b/)) {
    const [vendors, pos] = await Promise.all([getVendors(), getPurchaseOrders()]);
    const openPos = pos.filter(p => p.status === 'draft' || p.status === 'sent');
    const lines = [
      `Vendors: ${vendors.filter(v => v.active).length} active of ${vendors.length}.`,
      `Purchase orders: ${pos.length}. Draft or sent: ${openPos.length}.`,
      ...openPos.slice(0, 6).map(p => `• ${p.poNumber || p.id} — ${p.status}, total $${p.totalCost}`),
    ];
    return { text: lines.join('\n'), sources: ['getVendors', 'getPurchaseOrders'], data: { openPos: openPos.length }, page: 'purchase-orders' };
  }

  return null;
}

async function modelAnswer(question: string, grounded: string | null, role: string): Promise<{ text: string; url: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const knowledge = KNOWLEDGE.map(k => `- ${k.module} (${k.page}): ${k.what} Fields: ${k.fields.join(', ')}. Steps: ${k.how.join(' ')}`).join('\n');

  const system = [
    'You are the OpsCMMSPro Advisor, embedded in an operations CMMS for hydro/utility maintenance teams.',
    'You know this application exhaustively. Answer using ONLY the module knowledge and live data provided.',
    'Be concise and operational: short paragraphs or bullet lists. Never invent numbers, fields or menu items.',
    'If the live data does not answer the question, say what to look at in the app instead of guessing.',
    `The signed-in user has role: ${role}.`,
    '',
    'MODULE KNOWLEDGE:',
    knowledge,
  ].join('\n');

  const user = grounded
    ? `Question: ${question}\n\nLIVE DATA (authoritative, already fetched from this deployment):\n${grounded}`
    : `Question: ${question}\n\nNo live data was retrieved for this question.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Model request failed (${res.status})${detail ? ': ' + detail.slice(0, 200) : ''}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Model returned an empty response');
  return { text, url: `${baseUrl}/chat/completions` };
}

export async function askAdvisor({ question, role }: AdvisorContext): Promise<AdvisorAnswer> {
  const q = question.trim();
  if (!q) {
    return { answer: 'Ask me anything about this CMMS — for example "what needs attention today?", "how do I create a PM schedule?", or "what does the Documents module do?".', intent: 'empty', sources: [], usedModel: false };
  }

  const intent = detectIntent(q);
  const allowData = role !== 'viewer';

  // Knowledge lookup always runs — it is what makes the advisor authoritative
  // about the application itself. Module questions (howto/explain/help) must
  // not be swallowed by the live-status fallback in dataAnswer.
  const ranked = KNOWLEDGE
    .map(entry => ({ entry, s: score(q, entry) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  const moduleQuestion = intent === 'howto' || intent === 'explain' || intent === 'help';
  const grounded = allowData && !moduleQuestion
    ? await dataAnswer(intent, q).catch(() => null)
    : null;

  const sources = grounded ? [...grounded.sources] : [];
  const parts: string[] = [];

  if (grounded) parts.push(grounded.text);

  if (ranked.length > 0) {
    if (parts.length > 0) parts.push('');
    parts.push(`In the app — ${ranked.map(r => r.entry.module).join(', ')}:`);
    for (const { entry } of ranked) {
      parts.push(`• ${entry.module} (${entry.page}): ${entry.what}`);
      parts.push(`   How: ${entry.how.join(' ')}`);
      parts.push(`   Key fields: ${entry.fields.join(', ')}`);
      sources.push(`knowledge:${entry.module}`);
    }
  }

  let usedModel = false;
  let modelError: string | undefined;

  const wantsNarrative = intent === 'howto' || intent === 'explain' || intent === 'help' || /\b(why|advise|recommend|best practice|should i)\b/i.test(q);
  if (process.env.OPENAI_API_KEY && (wantsNarrative || parts.length === 0)) {
    try {
      const m = await modelAnswer(q, grounded?.text ?? null, role);
      parts.push('');
      parts.push('Advisor guidance:');
      parts.push(m.text);
      sources.push(`model:${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
      usedModel = true;
    } catch (err) {
      modelError = err instanceof Error ? err.message : 'Model request failed';
    }
  }

  if (parts.length === 0) {
    parts.push(
      'I could not match that to a module or a live metric. Try naming a module (Assets, Work Orders, PM Schedule, Inventory, Vendors, Purchase Orders, Compliance, Documents, Safety, Inspections, Electrical, Reports, Admin) or asking for today\'s status — for example "what needs attention?" or "how many overdue PMs?".',
    );
  }

  if (modelError) {
    parts.push('');
    parts.push(`(AI narrative unavailable: ${modelError}. The data-grounded answer above is unaffected.)`);
  }

  return {
    answer: parts.join('\n'),
    intent,
    sources: Array.from(new Set(sources)),
    data: grounded?.data,
    suggestedPage: ranked[0]?.entry.page ?? grounded?.page,
    usedModel,
    modelError,
  };
}
