import { ledger, inspectionJobs, settlementEvents, payoutStatus, jobLabel, MONTHS } from './inspectionIncome.js';
import { jobWorkflow } from './inspectionWorkflow.js';
export function monthlyRegister(book, month) {
  const l = ledger(book),
    period = `${book.year}-${String(month + 1).padStart(2, '0')}`,
    inMonth = date => date?.startsWith(period),
    events = settlementEvents(book),
    sources = inspectionJobs(book),
    byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.id.localeCompare(b.id);
  const rows = sources.map(source => {
    const job = l.jobs[source.id],
      visits = (job?.visits || []).slice().sort(byDate),
      payments = events.filter(e => e.jobId === source.id).slice().sort(byDate),
      ids = new Set(payments.map(e => e.id)),
      payouts = l.payouts.filter(p => p.items.some(i => ids.has(i.eventId))).slice().sort(byDate),
      origin = (source.ownerYear || book.year) === book.year && source.month === MONTHS[month],
      reasons = [];
    if (origin) reasons.push('Original entry in ' + MONTHS[month] + ' ' + book.year);
    if (visits.some(v => inMonth(v.date))) reasons.push('Visit this month');
    if (payments.some(e => inMonth(e.date))) reasons.push('Payment / refund this month');
    if (payouts.some(p => inMonth(p.date))) reasons.push('Bank transaction this month');
    const workflow = jobWorkflow(book, source.id),
      travel = job?.entryType === 'travel',
      needsReview = travel ? workflow.gaps.length > 0 : !!(workflow.gaps.length || workflow.paymentReview || workflow.bankReview || payouts.some(p => payoutStatus(book, p).label !== 'Confirmed')),
      periods = [...new Set([...visits, ...payments, ...payouts].filter(x => x.date).map(x => x.date.slice(0, 7)))],
      dates = [...visits, ...payments, ...payouts].map(x => x.date).filter(inMonth).sort();
    return {
      id: source.id,
      source,
      job,
      name: jobLabel(book, source.id),
      visits,
      payments,
      payouts,
      reasons,
      travel,
      needsReview,
      crossMonth: periods.length > 1,
      sortDate: dates[0] || period + '-99',
      workflow
    };
  }).filter(r => r.reasons.length).sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.name.localeCompare(b.name));
  const unresolved = l.payouts.filter(p => inMonth(p.date) && (payoutStatus(book, p).label !== 'Confirmed' || p.items.some(i => !events.some(e => e.id === i.eventId)))).slice().sort(byDate);
  return {
    period,
    rows,
    unresolved,
    bankCount: l.payouts.filter(p => inMonth(p.date)).length
  };
}
