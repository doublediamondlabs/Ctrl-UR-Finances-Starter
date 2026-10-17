import { reviewDetails, MONTHS } from './analytics.js';
export function periodStage(year, month, today = new Date()) {
  const n = year * 12 + month,
    t = today.getFullYear() * 12 + today.getMonth();
  return n > t ? 'future' : n === t ? 'current' : 'past';
}
export function financialReviewSummary(book, reporting, domain, month, today = new Date()) {
  const info = reviewDetails(book, reporting, domain, month),
    stage = periodStage(book.year, month, today),
    missing = info.current.filter(r => !Number.isFinite(r.amount)).length;
  let reason = info.state === 'Reconciled' ? 'No changes detected since financial reconciliation.' : info.legacy ? 'Changed since financial review. The older review did not retain entry details, so exact changes are unavailable.' : info.known ? `${info.changes.length} ${info.changes.length === 1 ? 'entry changed' : 'entries changed'} since financial review.` : info.current.length ? `${info.current.length} recorded ${info.current.length === 1 ? 'entry' : 'entries'}; financial reconciliation has not been recorded.` : 'No recorded entries; this month has not been reconciled.';
  if (missing) reason += ` ${missing} missing ${missing === 1 ? 'amount' : 'amounts'} to resolve.`;
  const samples = info.state !== 'Reconciled' && info.known ? info.changes.slice(0, 2).map(x => `${x.row.area} → ${x.row.category}: ${x.row.description || 'Unnamed entry'} (${x.kind}${x.fields.length ? ': ' + x.fields.map(f => f.field).join(', ') : ''})`) : [];
  const needs = info.state !== 'Reconciled' && stage !== 'future' && (info.current.length > 0 || info.state === 'Changed since review');
  return {
    month,
    label: MONTHS[month],
    kind: 'financial',
    domain,
    state: info.state,
    reason,
    samples,
    needs,
    stage,
    rank: info.state === 'Changed since review' ? 0 : 1,
    reviewedAt: info.reviewedAt
  };
}
export function inspectionReviewSummary(book, reporting, month, p, hash, today = new Date()) {
  const saved = reporting.inspectionProgress?.[p.period] || {},
    stage = periodStage(book.year, month, today),
    checked = typeof hash === 'string',
    reviewed = checked && !!saved.reviewedAt && saved.fingerprint === hash,
    changed = checked && !!saved.reviewedAt && !reviewed;
  let state = !checked ? 'Checking review status…' : p.blocking ? 'Needs attention' : p.awaiting.length ? reviewed ? 'Reviewed · awaiting deposit' : 'Awaiting deposit' : reviewed ? 'Reviewed' : changed ? 'Changed since review' : 'Not yet reviewed';
  let reason = !checked ? 'Checking saved inspection review.' : p.next ? `Next: ${p.next.label} — ${p.next.reason}` : p.awaiting.length ? `${p.awaiting.length} ${p.awaiting.length === 1 ? 'payment awaits' : 'payments await'} a later deposit; recorded waiting notes remain available.` : reviewed ? 'No changes detected since inspection review.' : changed ? 'Inspection records changed since review. Compare the current records; exact earlier field changes were not stored.' : p.jobs.length || p.events.length || p.issues.length ? 'Entered inspection records are ready for review against source documents.' : 'No inspection records in this month; it has not been marked reviewed.';
  if (changed && p.next) reason = 'Changed since inspection review. ' + reason;
  return {
    month,
    label: MONTHS[month],
    kind: 'inspection',
    domain: 'business',
    state,
    reason,
    samples: [],
    stage,
    needs: checked && stage !== 'future' && !!(p.blocking || p.awaiting.length || changed || !reviewed && (p.jobs.length || p.events.length || p.issues.length)),
    rank: changed ? 0 : p.blocking ? 1 : p.awaiting.length ? 2 : 3,
    reviewedAt: saved.reviewedAt
  };
}
