import React, { useState } from 'react';
import { monthlyRegister } from './monthlyRegister.js';
import { MONTHS, payoutStatus } from './inspectionIncome.js';
import { readableDate } from './inspectionWorkflow.js';
const cash = n => Number(n || 0).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
});
const periodName = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
  month: 'short',
  year: 'numeric'
}) : 'Date Unknown';
const uniquePeriods = items => [...new Set(items.filter(x => x.date).map(x => periodName(x.date)))].join(', ');
export default function MonthlyInspectionRegister({
  book,
  month,
  onOpen,
  busy
}) {
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    data = monthlyRegister(book, month),
    needle = query.trim().toLowerCase().replace(/[$,]/g, '');
  const rows = data.rows.filter(r => (filter !== 'review' || r.needsReview) && (filter !== 'cross' || r.crossMonth) && (!needle || [r.name, r.source.description, r.job?.reason, ...r.payments.flatMap(e => [e.amount, Number(e.amount).toFixed(2), e.reference, e.note]), ...r.payouts.flatMap(p => [p.amount, Number(p.amount).toFixed(2), p.reference, p.note])].join(' ').toLowerCase().replace(/[$,]/g, '').includes(needle))),
    unresolved = data.unresolved.filter(p => !needle || [p.amount, Number(p.amount).toFixed(2), p.reference, p.note, p.date].join(' ').toLowerCase().replace(/[$,]/g, '').includes(needle));
  const first = items => [...items.filter(x => x.date?.startsWith(data.period)), ...items.filter(x => !x.date?.startsWith(data.period))].slice(0, 2);
  return <section className="panel monthly-inspection-register"><div className="register-heading"><div><h2>{MONTHS[month]} {book.year} · Monthly Inspection Register</h2><p>What’s already recorded · {data.rows.length} inspection / travel records · {data.unresolved.length} bank transactions to review</p></div><button disabled={busy} onClick={() => onOpen({
        kind: 'bank_list'
      })}>Review Bank Records</button></div>
 <div className="register-tools"><label>Find Customer, RV Or Amount<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, RV or 1499" /></label><label>Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All Related Records</option><option value="review">Needs Review</option><option value="cross">Cross-Month Activity</option></select></label></div>
 <div className="register-column-head" aria-hidden="true"><span>Inspection / Travel</span><span>Visit Date & Status</span><span>Customer Payments / Refunds</span><span>Connected Bank Transactions</span></div>
 <div className="register-rows">{rows.map(r => <details className="register-row" key={r.id}><summary><div><strong>{r.name}</strong><small className={r.needsReview ? 'register-amber' : 'register-green'}>{r.needsReview ? 'Needs Review' : 'Recorded Details Ready'}</small>{r.crossMonth && <small className="register-cross">Cross-Month Activity</small>}</div><div><span className="register-mobile-label">Visit</span>{first(r.visits).map(v => <p key={v.id}>{v.date ? readableDate(v.date) : 'Date Not Recorded'}<small>{r.travel ? r.job.travelReview === 'reviewed' ? 'Travel Reviewed' : 'Needs Research' : v.outcome} · {v.miles ?? 'Unknown'} mi · {v.vehicle || 'Vehicle Unknown'}</small></p>)}{!r.visits.length && <p>Visit Details Not Reviewed<small>{r.source.miles ?? 'Unknown'} original miles</small></p>}{r.visits.length > 2 && <small>+{r.visits.length - 2} more visits</small>}</div><div><span className="register-mobile-label">Customer Payments / Refunds</span>{first(r.payments).map(e => <p key={e.id}><b>{e.type === 'refund' ? '−' : '+'}{cash(e.amount)}</b><small>{e.legacy ? 'Original Amount · Payment Date Not Reviewed' : readableDate(e.date) + ' · ' + (e.type === 'refund' ? 'Refund' : 'Payment')}</small></p>)}{!r.payments.length && <p>{r.travel || r.job?.paymentState === 'no_charge' ? 'No Payment Expected' : r.job?.paymentState === 'unpaid' ? 'Payment Not Yet Received' : 'Payment Details Not Recorded'}</p>}{r.payments.length > 2 && <small>+{r.payments.length - 2} more events</small>}</div><div><span className="register-mobile-label">Bank Transactions</span>{first(r.payouts).map(p => <p key={p.id}><b>{cash(p.amount)}</b><small>{readableDate(p.date)} · {payoutStatus(book, p).label}</small>{p.items.length > 1 && <small>Shared transaction · whole bank amount</small>}</p>)}{!r.payouts.length && <p>{r.travel || !r.payments.length && r.job?.paymentState === 'no_charge' ? 'Not Required' : 'No Bank Connection Recorded'}</p>}{r.payouts.length > 2 && <small>+{r.payouts.length - 2} more connections</small>}<small className="register-expand">Details & Actions</small></div></summary>
 <div className="register-detail"><p><strong>Why This Appears:</strong> {r.reasons.join(' · ')}</p>{r.crossMonth && <p className="register-cross">{r.visits.some(v => v.date) && 'Visit: ' + uniquePeriods(r.visits) + ' · '}{r.payments.some(e => e.date) && 'Payment / Refund: ' + uniquePeriods(r.payments) + ' · '}{r.payouts.length > 0 && 'Bank: ' + uniquePeriods(r.payouts)}</p>}<div className="register-history"><section><h3>Visits</h3>{r.visits.map(v => <p key={v.id}>{v.date ? readableDate(v.date) : 'Date Unknown'} · {v.purpose} · {v.outcome} · {v.miles ?? 'Unknown'} mi · {v.vehicle || 'Vehicle Unknown'}{v.note ? ' · ' + v.note : ''}</p>)}</section><section><h3>Customer Payments & Refunds</h3>{r.payments.map(e => <p key={e.id}>{e.date ? readableDate(e.date) : 'Original Month: ' + r.source.month + ' ' + (r.source.ownerYear || book.year)} · {e.type} · {cash(e.amount)}{e.reference ? ' · ' + e.reference : ''}{e.note ? ' · ' + e.note : ''}</p>)}</section><section><h3>Bank Connections</h3>{r.payouts.map(p => <p key={p.id}>{readableDate(p.date)} · {cash(p.amount)} · {payoutStatus(book, p).label}{p.reference ? ' · ' + p.reference : ''} <button disabled={busy} onClick={() => onOpen({
                  kind: 'payout',
                  id: p.id
                })}>Review Deposit</button></p>)}</section></div>{r.job?.reason && <p>{r.job.reason}</p>}<button disabled={busy} onClick={() => onOpen({
            kind: 'inspection',
            id: r.id
          })}>{r.travel ? 'Review Travel' : 'Review Inspection & Payments'}</button></div></details>)}</div>
 {!rows.length && <p className="small-empty">{query || filter !== 'all' ? 'No inspection or travel records match these filters.' : 'No inspection or travel records are connected to this month yet.'}</p>}
 <section className="register-unresolved"><p className="register-bank-note">Only entered bank transactions appear here. A deposit still on your statement only must be entered through Review Bank Records.</p><h3>Unresolved Bank Transactions · {MONTHS[month]} {book.year}</h3>{unresolved.map(p => {
        const s = payoutStatus(book, p);
        return <article key={p.id}><div><strong>{readableDate(p.date)} · {cash(p.amount)}</strong><small>{!p.items.length ? 'No Customer Transactions Connected' : s.label + ' · ' + p.items.length + ' selected transactions'}{s.difference !== 0 ? ' · Difference ' + cash(s.difference) : ''}</small>{p.reference && <p>{p.reference}</p>}{p.note && <p>{p.note}</p>}</div><button disabled={busy} onClick={() => onOpen({
            kind: 'payout',
            id: p.id
          })}>Review Deposit</button></article>;
      })}{!unresolved.length && <p>{needle ? 'No unresolved bank transactions match this search.' : data.bankCount ? 'No entered bank transactions need review.' : 'No bank transactions have been entered for this month.'}</p>}</section>
 <details className="register-guidance"><summary>What This Register Includes</summary><p>Records appear here when their original entry month, visit date, customer payment/refund date or connected bank date falls in this month. Related dates from other months remain visible. Shared bank amounts are shown for traceability; do not add the rows to calculate income.</p><p>This shows application records only. A statement deposit not yet entered will not appear here. Use Review Bank Records to enter it without assigning a customer until you identify the transaction. Amount alone does not establish a match. No records are changed by viewing or searching this register.</p></details></section>;
}
