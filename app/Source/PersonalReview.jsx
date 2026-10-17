import { financialReviewSummary } from './reviewQueue.js';
import React, { useState, useEffect } from 'react';
import { MONTHS, reviewDetails, markReconciliation } from './analytics.js';
const value = (v, k) => k === 'amount' ? v == null ? 'Missing' : Number(v).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
}) : Array.isArray(v) ? v.join(' | ') || '(blank)' : String(v ?? '') || '(blank)';
export default function PersonalReview({
  book,
  month,
  reporting,
  onSave,
  onOpen,
  busy,
  domain = 'personal'
}) {
  const info = reviewDetails(book, reporting, domain, month),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [checked, setChecked] = useState(false),
    missing = info.current.some(r => !Number.isFinite(r.amount)),
    locked = busy || working;
  useEffect(() => setChecked(false), [book, month]);
  const summary = financialReviewSummary(book, reporting, domain, month),
    title = domain === 'personal' ? 'Personal' : 'Business';
  const items = info.state === 'Reconciled' ? [] : info.known ? info.changes : info.current.map(row => ({
    row,
    kind: 'Current entry',
    fields: []
  }));
  return <section className="panel personal-review" aria-label={title + ' month review'}><div className="panel-heading"><h2>{MONTHS[month]} {book.year} · {title} financial reconciliation</h2><strong className={info.state === 'Reconciled' ? 'balance-positive' : 'report-incomplete'}>{info.state}</strong></div>
 <p className={info.legacy ? 'notice' : 'hint'}>{summary.reason}</p>{domain === 'business' && <p className="hint">This review covers business income, expenses and transfers. Inspection review is separate; completing one does not complete the other.</p>}
 {(domain === 'personal' ? ['Personal income', 'Housing expenses', 'Transfers'] : ['Business income', 'Business expenses', 'Transfers']).map(area => {
      const list = items.filter(x => x.row.area === area);
      return list.length ? <details key={area} open={info.known && info.changes.length > 0}><summary>{area} · {list.length} {info.known ? 'changed entries' : 'current entries'}</summary>{list.map((x, i) => <article className="personal-review-item" key={x.row.type + x.row.id + i}><div><strong>{x.row.description}</strong><small>{MONTHS[month]} → {area} → {x.row.category}{x.row.subcategory ? ' → ' + x.row.subcategory : ''} · {value(x.row.amount, 'amount')}</small><p>{x.kind}</p>{x.fields.map(f => <p key={f.field}><strong>{f.field}: </strong>{value(f.before, f.field)} → {value(f.after, f.field)}</p>)}{x.removed && <small>This entry is no longer in this month’s recorded totals. It may have been deleted, moved, or changed to planned.</small>}</div>{!x.removed && <button disabled={locked} onClick={() => onOpen(x.row)}>Open {x.row.type === 'transfer' ? 'Transfer' : 'Entry'}</button>}</article>)}</details> : null;
    })}
 {!items.length && info.state !== 'Reconciled' && <p>No recorded entries or applicable transfers in this month.</p>}
 {info.state !== 'Reconciled' && <><label className="check-label"><input type="checkbox" checked={checked} disabled={locked} onChange={e => setChecked(e.target.checked)} />I reviewed this month’s income, {domain === 'personal' ? 'household' : 'business'} expenses and transfers against my records.</label><button disabled={locked || !checked || missing} onClick={async () => {
        setWorking(true);
        setError('');
        try {
          await onSave(markReconciliation(book, reporting, domain, month));
          setChecked(false);
        } catch (e) {
          setError(e.message);
        } finally {
          setWorking(false);
        }
      }}>Mark Month Reconciled</button>{missing && <p className="error">Enter the missing amounts before marking this month reconciled.</p>}<small>Saving this review preserves a comparison snapshot for future changes. It does not change any transactions.</small></>}{error && <p role="alert" className="error">{error}</p>}
 </section>;
}
