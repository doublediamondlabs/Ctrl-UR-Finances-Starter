import { describe, MONTHS } from './analytics.js';
export const normalizeSearch = v => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '');
const strings = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
export function indexBook(book) {
  const rows = [],
    l = book.inspectionLedger || {
      jobs: {},
      sources: [],
      retired: []
    },
    retired = new Set((l.retired || []).map(x => x.recordId)),
    seen = new Set();
  for (const r of book.records || []) {
    if (retired.has(r.id)) continue;
    const d = describe(book, r);
    if (!d) continue;
    seen.add(r.id);
    const j = l.jobs?.[r.id],
      notes = (book.notes || []).filter(n => n.recordId === r.id).map(n => n.text);
    const detail = [r.description, r.location, r.subCategory, ...notes, ...strings(j?.profile), ...strings(j?.visits), ...(l.events || []).filter(e => e.jobId === r.id).flatMap(e => [e.note, e.type === 'payment' ? e.paidBy : '']), ...(l.sources?.find(x => x.id === r.id)?.notes || []).map(n => n.text)].filter(Boolean).join(' · ');
    rows.push({
      id: r.id,
      type: 'entry',
      year: book.year,
      month: Math.max(0, MONTHS.indexOf(r.month)),
      domain: d.domain,
      category: d.category,
      title: r.description || d.category,
      kind: r.kind,
      state: r.state,
      detail
    });
  }
  for (const [id, j] of Object.entries(l.jobs || {})) {
    if (seen.has(id) || retired.has(id) || Number(j.ownerYear) !== Number(book.year)) continue;
    const source = l.sources?.find(r => r.id === id),
      date = j.visits?.find(v => v.date)?.date;
    rows.push({
      id,
      type: 'entry',
      year: book.year,
      month: Math.max(0, MONTHS.indexOf(source?.month)),
      domain: 'business',
      category: 'Inspection',
      kind: 'inspection',
      title: j.profile?.customerName || source?.description || 'Inspection',
      detail: strings(j.profile).concat(strings(j.visits), (l.events || []).filter(e => e.jobId === id).flatMap(e => [e.note, e.type === 'payment' ? e.paidBy : '']).filter(Boolean), (source?.notes || []).map(n => n.text)).join(' · ')
    });
  }
  for (const n of book.notes || []) {
    if (n.recordId && seen.has(n.recordId)) continue;
    rows.push({
      id: n.id,
      type: 'note',
      year: book.year,
      month: Math.max(0, MONTHS.indexOf(n.sheet)),
      domain: 'notes',
      category: 'Workbook note',
      title: (n.text || 'Note').slice(0, 100),
      detail: [n.sheet, n.cell, n.text].filter(Boolean).join(' · ')
    });
  }
  for (const t of book.transfers || []) rows.push({
    id: t.id,
    type: 'transfer',
    year: book.year,
    month: Math.max(0, Number(t.date?.slice(5, 7)) - 1 || 0),
    domain: t.scope === 'personal' ? 'personal' : t.scope === 'business' ? 'business' : 'both',
    category: 'Transfers',
    title: t.from + ' → ' + t.to,
    detail: [t.note, t.date, t.from, t.to].filter(Boolean).join(' · ')
  });
  return rows.map(r => ({
    ...r,
    text: normalizeSearch([r.title, r.detail, r.category, r.year, MONTHS[r.month]].join(' '))
  }));
}
export function findThings(rows, query, scope = 'all', year = 'all') {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return rows.filter(r => (scope === 'all' || r.domain === scope || r.domain === 'both') && (year === 'all' || String(r.year) === String(year)) && terms.every(t => r.text.includes(t))).sort((a, b) => b.year - a.year || a.month - b.month || a.title.localeCompare(b.title));
}
export function searchSnippet(row, query) {
  const text = row.detail || row.title,
    term = normalizeSearch(query).trim().split(/\s+/)[0],
    at = normalizeSearch(text).indexOf(term),
    start = Math.max(0, at - 65);
  return (start ? '…' : '') + text.slice(start, start + 260) + (text.length > start + 260 ? '…' : '');
}
