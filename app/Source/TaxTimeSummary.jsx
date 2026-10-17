import React, { useEffect, useState } from 'react';
import { downloadCSV } from './businessReports.js';
import { groupSnapshot, groupFingerprint, groupReview, reviewKey, reviewDate, summaryRows } from './taxSummary.js';
const money = n => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(n);
export default function TaxTimeSummary({
  year,
  groups,
  reporting,
  onSaveReporting,
  onSelect,
  onAssign
}) {
  const [computed, setComputed] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const snapshot = JSON.stringify(groups.map(g => groupSnapshot(year, g)));
  const hashes = computed.snapshot === snapshot ? computed.hashes : {};
  useEffect(() => {
    let active = true;
    Promise.all(groups.map(async g => [g.label, await groupFingerprint(year, g)])).then(pairs => {
      if (active) setComputed({
        snapshot,
        hashes: Object.fromEntries(pairs)
      });
    }).catch(e => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [snapshot]);
  const ready = computed.snapshot === snapshot,
    unassigned = groups.find(g => g.label === 'Tax Group Not Assigned'),
    count = new Set((unassigned?.groups || []).map(g => g.category)).size;
  async function mark(g) {
    setBusy(true);
    setError('');
    try {
      await onSaveReporting({
        ...reporting,
        taxReviews: {
          ...reporting.taxReviews,
          [reviewKey(year, g.label)]: {
            reviewedAt: new Date().toISOString(),
            fingerprint: hashes[g.label]
          }
        }
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const rows = () => summaryRows(year, groups, reporting.taxReviews, hashes);
  function print() {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head><title>Expense Group Summary</title><style>body{font:14px system-ui;color:#172e3a;padding:24px}table{border-collapse:collapse;width:100%}td{padding:10px;border-bottom:1px solid #ccc}tr:nth-child(3){font-weight:bold}h1{font-size:22px}</style></head><body><h1>Expense Group Summary</h1><table></table></body></html>');
    doc.close();
    const table = doc.querySelector('table');
    for (const row of rows()) {
      const tr = doc.createElement('tr');
      for (const value of row) {
        const td = doc.createElement('td');
        td.textContent = String(value);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  }
  return <section className="tax-time-summary" aria-label="Expense Group Summary"><div className="section-title"><div><h3>Expense Group Summary · {year}</h3><p className="hint">Recorded annual totals · Grouping review is separate from bank reconciliation and does not confirm deductibility.</p></div><div className="report-actions"><button disabled={!ready} onClick={() => downloadCSV(`Expense-Group-Summary-${year}.csv`, rows())}>Export Expense Group Summary</button><button disabled={!ready} onClick={print}>Print Expense Group Summary</button></div></div>{error && <p role="alert">{error}</p>}{count > 0 && <button className="tax-unassigned" onClick={onAssign}>{count} {count === 1 ? 'Category' : 'Categories'} Still Unassigned · Assign Groups</button>}{groups.length ? <div className="table-wrap"><table><thead><tr><th>Tax Group</th><th>Recorded Annual Total</th><th>Grouping Review</th><th>Action</th></tr></thead><tbody>{groups.map(g => {
            const marker = reporting.taxReviews?.[reviewKey(year, g.label)],
              status = groupReview(g, marker, hashes[g.label]);
            return <tr key={g.label}><td><button className="tax-group-link" onClick={() => onSelect(g.label)}>{g.label}</button></td><td><strong>{money(g.total)}</strong>{g.rows.some(r => !Number.isFinite(r.amount)) && <small>Incomplete · known amounts only</small>}</td><td><span className={'tax-review-status ' + (status.reviewed ? 'reviewed' : 'pending')}>{status.label}</span>{marker && <small className="tax-review-date">{status.reviewed ? 'Reviewed' : 'Last Review'} · {reviewDate(marker.reviewedAt)}</small>}</td><td><button disabled={busy || !status.canReview} onClick={() => mark(g)}>{status.reviewed ? 'Review Again' : 'Mark Grouping Reviewed'}</button></td></tr>;
          })}</tbody></table></div> : <p>No recorded business expenses for this year.</p>}<p className="hint">Select a group to see its supporting categories and entries. Later entry or assignment changes flag the affected group for another review.</p></section>;
}
