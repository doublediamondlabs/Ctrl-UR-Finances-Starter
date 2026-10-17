import { detailGaps } from './inspectionWorkflow.js';
import { ledger, travelRecords, inspectionJobs, jobLabel, MONTHS } from './inspectionIncome.js';
import { entries, sum } from './analytics.js';
export const TAX_GROUPS = ['Tax Group Not Assigned', 'Advertising', 'Car & Truck Expenses', 'Commissions & Fees', 'Contract Labor', 'Depletion', 'Depreciation & Section 179', 'Employee Benefit Programs', 'Insurance (Other Than Health)', 'Mortgage Interest (Business Property)', 'Other Interest', 'Legal & Professional Services', 'Office Expense', 'Pension & Profit-Sharing Plans', 'Rent / Lease — Vehicles & Equipment', 'Rent / Lease — Other Business Property', 'Repairs & Maintenance', 'Supplies', 'Taxes & Licenses', 'Travel', 'Meals', 'Utilities', 'Wages', 'Other Expenses', 'Business Use Of Home', 'Hold For Tax Review', 'Personal / Exclude'];
export const taxLabel = value => !value || value === 'Unassigned / Needs Review' ? TAX_GROUPS[0] : value;
export function taxRollups(groups) {
  const map = new Map();
  for (const g of groups) {
    const label = taxLabel(g.label);
    if (!map.has(label)) map.set(label, {
      label,
      groups: [],
      rows: []
    });
    const target = map.get(label);
    target.groups.push(g);
    target.rows.push(...g.rows);
  }
  return [...map.values()].sort((a, b) => a.label === TAX_GROUPS[0] ? -1 : b.label === TAX_GROUPS[0] ? 1 : a.label.localeCompare(b.label)).map(g => ({
    ...g,
    total: sum(g.rows)
  }));
}
// Legacy defaults remain unchanged; all new assignments are scoped to a year.
export const taxCategoryKey = (year, category, sub = '') => JSON.stringify([Number(year), category || '', sub || '']);
export function taxCategoryLabel(settings, year, category, sub = '') {
  return taxLabel(settings.taxGroups?.[taxCategoryKey(year, category, sub)] ?? settings.taxGroups?.[JSON.stringify([category || '', sub || ''])]);
}
export function assignTaxCategory(settings, groups, category, label, year) {
  if (!Number.isInteger(year)) throw Error('Choose a tax year before assigning categories.');
  const next = {
    ...settings.taxGroups
  };
  for (const g of groups.filter(g => g.category === category)) next[taxCategoryKey(year, g.category, g.sub)] = label;
  return {
    ...settings,
    taxGroups: next
  };
}
export const expenseKey = r => JSON.stringify([r.category || '', r.subCategory || '']);
export function activityData(book, start = 0, end = 11, groups = {}) {
  const l = ledger(book),
    within = d => d && Number(d.slice(0, 4)) === book.year && Number(d.slice(5, 7)) - 1 >= start && Number(d.slice(5, 7)) - 1 <= end;
  const trips = travelRecords(book).filter(r => MONTHS.indexOf(r.month) >= start && MONTHS.indexOf(r.month) <= end).map(r => {
    const v = l.jobs[r.id]?.visits?.find(v => v.id === r.visitId);
    return {
      ...r,
      label: jobLabel(book, r.id),
      purpose: v?.purpose || 'Original Workbook Entry',
      note: v?.note || '',
      vehicle: r.vehicle || 'Unassigned',
      needsReview: !r.inspectionDate || !r.vehicle || !Number.isFinite(r.miles) || !v && r.miles !== 0,
      location: l.jobs[r.id]?.profile ? [l.jobs[r.id].profile.dealerName, l.jobs[r.id].profile.city, l.jobs[r.id].profile.state].filter(Boolean).join(', ') : r.location || ''
    };
  }).sort((a, b) => (a.inspectionDate || '9999').localeCompare(b.inspectionDate || '9999'));
  const jobs = inspectionJobs(book).filter(r => {
    const j = l.jobs[r.id];
    if (j?.entryType === 'travel') return false;
    if (!j) return (r.ownerYear || book.year) === book.year && MONTHS.indexOf(r.month) >= start && MONTHS.indexOf(r.month) <= end;
    return j.visits?.some(v => within(v.date));
  }).map(r => {
    const j = l.jobs[r.id],
      visits = (j?.visits || []).filter(v => within(v.date)),
      p = j?.profile || {},
      make = p.rvMake?.trim() || 'Unspecified',
      model = p.rvModel?.trim() || 'Unspecified';
    return {
      ...r,
      label: jobLabel(book, r.id),
      needsDetailReview: detailGaps(j).length > 0,
      customer: p.customerName?.trim() || jobLabel(book, r.id),
      activityDate: visits.map(v => v.date).filter(Boolean).sort()[0] || '',
      make,
      model,
      makeGroup: groups[make] || make,
      status: visits.some(v => v.outcome === 'Completed' && v.purpose !== 'Repair verification') ? 'Completed' : visits.some(v => v.outcome === 'Partially completed') ? 'Partially completed' : visits.at(-1)?.outcome || 'Not reviewed',
      visits: visits.length,
      legacy: !j
    };
  });
  const undated = Object.entries(l.jobs).filter(([id, j]) => (j.ownerYear || book.year) === book.year && (j.visits || []).some(v => !v.date)).map(([id]) => jobLabel(book, id));
  const vehicles = ['Truck', 'Van', 'Other', 'Unassigned'].map(vehicle => {
    const rows = trips.filter(r => r.vehicle === vehicle);
    return {
      vehicle,
      rows,
      miles: rows.reduce((n, r) => n + (Number.isFinite(r.miles) ? r.miles : 0), 0),
      missing: rows.filter(r => r.needsReview).length
    };
  });
  const rv = [];
  for (const j of jobs) {
    let g = rv.find(g => g.make.toLowerCase() === j.makeGroup.toLowerCase() && g.model.toLowerCase() === j.model.toLowerCase());
    if (!g) {
      g = {
        make: j.makeGroup,
        model: j.model,
        count: 0
      };
      rv.push(g);
    }
    g.count++;
  }
  return {
    trips,
    jobs,
    vehicles,
    rv: rv.sort((a, b) => b.count - a.count || a.make.localeCompare(b.make)),
    undated
  };
}
export const taxEntryKey = (year, id) => JSON.stringify([Number(year), id]);
export function assignTaxEntry(settings, year, id, label) {
  const next = {
      ...settings.taxOverrides
    },
    key = taxEntryKey(year, id);
  if (label) next[key] = label;else delete next[key];
  return {
    ...settings,
    taxOverrides: next
  };
}
export function taxData(book, settings = {}) {
  const rows = entries(book, settings, 'business'),
    expenses = rows.filter(r => r.flow === 'expense').map(r => {
      const defaultTaxGroup = taxCategoryLabel(settings, book.year, r.category, r.subcategory),
        taxOverride = settings.taxOverrides?.[taxEntryKey(book.year, r.id)] || '';
      return {
        ...r,
        defaultTaxGroup,
        taxOverride,
        taxGroup: taxOverride ? taxLabel(taxOverride) : defaultTaxGroup
      };
    }),
    income = rows.filter(r => r.flow === 'income');
  const groups = [];
  for (const r of expenses) {
    const key = expenseKey(r),
      label = r.taxGroup;
    let g = groups.find(g => g.key === key && g.label === label);
    if (!g) {
      g = {
        key,
        category: r.category,
        sub: r.subcategory,
        label,
        rows: []
      };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return {
    expenses,
    income,
    groups: groups.sort((a, b) => a.category.localeCompare(b.category)),
    receipts: sum(income.filter(r => r.amount > 0)),
    refunds: -sum(income.filter(r => r.amount < 0)),
    spending: sum(expenses),
    housing: entries(book, settings, 'personal').filter(r => r.flow === 'expense'),
    missing: expenses.filter(r => !Number.isFinite(r.amount)),
    missingIncome: income.filter(r => !Number.isFinite(r.amount))
  };
}
export function csv(rows) {
  return '\uFEFF' + rows.map(row => row.map(v => {
    let s = String(v ?? '');
    if (typeof v !== 'number' && /^\s*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}
export function downloadCSV(name, rows) {
  const url = URL.createObjectURL(new Blob([csv(rows)], {
      type: 'text/csv;charset=utf-8'
    })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function manufacturerGroups(jobs) {
  const groups = new Map();
  for (const j of jobs) {
    const key = j.makeGroup.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, {
      key,
      label: j.makeGroup,
      rows: []
    });
    groups.get(key).rows.push(j);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)).map(g => ({
    ...g,
    rows: g.rows.sort((a, b) => a.customer.localeCompare(b.customer) || a.model.localeCompare(b.model) || a.id.localeCompare(b.id))
  }));
}
export function reportInspectionMonth(row) {
  return row.activityDate ? Number(row.activityDate.slice(5, 7)) - 1 : Math.max(0, MONTHS.indexOf(row.month));
}
