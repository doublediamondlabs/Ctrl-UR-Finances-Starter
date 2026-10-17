import React, { useState, useEffect } from 'react';
import { MONTHS, jobLabel, ledger } from './inspectionIncome.js';
import { readableDate } from './inspectionWorkflow.js';
const money = n => Number(n || 0).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
});
export function sortIncomeRows(rows, preference = {}) {
  const mode = preference.mode || 'asc',
    order = preference.order || [];
  return [...rows].sort((a, b) => {
    if (mode === 'custom') {
      const ai = order.indexOf(a.id),
        bi = order.indexOf(b.id);
      if (ai !== bi && (ai >= 0 || bi >= 0)) return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
    }
    if (!!a.transactionDate !== !!b.transactionDate) return a.transactionDate ? -1 : 1;
    const cmp = (a.transactionDate || String(MONTHS.indexOf(a.month)).padStart(2, '0')).localeCompare(b.transactionDate || String(MONTHS.indexOf(b.month)).padStart(2, '0'));
    return (mode === 'desc' ? -cmp : cmp) || a.id.localeCompare(b.id);
  });
}
export default function IncomeList({
  book,
  rows,
  preference = {},
  onSavePreference,
  onEdit,
  onDirty,
  busy
}) {
  const [order, setOrder] = useState(null),
    [drag, setDrag] = useState(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState('');
  const arranged = !!order,
    locked = busy || working,
    sorted = sortIncomeRows(rows, preference),
    display = order ? order.map(id => rows.find(r => r.id === id)).filter(Boolean) : sorted;
  useEffect(() => {
    onDirty(arranged || working);
    return () => onDirty(false);
  }, [arranged, working]);
  function move(id, target) {
    if (id === target) return;
    setOrder(ids => {
      const next = ids.filter(x => x !== id);
      next.splice(next.indexOf(target), 0, id);
      return next;
    });
  }
  async function save(next) {
    setWorking(true);
    setError('');
    try {
      await onSavePreference(next);
      setOrder(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  return <section className="income-ledger"><div className="income-list-toolbar"><span>{rows.length} entr{rows.length === 1 ? 'y' : 'ies'} · Select A Customer To Review</span><div><label>Order<select disabled={arranged || locked} value={preference.mode || 'asc'} onChange={e => save({
            ...preference,
            mode: e.target.value
          })}><option value="asc">Date · Oldest First</option><option value="desc">Date · Newest First</option>{preference.order?.length > 0 && <option value="custom">Custom Order</option>}</select></label>{!arranged ? <button disabled={locked || rows.length < 2} onClick={() => setOrder(sorted.map(r => r.id))}>Reorder Entries</button> : <><button className="primary" disabled={locked} onClick={() => save({
            mode: 'custom',
            order
          })}>Save Order</button><button disabled={locked} onClick={() => setOrder(null)}>Cancel</button></>}</div></div>{arranged && <p className="income-order-hint">Drag rows or use the arrow buttons, then Save Order. This changes display order only.</p>}{error && <p role="alert" className="error">{error}</p>}<div className="income-ledger-rows">{display.map((r, i) => {
        const name = jobLabel(book, r.sourceJobId || r.id),
          profile = ledger(book).jobs[r.sourceJobId || r.id]?.profile,
          refund = r.amount < 0;
        return <details open={arranged ? true : undefined} className={'income-ledger-row ' + (refund ? 'refund' : 'payment')} key={r.id} draggable={arranged && !locked} onDragStart={e => {
          setDrag(r.id);
          e.dataTransfer.setData('text/plain', r.id);
        }} onDragOver={e => {
          if (arranged && !locked) e.preventDefault();
        }} onDrop={e => {
          e.preventDefault();
          if (arranged && !locked && order.includes(drag)) move(drag, r.id);
          setDrag(null);
        }} onDragEnd={() => setDrag(null)}><summary><div className="income-date"><strong>{r.transactionDate ? readableDate(r.transactionDate) : r.month + ' ' + book.year}</strong>{!r.transactionDate && <small>Payment Date Not Reviewed</small>}</div><div className="income-customer-label"><strong>{profile?.customerName || name}</strong>{profile && <small>{name.startsWith(profile.customerName) ? name.slice(profile.customerName.length).replace(/^\s*·\s*/, '') : name}</small>}</div><span className={'income-type ' + (refund ? 'refund' : 'payment')}>{r.sourceJobId ? refund ? 'Refund' : 'Customer Payment' : 'Original Entry'}</span><strong className="income-row-amount">{refund ? '−' : '+'}{money(Math.abs(r.amount || 0))}</strong><span className="bank-detail-toggle"><span className="when-closed">View Details</span><span className="when-open">Hide Details</span></span></summary>{arranged && <div className="income-order-buttons"><button disabled={locked || i === 0} aria-label={'Move Up ' + name} onClick={() => move(r.id, order[i - 1])}>↑</button><button disabled={locked || i === display.length - 1} aria-label={'Move Down ' + name} onClick={() => {
              const next = [...order];
              [next[i], next[i + 1]] = [next[i + 1], next[i]];
              setOrder(next);
            }}>↓</button></div>}<div className="income-entry-details"><div className="bank-support-grid"><section><h3>Customer Payment Record</h3><p>{r.transactionDate ? readableDate(r.transactionDate) : r.month + ' ' + book.year + ' · Payment Date Not Reviewed'} · {refund ? 'Refund' : 'Payment'} · {money(r.amount)}</p>{(() => {
                  const event = ledger(book).events.find(e => 'event:' + e.id === r.id);
                  return event ? <>{event.type === 'payment' && event.paidBy && <p><strong>Paid By:</strong> {event.paidBy}</p>}<p>{event.method || 'Payment method not recorded'}</p><p>{event.reference || 'No transaction reference added'}</p>{event.note && <p>{event.note}</p>}</> : <p>Original workbook entry. Review it to record actual payment details.</p>;
                })()}</section><section><h3>Income Month</h3><p>{r.month || ''} {book.year}</p><p>Bank matching connects this entry to its deposit without adding income again.</p></section></div><div className="bank-settlement-actions"><button disabled={arranged || locked} onClick={() => onEdit(r.sourceJobId || r.id)}>Review Inspection & Payments</button></div></div></details>;
      })}{!rows.length && <p className="small-empty">No income or refunds recorded for this period.</p>}</div></section>;
}
