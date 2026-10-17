import React, { useState } from 'react';
export default function TaxAttention({
  book,
  tax,
  unreviewed,
  all,
  loanRows,
  debtErrors,
  onAssign,
  onHold,
  onSupport,
  onMileage,
  onEditEntry,
  onReviewMonth
}) {
  const [list, setList] = useState('');
  const unmapped = new Set(tax.groups.filter(g => g.label === 'Tax Group Not Assigned').map(g => g.category)).size,
    held = tax.expenses.filter(r => r.taxGroup === 'Hold For Tax Review').length;
  const rows = list === 'income' ? tax.missingIncome : list === 'expenses' ? tax.missing : [],
    mileage = all.trips.filter(t => t.needsReview).length + all.undated.length,
    loans = loanRows.filter(p => p.issue || !p.complete).length;
  const items = [[tax.missingIncome.length, 'Income amounts missing', () => setList('income')], [tax.missing.length, 'Expense amounts missing', () => setList('expenses')], [unmapped, 'Categories unassigned', onAssign], [held, 'Entries held for tax review', onHold], [unreviewed.length, 'Months to reconcile', () => setList('months')], [mileage, 'Mileage / dated-visit issues', onMileage], [loans + debtErrors.length, 'Loan breakdown / loading issues', onSupport]];
  return <section className="tax-attention"><h3>Needs Attention · {book.year}</h3><div className="tax-attention-actions">{items.filter(([n]) => n > 0).map(([n, label, action]) => <button key={label} onClick={action}><strong>{n}</strong> {label}</button>)}</div>{items.every(([n]) => n === 0) && <p className="hint">No issues in these checks. Review expense-group statuses and supporting information before preparing your return.</p>}<p className="hint">Future months are excluded from the reconciliation count. Current-month review can wait until the month is complete. These checks do not confirm deductibility or receipt support.</p>{list && <div className="report-detail"><div className="section-title"><h4>{list === 'months' ? 'Months to reconcile' : list === 'income' ? 'Income amounts missing' : 'Expense amounts missing'}</h4><button onClick={() => setList('')}>Close List</button></div>{list === 'months' ? unreviewed.map(m => <button key={m} disabled={!onReviewMonth} onClick={() => onReviewMonth(m)}>{m} {book.year} · Open Financial Review</button>) : rows.map(r => <article key={r.id}><strong>{r.description || r.category}</strong><p>{r.month} {book.year} · {r.category} · Missing amount</p><button disabled={!onEditEntry} onClick={() => onEditEntry(book.year, r.id)}>Open Entry</button></article>)}{list !== 'months' && !rows.length && <p>No missing amounts.</p>}</div>}</section>;
}
