import { ledger, inspectionJobs, payoutStatus, MONTHS, jobLabel } from './inspectionIncome.js';
import { localToday } from './inspectionWorkflow.js';
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
export function monthProgress(book, month, waiting = {}) {
  const l = ledger(book),
    period = `${book.year}-${String(month + 1).padStart(2, '0')}`,
    inMonth = d => d?.startsWith(period),
    jobs = inspectionJobs(book).filter(r => (r.ownerYear || book.year) === book.year && r.month === MONTHS[month] || (l.jobs[r.id]?.visits || []).some(v => inMonth(v.date)) || l.events.some(e => e.jobId === r.id && inMonth(e.date))),
    ids = new Set(jobs.map(r => r.id));
  const details = [],
    outcomes = [];
  for (const r of jobs) {
    const j = l.jobs[r.id],
      p = j?.profile,
      visits = (j?.visits || []).filter(v => !v.date || inMonth(v.date)),
      g = [];
    if (j?.entryType === 'travel') {
      const missing = [];
      if (j.travelReview !== 'reviewed') missing.push('travel needs research');
      if (!j.travelPurpose?.trim()) missing.push('purpose');
      if (visits.some(v => !v.date)) missing.push('travel date');
      if (visits.some(v => !v.vehicle)) missing.push('vehicle');
      if (visits.some(v => v.miles == null)) missing.push('mileage');
      if (missing.length) details.push({
        id: r.id,
        label: jobLabel(book, r.id),
        reason: missing.join(', '),
        kind: 'inspection'
      });
      continue;
    }
    if (!p?.customerName?.trim()) g.push('customer details');
    if (!p?.rvMake?.trim() || !p?.rvModel?.trim()) g.push('RV make/model');
    if (!p?.locationType || !p?.city?.trim() || !p?.state || p.locationType === 'dealer' && !p?.dealerName?.trim()) g.push('location');
    if (!j?.visits?.length || visits.some(v => !v.date)) g.push('visit date');
    if (g.length) details.push({
      id: r.id,
      label: jobLabel(book, r.id),
      reason: g.join(', '),
      kind: 'inspection'
    });
    const o = [];
    if (!j) o.push('inspection outcome and payment review');else {
      for (const v of visits) {
        if (['Scheduled', 'Not reviewed'].includes(v.outcome)) o.push('visit outcome');
        if (v.miles == null) o.push('actual mileage');
        if (v.miles > 0 && !v.vehicle) o.push('vehicle');
      }
      const events = l.events.filter(e => e.jobId === r.id);
      if (!events.some(e => e.type === 'payment') && j.paymentState !== 'no_charge') o.push(j.paymentState === 'unpaid' ? 'customer payment not yet received' : 'customer payment review');
      if (events.some(e => inMonth(e.date) && e.date > localToday())) o.push('future transaction date');
    }
    if (o.length) outcomes.push({
      id: r.id,
      label: jobLabel(book, r.id),
      reason: [...new Set(o)].join(', '),
      kind: 'inspection'
    });
  }
  const events = l.events.filter(e => inMonth(e.date)),
    bank = [],
    awaiting = [],
    later = [];
  for (const e of events) {
    const p = l.payouts.find(p => p.items.some(x => x.eventId === e.id)),
      status = p && payoutStatus(book, p);
    if (status?.label === 'Confirmed') {
      if (p.date.slice(0, 7) > period) later.push({
        event: e,
        payout: p
      });
      continue;
    }
    const row = {
      id: e.jobId,
      eventId: e.id,
      label: jobLabel(book, e.jobId),
      reason: `${e.type} · ${e.date} · $${Number(e.amount).toFixed(2)}`,
      kind: 'bank',
      payoutId: p?.id
    };
    if (!p && waiting[e.id]?.note?.trim()) awaiting.push({
      ...row,
      note: waiting[e.id].note
    });else bank.push(row);
  }
  const payouts = l.payouts.filter(p => inMonth(p.date) || p.items.some(x => events.some(e => e.id === x.eventId))),
    issues = payouts.filter(p => payoutStatus(book, p).label !== 'Confirmed').map(p => ({
      id: p.id,
      label: `Bank transaction · ${p.date} · $${Number(p.amount).toFixed(2)}`,
      reason: payoutStatus(book, p).label,
      kind: 'payout',
      red: payoutStatus(book, p).difference !== 0 || payoutStatus(book, p).issues.length > 0
    }));
  const blocking = details.length + outcomes.length + bank.length + issues.length;
  const relevantEvents = l.events.filter(e => ids.has(e.jobId) || payouts.some(p => p.items.some(x => x.eventId === e.id))),
    relevantIds = new Set([...ids, ...relevantEvents.map(e => e.jobId)]);
  const snapshot = JSON.stringify(canonical({
    year: book.year,
    month,
    jobs: [...relevantIds].sort().map(id => [id, l.jobs[id] || null]),
    sources: inspectionJobs(book).filter(r => relevantIds.has(r.id)),
    events: relevantEvents.slice().sort((a, b) => a.id.localeCompare(b.id)),
    payouts: payouts.slice().sort((a, b) => a.id.localeCompare(b.id)),
    retired: l.retired.filter(r => relevantIds.has(r.jobId) || book.records.some(e => e.id === r.recordId && e.month === MONTHS[month])),
    notes: book.notes.filter(n => relevantIds.has(n.recordId)),
    waiting: Object.fromEntries(events.filter(e => waiting[e.id]).map(e => [e.id, waiting[e.id]]))
  }));
  return {
    period,
    jobs,
    details,
    outcomes,
    events,
    bank,
    awaiting,
    later,
    issues,
    blocking,
    snapshot,
    next: details[0] || outcomes[0] || issues[0] || bank[0]
  };
}
export async function progressHash(snapshot) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
