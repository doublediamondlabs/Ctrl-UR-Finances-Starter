import React, { useState } from 'react';
import { parseBanterra, rowStatus, candidates, applyBankReview, bankMonths } from './bank.js';
const money = n => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(n);
export default function BankImport({
  book,
  session,
  setSession,
  onSave
}) {
  const [error, setError] = useState(''),
    [filter, setFilter] = useState('Needs review'),
    [month, setMonth] = useState('All months'),
    [page, setPage] = useState(0),
    [notice, setNotice] = useState('');
  const rows = session?.rows || [],
    choices = session?.choices || {},
    history = book.bankHistory || [];
  function patch(row, value) {
    setSession(prev => ({
      ...prev,
      choices: {
        ...prev.choices,
        [row.key]: {
          ...prev.choices[row.key],
          ...value
        }
      }
    }));
    setError('');
  }
  async function selectFile(e) {
    try {
      const f = e.target.files[0];
      if (!f) return;
      if (Object.values(choices).some(c => c.action) && !confirm('Discard the current unsaved import choices and open another CSV?')) return;
      if (f.size > 5e6) throw Error('Maximum file size is 5 MB.');
      const parsed = parseBanterra(await f.text());
      if (!parsed.length) throw Error('The CSV has no transactions.');
      setSession({
        rows: parsed,
        file: f.name,
        choices: {}
      });
      setPage(0);
      setFilter('Needs review');
      setMonth('All months');
      setError('');
      setNotice('CSV preview loaded. Nothing has been saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  }
  async function commit() {
    try {
      setError('');
      const next = applyBankReview(book, rows, choices, session.file);
      await onSave(next, () => {
        setSession(prev => ({
          ...prev,
          choices: {}
        }));
        setNotice('Reviewed transactions saved to workbook. Remaining rows still need review.');
        setPage(0);
      });
    } catch (e) {
      setError(e.message);
    }
  }
  const counts = {};
  for (const r of rows) {
    const s = rowStatus(r, book);
    counts[s] = (counts[s] || 0) + 1;
  }
  const visible = rows.filter(r => (filter === 'All transactions' || rowStatus(r, book) === filter) && (month === 'All months' || r.month === month));
  const pages = Math.max(1, Math.ceil(visible.length / 15)),
    current = Math.min(page, pages - 1),
    selected = Object.values(choices).filter(c => c.action).length;
  return <section className="bank-import panel"><h2>Banterra business account</h2><p>Review before saving. Match an existing entry to avoid counting it twice. Bank deposits may be transfers or refunds; withdrawals may include transfers or credit-card payments.</p><label className="bank-file">Choose Banterra CSV<input type="file" accept=".csv,text/csv" onChange={selectFile} /></label>{notice && <p role="status">{notice}</p>}{error && <div className="error" role="alert">{error}</div>}{session && <><p><strong>{session.file}</strong> · {rows.length} transactions · Workbook {book.year}</p><div className="bank-counts">{Object.entries(counts).map(([label, n]) => <span key={label}>{label}: <strong>{n}</strong></span>)}</div><p className="hint">Pending and other-year rows cannot be saved. Matching uses exact amount and month because older workbook entries do not have transaction dates. Combined deposits, split payments and amount differences need individual review; leave them unselected for now.</p><div className="bank-toolbar"><label>Show<select value={filter} onChange={e => {
            setFilter(e.target.value);
            setPage(0);
          }}>{['Needs review', 'All transactions', 'Pending', 'Already imported', 'Excluded', 'Other year', 'Repeated in file', 'Linked entry removed'].map(x => <option key={x}>{x}</option>)}</select></label><label>Month<select value={month} onChange={e => {
            setMonth(e.target.value);
            setPage(0);
          }}>{['All months', ...bankMonths].map(x => <option key={x}>{x}</option>)}</select></label><button className="primary" disabled={!selected} onClick={commit}>Save Reviewed ({selected})</button></div>{visible.slice(current * 15, (current + 1) * 15).map(row => {
        const status = rowStatus(row, book),
          c = choices[row.key] || {},
          matches = candidates(row, book),
          similar = history.filter(h => h.signature === row.signature),
          eligible = status === 'Needs review';
        return <article className="bank-row" key={row.row}><div className="bank-row-title"><div><strong>{row.description}</strong><small>{row.date} · {row.type} · {row.month}</small></div><strong>{money(row.amount)}</strong></div><div className="bank-source"><span className="badge">{status}</span>{row.category && <span>Bank category: {row.category}</span>}{row.note && <p>Bank note: {row.note}</p>}</div>{similar.length > 0 && eligible && <div className="notice">Possible duplicate: this date, description and amount were already reviewed with a different balance.<label><input type="checkbox" checked={!!c.allowSimilar} onChange={e => patch(row, {
                allowSimilar: e.target.checked
              })} />I checked; this is a separate transaction.</label></div>}{status === 'Linked entry removed' && <p>The previously linked entry was removed. This bank row remains in import history to prevent accidental re-import. Review the workbook backup before correcting it.</p>}{eligible && <><label>Action<select aria-label={'Action row ' + row.row} value={c.action || ''} onChange={e => patch(row, {
                action: e.target.value,
                description: row.description,
                category: '',
                subCategory: '',
                scope: 'business',
                recordId: '',
                reason: ''
              })}><option value="">Leave for later</option><option value="match">Match existing entry ({matches.length} candidates)</option><option value="expense">{row.amount > 0 ? 'Add expense refund / credit' : 'Add expense'}</option><option value="inspection">{row.amount < 0 ? 'Add inspection refund' : 'Add inspection income'}</option><option value="exclude">Exclude from workbook totals</option></select></label>{c.action === 'match' && <><label>Existing entry<select aria-label={'Match row ' + row.row} value={c.recordId || ''} onChange={e => patch(row, {
                  recordId: e.target.value
                })}><option value="">Choose a matching entry</option>{matches.map(e => <option key={e.id} value={e.id}>{e.state} · {e.scope} · {e.category} · {e.description} · {money(e.amount)} · {e.sheet} {e.amountCell || ''}</option>)}</select></label><p className="hint">Keeps the existing amount, description, mileage and notes; adds bank source information. A planned match becomes recorded.</p></>}{['expense', 'inspection'].includes(c.action) && <div className="bank-form"><label>Description<input value={c.description || ''} onChange={e => patch(row, {
                  description: e.target.value
                })} /></label>{c.action === 'expense' && <><label>Expense group<select value={c.scope || 'business'} onChange={e => patch(row, {
                    scope: e.target.value,
                    category: ''
                  })}><option value="business">Direct business expense</option><option value="residence">Housing / household cost</option></select></label><label>Category<select aria-label={'Category row ' + row.row} value={c.category || ''} onChange={e => patch(row, {
                    category: e.target.value
                  })}><option value="">Choose category</option>{book.categories.filter(cat => c.scope === 'residence' ? cat.role === 'residence' || cat.name === 'Residence' : cat.role !== 'residence' && cat.name !== 'Residence').map(cat => <option key={cat.name}>{cat.name}</option>)}</select></label><label>Subcategory<input value={c.subCategory || ''} onChange={e => patch(row, {
                    subCategory: e.target.value
                  })} /></label></>}<p>Workbook amount: {money(c.action === 'expense' ? -row.amount : row.amount)} · Recorded · {row.month}{c.action === 'inspection' ? ' · Mileage remains blank; add it later if applicable.' : ''}</p></div>}{c.action === 'exclude' && <label>Reason<select aria-label={'Reason row ' + row.row} value={c.reason || ''} onChange={e => patch(row, {
                reason: e.target.value
              })}><option value="">Choose reason</option>{['Account transfer', 'Credit-card payment (purchases tracked separately)', 'Owner contribution / withdrawal', 'Personal transaction', 'Already covered by combined workbook entry', 'Other — keep out of totals'].map(x => <option key={x}>{x}</option>)}</select></label>}</>}</article>;
      })}{!visible.length && <p>No transactions in this view.</p>}<div className="bank-toolbar"><button disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current + 1} of {pages}</span><button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button><button className="primary" disabled={!selected} onClick={commit}>Save Reviewed ({selected})</button></div></>}
<details className="bank-history"><summary>Saved import history ({history.length})</summary><p>Stored in this year's workbook. Excluded rows stay out of totals. You can reopen an exclusion for review by removing only its history marker, then loading the CSV again.</p>{history.length > 0 && <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Bank amount</th><th>Action / reason</th><th>Correction</th></tr></thead><tbody>{history.map(h => <tr key={h.key}><td>{h.date}</td><td>{h.description}</td><td>{money(h.amount)}</td><td>{h.action}{h.reason ? ' · ' + h.reason : ''}</td><td>{h.action === 'exclude' && <button onClick={() => {
                  if (confirm('Reopen this excluded bank transaction for review? No expense or income entry will be added.')) onSave({
                    ...book,
                    bankHistory: history.filter(x => x.key !== h.key)
                  }, () => setNotice('Exclusion reopened. Load the CSV to review it again.'));
                }}>Reopen</button>}</td></tr>)}</tbody></table></div>}</details></section>;
}
