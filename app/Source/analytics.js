import { incomeRecords } from './inspectionIncome.js';
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const sum = rows => rows.reduce((n, r) => n + Math.round((Number.isFinite(r.amount) ? r.amount : 0) * 100), 0) / 100;
export function describe(book, r) {
  const domain = r.kind === 'income' || r.scope === 'residence' ? 'personal' : 'business';
  const flow = r.kind === 'income' || r.kind === 'inspection' ? 'income' : 'expense';
  if (!['income', 'inspection', 'expense'].includes(r.kind) || r.kind === 'expense' && !['business', 'residence'].includes(r.scope)) return null;
  const def = (r.kind === 'income' ? book.incomeSources : book.householdCategories)?.find(c => c.id === r.householdCategoryId);
  const category = r.kind === 'inspection' ? 'Inspection sales' : r.kind === 'income' ? def?.name || r.description || 'Other income' : domain === 'personal' ? def?.name || r.subCategory || r.description || r.category || 'Uncategorized' : r.category || 'Uncategorized';
  const subcategory = domain === 'personal' ? def?.subs?.find(s => s.id === r.householdSubId)?.name || '' : r.subCategory || '';
  return {
    domain,
    flow,
    category,
    subcategory,
    key: JSON.stringify([domain, flow, category])
  };
}
export function defaultGroup(label) {
  return ['groceries', 'food - grocery'].includes(label.trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ')) ? 'Groceries' : label;
}
export function sources(books) {
  const map = new Map();
  for (const book of books) for (const r of incomeRecords(book)) {
    const d = describe(book, r);
    if (d) map.set(d.key, d);
  }
  return [...map.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.flow.localeCompare(b.flow) || a.category.localeCompare(b.category));
}
export function entries(book, settings = {}, scope = 'combined', start = 0, end = 11) {
  return incomeRecords(book).filter(r => r.state === 'recorded' && MONTHS.indexOf(r.month) >= start && MONTHS.indexOf(r.month) <= end).flatMap(r => {
    const d = describe(book, r);
    if (!d || scope !== 'combined' && d.domain !== scope) return [];
    return [{
      ...r,
      ...d,
      year: book.year,
      group: settings.aliases?.[d.key] || defaultGroup(d.category),
      notes: [...(book.inspectionLedger?.sources?.find(s => s.id === (r.sourceJobId || r.id))?.notes || book.notes || []).filter(n => n.recordId === (r.sourceJobId || r.id)).map(n => n.text), ...(r.sourceNote ? [r.sourceNote] : [])]
    }];
  });
}
export function totals(rows) {
  const income = sum(rows.filter(r => r.flow === 'income')),
    expense = sum(rows.filter(r => r.flow === 'expense'));
  return {
    income,
    expense,
    net: Math.round((income - expense) * 100) / 100,
    missing: rows.filter(r => r.amount === null || r.amount === undefined || !Number.isFinite(r.amount)).length
  };
}
export function buckets(rows, sub = false) {
  const map = new Map();
  for (const r of rows) {
    const label = r.group + (sub ? ' / ' + (r.subcategory || 'Unassigned') : ''),
      key = JSON.stringify([r.domain, r.flow, label]);
    if (!map.has(key)) map.set(key, {
      key,
      label,
      domain: r.domain,
      flow: r.flow,
      rows: []
    });
    map.get(key).rows.push(r);
  }
  return [...map.values()].map(g => ({
    ...g,
    total: sum(g.rows)
  })).sort((a, b) => a.domain.localeCompare(b.domain) || a.flow.localeCompare(b.flow) || a.label.localeCompare(b.label));
}
export function change(current, previous) {
  return {
    amount: Math.round((current - previous) * 100) / 100,
    percent: previous === 0 ? null : (current - previous) / Math.abs(previous) * 100
  };
}
export function signature(book, domain, month) {
  const r = entries(book, {}, domain, month, month).map(r => [r.id, r.kind, r.amount, r.category, r.subcategory, r.description, r.transactionDate, r.notes]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const transfers = (book.transfers || []).filter(t => (t.scope === domain || t.scope === 'both') && Number(t.date.slice(5, 7)) - 1 === month).map(t => [t.id, t.date, t.amount, t.from, t.to, t.scope, t.note]).sort((a, b) => a[0].localeCompare(b[0]));
  const text = JSON.stringify(r) + (transfers.length ? JSON.stringify(transfers) : '');
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return text.length + ':' + (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16);
}
export function markerKey(book, domain, month) {
  return `${book.year}:${domain}:${month}`;
}
export function completion(book, settings, scope, month) {
  const domains = scope === 'combined' ? ['business', 'personal'] : [scope];
  const states = domains.map(domain => {
    const saved = settings.reconciled?.[markerKey(book, domain, month)];
    return !saved ? 'Not reconciled' : saved === signature(book, domain, month) ? 'Reconciled' : 'Changed since review';
  });
  return states.every(s => s === 'Reconciled') ? 'Reconciled' : states.includes('Changed since review') ? 'Changed since review' : 'Not reconciled';
}
export function reportCSV(rows) {
  const data = [['Year', 'Month', 'Area', 'Flow', 'Reporting group', 'Original category', 'Subcategory', 'Description', 'Amount', 'Date', 'Notes'], ...rows.map(r => [r.year, r.month, r.domain, r.flow, r.group, r.category, r.subcategory, r.description, r.amount ?? '', r.transactionDate || '', r.notes.join('\n')])];
  return '\uFEFF' + data.map(row => row.map(v => {
    let s = String(v ?? '');
    if (typeof v !== 'number' && /^\s*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}
export function reviewRows(book, domain, month) {
  const rows = entries(book, {}, domain, month, month).map(r => ({
    id: r.id,
    type: 'entry',
    kind: r.kind,
    area: domain === 'personal' ? r.flow === 'income' ? 'Personal income' : 'Housing expenses' : r.flow === 'income' ? 'Business income' : 'Business expenses',
    category: r.category,
    subcategory: r.subcategory,
    description: r.description ?? null,
    amount: r.amount ?? null,
    date: r.transactionDate ?? null,
    notes: r.notes
  }));
  for (const t of book.transfers || []) if ((t.scope === domain || t.scope === 'both') && Number(t.date.slice(5, 7)) - 1 === month) rows.push({
    id: t.id,
    type: 'transfer',
    area: 'Transfers',
    category: 'Transfers',
    subcategory: '',
    description: t.from + ' → ' + t.to,
    from: t.from,
    to: t.to,
    amount: t.amount,
    date: t.date,
    notes: [t.note || ''],
    scope: t.scope
  });
  return rows.sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id));
}
export function markReconciliation(book, settings, domain, month, clear = false) {
  const key = markerKey(book, domain, month),
    next = {
      ...settings,
      reconciled: {
        ...settings.reconciled
      },
      reviewSnapshots: {
        ...settings.reviewSnapshots
      }
    };
  if (clear) {
    delete next.reconciled[key];
    delete next.reviewSnapshots[key];
  } else {
    const fingerprint = signature(book, domain, month);
    next.reconciled[key] = fingerprint;
    next.reviewSnapshots[key] = {
      version: 1,
      fingerprint,
      reviewedAt: new Date().toISOString(),
      rows: reviewRows(book, domain, month)
    };
  }
  return next;
}
export function reviewDetails(book, settings, domain, month) {
  const key = markerKey(book, domain, month),
    state = completion(book, settings, domain, month),
    current = reviewRows(book, domain, month),
    saved = settings.reviewSnapshots?.[key],
    known = saved?.version === 1 && saved.fingerprint === settings.reconciled?.[key],
    changes = [];
  if (known) {
    const before = new Map(saved.rows.map(r => [r.type + ':' + r.id, r])),
      after = new Map(current.map(r => [r.type + ':' + r.id, r]));
    for (const [id, row] of after) {
      const old = before.get(id);
      if (!old) changes.push({
        row,
        kind: 'Added',
        fields: []
      });else {
        const fields = ['kind', 'category', 'subcategory', 'description', 'amount', 'date', 'notes', 'scope', 'from', 'to'].filter(k => JSON.stringify(old[k] ?? null) !== JSON.stringify(row[k] ?? null)).map(k => ({
          field: k,
          before: old[k],
          after: row[k]
        }));
        if (fields.length) changes.push({
          row,
          kind: 'Changed',
          fields
        });
      }
    }
    for (const [id, row] of before) if (!after.has(id)) changes.push({
      row,
      kind: 'Removed from this month',
      fields: [],
      removed: true
    });
  }
  return {
    state,
    current,
    changes,
    known,
    reviewedAt: known ? saved.reviewedAt : null,
    legacy: state === 'Changed since review' && !known
  };
}
