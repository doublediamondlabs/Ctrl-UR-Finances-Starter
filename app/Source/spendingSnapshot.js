import { entries, buckets, sum, change, completion, MONTHS } from './analytics.js';
export const money = n => Number(n).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
});
export function spendingPeriod(book, settings, scope, start, end, today = new Date()) {
  if (!book) return null;
  const rows = entries(book, settings, scope, start, end).filter(r => r.flow === 'expense');
  const groups = buckets(rows).map(g => ({
    ...g,
    missing: g.rows.filter(r => !Number.isFinite(r.amount)).length,
    charges: sum(g.rows.filter(r => r.amount > 0)),
    refunds: sum(g.rows.filter(r => r.amount < 0))
  }));
  const months = Array.from({
    length: end - start + 1
  }, (_, i) => start + i);
  const statuses = months.map(m => ({
    month: m,
    state: completion(book, settings, scope, m)
  }));
  const current = book.year === today.getFullYear() && months.includes(today.getMonth());
  const future = book.year > today.getFullYear() || book.year === today.getFullYear() && end > today.getMonth();
  return {
    year: book.year,
    start,
    end,
    label: (start === end ? MONTHS[start] : MONTHS[start] + '–' + MONTHS[end]) + ' ' + book.year,
    rows,
    groups,
    total: sum(rows),
    charges: sum(rows.filter(r => r.amount > 0)),
    refunds: sum(rows.filter(r => r.amount < 0)),
    missing: rows.filter(r => !Number.isFinite(r.amount)).length,
    statuses,
    reviewed: statuses.filter(s => s.state === 'Reconciled').length,
    current,
    future
  };
}
export function compareSpending(a, b) {
  if (!a || !b) return [];
  const am = new Map(a.groups.map(g => [g.key, g])),
    bm = new Map(b.groups.map(g => [g.key, g]));
  return [...new Set([...am.keys(), ...bm.keys()])].map(key => {
    const x = am.get(key),
      y = bm.get(key);
    return {
      key,
      label: (x || y).label,
      a: x?.total || 0,
      b: y?.total || 0,
      rowsA: x?.rows || [],
      rowsB: y?.rows || [],
      missing: (x?.missing || 0) + (y?.missing || 0),
      ...change(y?.total || 0, x?.total || 0)
    };
  }).sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount) || x.label.localeCompare(y.label));
}
export function focusCategory(key) {
  let label = key;
  try {
    const parts = JSON.parse(key);
    if (Array.isArray(parts)) {
      if (parts[0] !== 'personal') return null;
      label = parts[2];
    }
  } catch {}
  const normalized = String(label).toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    misconline: '#7651b5',
    miscretail: '#008b8b',
    foodmisc: '#d29320'
  }[normalized] || null;
}
export function categoryColor(key) {
  const focus = focusCategory(key);
  if (focus) return focus;
  let h = 0;
  for (const c of key) h = Math.imul(h, 31) + c.charCodeAt(0) | 0;
  return `hsl(${(h >>> 0) % 360} 13% 66%)`;
}
export function spendingMix(a, b, limit = 6) {
  if (!a || !b) return [];
  const pairs = compareSpending(a, b).map(g => ({
    ...g,
    chargeA: sum(g.rowsA.filter(r => r.amount > 0)),
    chargeB: sum(g.rowsB.filter(r => r.amount > 0))
  })).filter(g => g.chargeA + g.chargeB > 0).sort((x, y) => y.chargeA + y.chargeB - (x.chargeA + x.chargeB) || x.label.localeCompare(y.label));
  const focused = pairs.filter(g => focusCategory(g.key)),
    routine = pairs.filter(g => !focusCategory(g.key)),
    top = [...focused, ...routine.slice(0, Math.max(0, limit - focused.length))],
    chosen = new Set(top.map(g => g.key)),
    other = pairs.filter(g => !chosen.has(g.key));
  if (other.length) top.push({
    key: 'other',
    label: 'Other (' + other.length + ' categories)',
    chargeA: sum(other.map(g => ({
      amount: g.chargeA
    }))),
    chargeB: sum(other.map(g => ({
      amount: g.chargeB
    }))),
    rowsA: other.flatMap(g => g.rowsA),
    rowsB: other.flatMap(g => g.rowsB)
  });
  return top;
}
export function selectedSpendingMix(a, b, keys) {
  const wanted = new Set(keys);
  const palette = ['#2874b2', '#bf586b', '#577d32', '#6b61ad', '#b06d2d', '#16819b', '#a6478f', '#5874a7'];
  let i = 0;
  return compareSpending(a, b).filter(g => wanted.has(g.key)).sort((x, y) => x.label.localeCompare(y.label)).map(g => ({
    ...g,
    chargeA: sum(g.rowsA.filter(r => r.amount > 0)),
    chargeB: sum(g.rowsB.filter(r => r.amount > 0)),
    color: focusCategory(g.key) || palette[i++ % palette.length]
  }));
}
export function selectedSpendingPeriod(p, groups, side) {
  if (!p) return null;
  const rows = groups.flatMap(g => g[side === 'a' ? 'rowsA' : 'rowsB']);
  return {
    ...p,
    rows,
    total: sum(rows),
    charges: sum(rows.filter(r => r.amount > 0)),
    refunds: sum(rows.filter(r => r.amount < 0)),
    missing: rows.filter(r => !Number.isFinite(r.amount)).length
  };
}
