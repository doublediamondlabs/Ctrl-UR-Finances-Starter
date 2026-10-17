import React from 'react';
import { ledger } from './inspectionIncome.js';
import { jobWorkflow, incomeMonth, readableDate, detailGaps } from './inspectionWorkflow.js';
const cash = n => Number(n).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
});
export function WorkflowStatus({
  book,
  id,
  compact = false,
  onMatch
}) {
  const s = jobWorkflow(book, id);
  if (ledger(book).jobs[id]?.entryType === 'travel') return <div className="travel-status"><strong>{s.gaps.length ? 'Needs Research' : 'Travel Reviewed'}</strong><p>{s.gaps.length ? s.gaps.join(' · ') : 'Purpose, date, vehicle and mileage recorded.'}</p></div>;
  return <div className={'inspection-workflow-status ' + (compact ? 'compact' : '')}><span className={s.gaps.length ? 'review' : 'ready'}><strong>Inspection</strong>{s.inspection}</span><span className={s.paymentReview ? 'review' : 'ready'}><strong>Customer payment</strong>{s.payment}</span><span className={s.bankReview ? 'review' : 'neutral'}><strong>Bank connection</strong>{s.bank}{s.bankReview && onMatch && <button type="button" onClick={onMatch}>Match To Bank Deposit</button>}</span>{!compact && <div className="workflow-event-dates">{s.events.map(e => <p key={e.id}><strong>{e.type === 'refund' ? 'Refund' : 'Payment'} {cash(e.amount)}</strong> · {readableDate(e.date)} → {incomeMonth(e.date)} income</p>)}{s.warnings.map((w, i) => <p className={s.paymentReview ? 'workflow-warning' : 'guidance-box'} key={i}>{!s.paymentReview && <strong>Dates Reviewed · </strong>}{w}</p>)}{!!s.gaps.length && <p>Still needed: {s.gaps.join(' · ')}</p>}</div>}</div>;
}
export function WorkflowReview({
  draft
}) {
  if (draft.job.entryType === 'travel') return <section className="workflow-review"><h3>Travel Review</h3><strong>{draft.job.travelDescription} · {draft.job.travelReview === 'reviewed' ? 'Reviewed' : 'Needs Research'}</strong><p>{draft.job.travelPurpose || 'Purpose not known yet'}</p>{draft.job.visits.map(v => <p key={v.id}>{v.date ? readableDate(v.date) : 'Date unknown · original month retained'} · {v.vehicle || 'Vehicle unknown'} · {v.miles ?? 'Unknown'} miles</p>)}<p>No customer payment or bank connection is created. Existing mileage is replaced in totals by this reviewed record, not added twice.</p></section>;
  return <section className="workflow-review"><h3>Inspection review</h3><div className="workflow-review-grid"><div><strong>1 · Inspection & travel</strong>{draft.job.visits?.map(v => <p key={v.id}>{readableDate(v.date)} · {v.outcome} · {v.vehicle || 'Vehicle needed'} · {v.miles ?? 'Unknown'} miles</p>)}{detailGaps(draft.job).length > 0 && <p className="workflow-warning">Saved as incomplete: {detailGaps(draft.job).join(' · ')}</p>}</div><div><strong>2 · Customer payment</strong>{draft.events.length ? draft.events.map(e => <p key={e.id}>{e.type === 'refund' ? 'Refund' : 'Payment'} {cash(e.amount)} · {readableDate(e.date)}<br /><b>{incomeMonth(e.date)} income</b></p>) : <p>{{
            unpaid: 'Not yet received',
            review: 'Details need review',
            no_charge: 'No payment expected'
          }[draft.paymentState]}</p>}</div><div><strong>3 · Bank connection</strong><p>{draft.bankAction === 'now' ? 'Open bank reconciliation after saving' : 'Match later / keep existing connections'}</p><small>Saving this inspection does not create or confirm a deposit.</small></div></div></section>;
}
