import React, { useState, useRef } from 'react';
import { ledger, jobLabel, crossYearChanges } from './inspectionIncome.js';
import { prepareTravelExport, previewTravelReturn, visitSnapshot } from './romTransfer.js';
function download(p) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], {
    type: 'application/json'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Expense-Book-to-RoM-' + p.inspection.date + '-' + p.linkId.slice(0, 8) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function RomTransfer({
  book,
  onSave,
  onClose,
  busy,
  loadTravelBooks,
  initialVisit
}) {
  const [choice, setChoice] = useState(initialVisit ? initialVisit.jobId + '|' + initialVisit.visitId : ''),
    [preview, setPreview] = useState(null),
    [file, setFile] = useState(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [working, setWorking] = useState(false),
    [ready, setReady] = useState(null);
  const [context, setContext] = useState(null),
    [selectedIds, setSelectedIds] = useState([]),
    [acknowledgedIds, setAcknowledgedIds] = useState([]);
  const fileInput = useRef(null);
  const [sendOpen, setSendOpen] = useState(!!initialVisit);
  const getContext = () => loadTravelBooks ? loadTravelBooks() : Promise.resolve({
    books: [book],
    revisions: []
  });
  function options(ctx = context, ids = selectedIds, acks = acknowledgedIds) {
    return {
      ...ctx,
      selectedIds: ids,
      acknowledgedIds: acks
    };
  }
  function choose(ids, acks) {
    setSelectedIds(ids);
    setAcknowledgedIds(acks);
    try {
      setPreview(previewTravelReturn(book, file, options(context, ids, acks)));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  const locked = busy || working,
    rows = Object.entries(ledger(book).jobs).flatMap(([id, j]) => j.entryType === 'travel' ? [] : (j.visits || []).filter(v => v.outcome === 'Scheduled' || v.romExport).map(v => ({
      id,
      v
    }))).sort((a, b) => (a.v.date || '').localeCompare(b.v.date || ''));
  const selected = rows.find(r => r.id + '|' + r.v.id === choice),
    info = selected ? visitSnapshot(book, selected.id, selected.v.id) : null;
  function reset() {
    setPreview(null);
    setFile(null);
    setReady(null);
    setError('');
    setMessage('');
  }
  async function read(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    reset();
    setSendOpen(false);
    setWorking(true);
    try {
      if (f.size > 1024 * 1024) throw Error('Transfer file is too large.');
      const p = JSON.parse(await f.text()),
        ctx = await getContext(),
        result = previewTravelReturn(book, p, ctx);
      setContext(ctx);
      setSelectedIds(result.selectedIds || []);
      setAcknowledgedIds([]);
      if (result.already) setMessage('These results were already applied. Nothing changed.');else {
        setFile(p);
        setPreview(result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  async function send() {
    setWorking(true);
    setError('');
    try {
      const ctx = await getContext(),
        result = prepareTravelExport(book, selected.id, selected.v.id, ctx.books);
      if (await onSave(result.next, undefined, undefined, {
        additions: [],
        revisions: ctx.revisions
      })) {
        setReady(result.packet);
        download(result.packet);
        setMessage('Export saved and downloaded, including categories for linked years. In RōM, choose Plan from Expense Book.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  async function apply() {
    setWorking(true);
    setError('');
    try {
      const result = previewTravelReturn(book, file, options());
      if (result.already) {
        setPreview(null);
        setMessage('Already applied.');
      } else if (result.canApply === false) {
        setError('Select at least one new item and resolve possible duplicate warnings.');
      } else if (await onSave(result.next, undefined, undefined, result.expensePlan)) {
        setPreview(null);
        setFile(null);
        setMessage('Trip results saved' + (result.newExpenseCount ? ' · ' + result.newExpenseCount + ' expense(s) added.' : '.') + ' Review the visit outcome separately when the inspection is complete.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  return <section className="panel rom-transfer"><div className="section-title"><h2>RōM · Inspection Travel</h2><button disabled={locked} onClick={onClose}>← Back</button></div><p className="entry-guidance">Choose a scheduled visit that needs travel planning. Files move between your two offline applications; nothing synchronizes in the background. Preview returned mileage, notes and itemized business expenses before saving.</p>{error && <p className="error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}<fieldset disabled={locked} style={{
      border: 0,
      padding: 0
    }}><div className="rom-transfer-actions"><button aria-expanded={sendOpen && !preview} aria-controls="rom-send-options" disabled={!!preview} onClick={() => setSendOpen(!sendOpen)}><span aria-hidden="true">{sendOpen && !preview ? "▾ " : "▸ "}</span>Send an Inspection to RōM</button><button className="rom-import-action" onClick={() => fileInput.current?.click()}>Import Travel from RōM</button><input ref={fileInput} hidden aria-label="Return from RōM JSON" type="file" accept=".json" onChange={read} /></div>{preview ? <><h3>Review Trip Results · {preview.inspection.name}</h3><p>{preview.before.date} · {preview.before.purpose}</p><div className="form-grid"><div><strong>Actual miles</strong><p>{preview.before.miles ?? 'Not recorded'} → {preview.after.miles ?? 'Not recorded'} {file.actualMiles === null ? '(kept)' : ''}</p></div><div><strong>Notes to append</strong><p style={{
              whiteSpace: 'pre-wrap'
            }}>{file.notes || 'None'}</p></div></div>{crossYearChanges(book, preview.next).map((c, i) => <p key={i}>{c.year} {c.month} · Mileage {c.milesBefore} → {c.milesAfter}</p>)}<p className="hint">This replaces the visit’s mileage; it does not add another journey. Payments, dates, vehicle and visit outcome stay as recorded. Selected expenses are added to their dated months and years. Notes are appended once.</p>{preview.expenseRows && <section><h3>Trip Expenses · {preview.newExpenseCount} Selected · ${preview.expenseTotal.toFixed(2)}</h3><p className="hint">Each checked item creates one recorded business expense. Possible matches start unchecked. Skip expenses already recorded, or confirm that a flagged item is a separate purchase. Totals are recorded spending, not calculated deductions.</p><div className="table-wrap"><table><thead><tr><th>Import</th><th>Date / Payee</th><th>Category</th><th>Amount</th><th>Review</th></tr></thead><tbody>{preview.expenseRows.map(row => {
                  const x = row.expense,
                    chosen = selectedIds.includes(x.id);
                  return <tr key={x.id}><td><input aria-label={'Import ' + x.payee + ' ' + x.date} type="checkbox" checked={chosen} disabled={row.imported || !!row.problem} onChange={e => choose(e.target.checked ? [...selectedIds, x.id] : selectedIds.filter(id => id !== x.id), acknowledgedIds)} /></td><td>{x.date}<br /><strong>{x.payee}</strong><br />{x.description}</td><td>{x.category}{x.subCategory ? ' / ' + x.subCategory : ''}</td><td>${Number(x.amount).toFixed(2)}</td><td>{row.imported ? <strong>Already imported — blocked</strong> : row.problem ? <span className="error">{row.problem}</span> : row.matches.length ? <><strong>Possible duplicate</strong>{row.matches.map((m, i) => <p key={i}>{m.date} · {m.description} · {m.state}</p>)}<label><input type="checkbox" checked={acknowledgedIds.includes(x.id)} onChange={e => choose(selectedIds, e.target.checked ? [...acknowledgedIds, x.id] : acknowledgedIds.filter(id => id !== x.id))} />I checked: this is a separate purchase</label></> : <span>Ready for {x.date.slice(0, 7)}</span>}{row.imported && row.problem && <p className="error">{row.problem}</p>}</td></tr>;
                })}</tbody></table></div></section>}<button className="primary" disabled={preview.canApply === false} onClick={apply}>Apply Trip Results</button> <button onClick={reset}>Cancel Preview</button></> : sendOpen && <div id="rom-send-options" className="rom-send-options"><label>Scheduled or previously linked visit<select value={choice} onChange={e => {
            reset();
            setChoice(e.target.value);
          }}><option value="">Choose a visit</option>{rows.map(r => <option key={r.id + '|' + r.v.id} value={r.id + '|' + r.v.id}>{r.v.date || 'Date pending'} · {jobLabel(book, r.id)} · {r.v.purpose} · {r.v.outcome}</option>)}</select></label>{info && <><div className="form-grid"><div><h4>{info.name}</h4><p>{info.date} · {info.purpose} · {info.outcome}</p><p>{info.rv} · VIN: {info.vin || 'Not recorded'}</p><p>{info.destination || 'Location not recorded'}</p><p>Recorded mileage: {info.miles ?? 'Not recorded'} · Quoted fee: {info.quote ?? 'Not recorded'}</p></div><details><summary>Contacts & Notes Included</summary><p style={{
                whiteSpace: 'pre-wrap'
              }}>{info.contacts}</p><p style={{
                whiteSpace: 'pre-wrap'
              }}>{info.notes || 'No notes'}</p></details></div><p className="hint">The file contains customer information. Keep it with your business files. Exporting saves the visit’s transfer link using the normal protected workbook save.</p><button className="primary" onClick={send}>Save Link & Export to RōM</button>{ready && <button onClick={() => download(ready)}>Download Same Export Again</button>}</>}</div>}</fieldset></section>;
}
