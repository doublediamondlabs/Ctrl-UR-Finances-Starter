import { progressHash } from './monthProgress.js';
export const reviewKey = (year, label) => JSON.stringify([year, label]);
export const reviewDate = value => value ? new Date(value).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
}) : '—';
export function groupSnapshot(year, group) {
  return JSON.stringify([year, group.label, group.groups.map(g => [g.key, g.category, g.sub]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), group.rows.map(r => [r.id, r.category, r.subcategory || r.subCategory || '', r.month, r.transactionDate || '', r.description, r.amount, r.notes || []]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
}
export const groupFingerprint = (year, group) => progressHash(groupSnapshot(year, group));
export function groupReview(group, marker, fingerprint) {
  if (group.label === 'Tax Group Not Assigned') return {
    label: 'Assignment Needed',
    canReview: false
  };
  if (group.label === 'Hold For Tax Review') return {
    label: 'Treatment Needs Review',
    canReview: false
  };
  if (group.rows.some(r => !Number.isFinite(r.amount))) return {
    label: 'Missing Amounts',
    canReview: false
  };
  if (!fingerprint) return {
    label: 'Loading Review Status',
    canReview: false
  };
  if (marker?.fingerprint === fingerprint) return {
    label: 'Grouping Reviewed',
    canReview: true,
    reviewed: true
  };
  return {
    label: marker ? 'Changed Since Review' : 'Grouping Needs Review',
    canReview: true
  };
}
export function summaryRows(year, groups, markers, hashes) {
  return [['Expense Group Summary', year], ['Recorded amounts — not calculated deductions. Grouping review is separate from bank reconciliation.'], ['Tax Group', 'Recorded Annual Total', 'Review Status', 'Last Grouping Review'], ...groups.map(g => [g.label, g.total, groupReview(g, markers?.[reviewKey(year, g.label)], hashes[g.label]).label, reviewDate(markers?.[reviewKey(year, g.label)]?.reviewedAt)])];
}
