import { monthLabel, dateLabel } from './loanDates.js';
import React, { useState } from 'react';
import { allocated } from './forwarding.js';
const cash = n => Number(n).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
});
const when = r => r.date ? dateLabel(r.date) : monthLabel(r.month) + ' · day unknown';
function useRows() {
  const [open, setOpen] = useState([]);
  return [open, id => setOpen(xs => xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id])];
}
export function ReceiptLedger({
  rows,
  history,
  loan,
  blocked,
  asOf
}) {
  const [open, toggle] = useRows();
  return <div className="forwarding-table-wrap"><table className="forwarding-ledger"><thead><tr><th>Received on</th><th>Received</th><th>Assigned to forwarding</th><th>Unassigned</th><th>Sent on / connection</th><th>Details</th></tr></thead><tbody>{rows.map(r => {
          const used = allocated(loan, r.id),
            left = Math.round((r.amount - used) * 100) / 100,
            links = history.filter(h => (h.allocations || []).some(a => a.receiptId === r.id));
          return <React.Fragment key={r.id}><tr><td>{when(r)}</td><td>{cash(r.amount)}</td><td>{cash(used)}</td><td><span className={'forwarding-pill ' + (blocked ? 'pending' : left === 0 ? 'complete' : 'pending')}>{blocked ? 'Needs review' : cash(left)}</span></td><td>{links.length ? links.map(h => <span className="forwarding-connection" key={h.id}>{dateLabel(h.date)} · {cash(h.allocations.find(a => a.receiptId === r.id).amount)}{h.date > asOf ? ' · after overview date' : ''}</span>) : 'Not yet forwarded'}</td><td><button aria-expanded={open.includes(r.id)} onClick={() => toggle(r.id)}>{open.includes(r.id) ? "Hide" : "Show"}</button></td></tr>{open.includes(r.id) && <tr className="forwarding-detail-row"><td colSpan={6}><strong>Receipt note</strong><p>{r.note || 'No private receipt note.'}</p>{links.map(h => <p key={h.id}><strong>Sent {dateLabel(h.date)}:</strong> {cash(h.allocations.find(a => a.receiptId === r.id).amount)}{h.reference ? ' · ' + h.reference : ''}{h.note ? ' · ' + h.note : ''}</p>)}</td></tr>}</React.Fragment>;
        })}</tbody></table></div>;
}
export function SentLedger({
  history,
  loan,
  asOf,
  working,
  onEdit,
  onRemove
}) {
  const [open, toggle] = useRows();
  return <div className="forwarding-table-wrap"><table className="forwarding-ledger"><thead><tr><th>Sent on</th><th>Sent amount</th><th>Included receipts</th><th>Reference</th><th>Details</th></tr></thead><tbody>{history.map(h => <React.Fragment key={h.id}><tr><td>{dateLabel(h.date)}{h.date > asOf && <small>After overview date</small>}</td><td>{cash(h.amount)}</td><td>{h.allocations?.length ? `${h.allocations.length} receipts · ` : 'Unassigned · '}{h.allocations?.length ? [...new Set(h.allocations.map(a => loan.receipts.find(r => r.id === a.receiptId)?.month))].filter(Boolean).sort().map(monthLabel).join(', ') : 'Review needed'}</td><td>{h.reference || '—'}</td><td><button aria-expanded={open.includes(h.id)} onClick={() => toggle(h.id)}>{open.includes(h.id) ? "Hide" : "Show"}</button></td></tr>{open.includes(h.id) && <tr className="forwarding-detail-row"><td colSpan={5}><p>{h.note || 'No private forwarding note.'}</p>{!h.allocations && <p>Earlier record — receipts not assigned yet. Its amount remains included in totals.</p>}<div className="forwarding-allocation-list">{(h.allocations || []).map(a => {
                  const r = loan.receipts.find(r => r.id === a.receiptId);
                  return <p key={a.receiptId}><strong>{r ? when(r) : 'Receipt unavailable'}</strong> · {cash(a.amount)} of {cash(r?.amount || 0)}{r?.note ? ' · ' + r.note : ''}</p>;
                })}</div><button disabled={working} onClick={() => onEdit(h)}>Edit Forwarding</button> <button disabled={working} onClick={() => onRemove(h)}>Remove Forwarding</button></td></tr>}</React.Fragment>)}</tbody></table></div>;
}
