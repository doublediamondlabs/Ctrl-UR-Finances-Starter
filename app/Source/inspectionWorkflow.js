import { ledger, payoutStatus, settlementEvents } from './inspectionIncome.js';
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const incomeMonth = date => /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
  month: 'long',
  year: 'numeric'
}) : 'Date needed';
export const readableDate = date => date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
}) : 'Date needed';
export function detailGaps(job) {
  if (!job) return ['Original inspection needs review'];
  if (job.entryType === 'travel') {
    const gaps = [];
    if (job.travelReview !== 'reviewed') gaps.push('Travel needs research');
    if (!job.travelPurpose?.trim()) gaps.push('Travel purpose');
    for (const v of job.visits || []) {
      if (!v.date) gaps.push('Travel date');
      if (!v.vehicle) gaps.push('Vehicle');
      if (v.miles == null) gaps.push('Actual mileage');
    }
    return [...new Set(gaps)];
  }
  const p = job.profile,
    gaps = [];
  if (!p) gaps.push('Structured customer/location details');else {
    if (!p.customerName?.trim()) gaps.push('Customer name');
    if (!p.rvMake?.trim()) gaps.push('RV make');
    if (!p.rvModel?.trim()) gaps.push('RV model');
    if (!p.locationType) gaps.push('Location type');
    if (p.locationType === 'dealer' && !p.dealerName?.trim()) gaps.push('Dealer name');
    if (!p.city?.trim()) gaps.push('City');
    if (!p.state) gaps.push('State');
  }
  if (!job.visits?.length) gaps.push('Visit details');
  for (const v of job.visits || []) {
    if (!v.date) gaps.push('Visit date');
    if (!v.vehicle) gaps.push('Vehicle');
    if (v.miles == null) gaps.push('Actual mileage');
    if (v.outcome === 'Not reviewed') gaps.push('Visit outcome');
  }
  return [...new Set(gaps)];
}
export function dateWarnings(job, events, today = localToday()) {
  const warnings = [];
  for (const e of events) {
    if (!e.date) continue;
    const verb = e.type === 'refund' ? 'Refund' : 'Payment';
    if (e.date > today) warnings.push(`${verb} dated ${readableDate(e.date)} is in the future. Confirm this is an actual transaction, not a planned one.`);
    const visit = job.visits?.find(v => v.id === e.visitId) || job.visits?.[0];
    if (visit?.date && e.date.slice(0, 7) !== visit.date.slice(0, 7)) warnings.push(`${verb} counts toward ${incomeMonth(e.date)} income; the ${e.visitId ? 'linked' : 'initial'} visit is in ${incomeMonth(visit.date)}.`);
  }
  return warnings;
}
export function jobWorkflow(book, id, today = localToday()) {
  const l = ledger(book),
    job = l.jobs[id],
    events = l.events.filter(e => e.jobId === id),
    payments = events.filter(e => e.type === 'payment'),
    gaps = detailGaps(job),
    warnings = dateWarnings(job || {}, events, today);
  const payment = payments.length ? `${payments.length} payment${payments.length === 1 ? '' : 's'} recorded` : job?.paymentState === 'unpaid' ? 'Not yet received' : job?.paymentState === 'no_charge' ? 'No payment expected' : 'Details need review';
  let matched = 0;
  for (const e of events) {
    if (l.payouts.some(p => p.items.some(x => x.eventId === e.id) && payoutStatus(book, p).label === 'Confirmed')) matched++;
  }
  const bank = events.length ? matched === events.length ? 'All events matched' : `${events.length - matched} payment/refund event${events.length - matched === 1 ? '' : 's'} to match` : 'No dated activity to match';
  return {
    gaps,
    warnings,
    events,
    payment,
    bank,
    inspection: gaps.length ? `${gaps.length} detail${gaps.length === 1 ? '' : 's'} to review` : job?.status === 'Scheduled' ? 'Scheduled · details entered' : 'Details entered',
    paymentReview: !payments.length && !['unpaid', 'no_charge'].includes(job?.paymentState) || warnings.length > 0 && !dateReviewConfirmed(job, events),
    bankReview: events.length > matched
  };
}
// Only reviewed dates, amounts and visit associations affect this confirmation.
// Avoid storage IDs: normalizing a linked workbook must not invalidate approval.
export const dateSignature = draft => JSON.stringify({
  visits: (draft.job.visits || []).map(v => v.date || '').sort(),
  events: draft.events.map(e => [e.type, e.date || '', e.amount, (draft.job.visits?.find(v => v.id === e.visitId) || draft.job.visits?.[0])?.date || '']).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
});
export const dateReviewConfirmed = (job, events) => !!job?.dateReview && job.dateReview.signature === dateSignature({
  job,
  events
});
export function validateWorkflow(draft, book, today = localToday()) {
  if (draft.job.entryType === 'travel') {
    if (draft.events.length) throw Error('Mileage-only entries cannot contain payments or refunds.');
    return;
  }
  const payments = draft.events.filter(e => e.type === 'payment');
  if (!['received', 'unpaid', 'review', 'no_charge'].includes(draft.paymentState)) throw Error('Choose a customer payment status in step 2.');
  if (draft.paymentState === 'received' && !payments.length) throw Error('Add the received payment amount and actual date in step 2.');
  if (draft.paymentState !== 'received' && payments.length) throw Error('Existing payments are present. Use Received, or review the events in step 2.');
  if (!['later', 'now'].includes(draft.bankAction)) throw Error('Choose Match later or Match after saving in step 3.');
  if (dateWarnings(draft.job, draft.events, today).length && draft.datesConfirmed !== dateSignature(draft)) throw Error('Review and confirm the payment date warnings in step 2.');
  if (!draft.managed) {
    const r = book.records.find(r => r.id === draft.id) || ledger(book).sources?.find(r => r.id === draft.id);
    if (r?.amount && !draft.events.length && !draft.conversionConfirmed) throw Error('Confirm the removal of the original income from totals in step 2, or enter its dated payment first.');
  }
}

// Include edited settlements and indirect effects of edits to their linked events.
export function affectedPayouts(before, after) {
  const old = ledger(before),
    next = ledger(after),
    beforeEvents = settlementEvents(before),
    afterEvents = settlementEvents(after);
  return next.payouts.filter(p => {
    const previous = old.payouts.find(x => x.id === p.id);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(p)) return true;
    const linked = events => p.items.map(x => events.find(e => e.id === x.eventId) || null);
    return JSON.stringify(linked(beforeEvents)) !== JSON.stringify(linked(afterEvents)) || JSON.stringify(payoutStatus(before, previous)) !== JSON.stringify(payoutStatus(after, p));
  });
}
