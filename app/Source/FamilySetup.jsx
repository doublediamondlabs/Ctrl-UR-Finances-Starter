import { LinkLockBar } from './LinkGuard.jsx';
import React, { useState, useEffect } from 'react';
import { blankBook } from './workbook.js';
import { writeLoan } from './loanWorkbook.js';
import { validateLoan } from './loan.js';
import { getShared, setShared } from './sharedInspections.js';
export default function FamilySetup({
  api,
  onCreated,
  onLink,
  onBrowse,
  onDirty
}) {
  const now = new Date(),
    [draft, setDraft] = useState({
      borrower: '',
      principal: '',
      monthlyPayment: '',
      startYear: now.getFullYear(),
      startMonth: now.getMonth() + 1,
      dueDay: 15,
      graceDays: 0
    }),
    [path, setPath] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const dirty = !!draft.borrower || !!draft.principal || !!draft.monthlyPayment || !!path;
  useEffect(() => {
    onDirty(dirty || busy);
    return () => onDirty(false);
  }, [dirty, busy]);
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const start = draft.startYear + '-' + String(draft.startMonth).padStart(2, '0');
      const loan = validateLoan({
        version: 2,
        borrower: draft.borrower.trim(),
        principal: Number(draft.principal),
        initialPayment: Number(draft.monthlyPayment),
        monthlyPayment: Number(draft.monthlyPayment),
        start,
        rateChange: start,
        dueDay: Number(draft.dueDay),
        graceDays: Number(draft.graceDays),
        receipts: [],
        remittances: [],
        openingForwarded: null,
        openingForwardedDate: '',
        privateNote: '',
        imported: false
      });
      const saved = getShared();
      let base;
      try {
        setShared(null);
        base = blankBook(Number(draft.startYear));
      } finally {
        setShared(saved);
      }
      const r = await api('loan/create', {
        base64: writeLoan(base, loan)
      });
      onCreated(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <section className="panel"><h2>Set up family repayments</h2><p>Track a zero-interest loan you made or manage for someone else. Receipts stay separate from household income. Later payments do not erase missed-month history.</p>{error && <p className="error" role="alert">{error}</p>}<form onSubmit={create}><LinkLockBar /><fieldset disabled={busy}><div className="form-grid"><label>Borrower name<input required maxLength={100} value={draft.borrower} onChange={e => setDraft({
              ...draft,
              borrower: e.target.value
            })} /></label><label>Original principal ($)<input required type="number" min="0.01" max="1000000000" step="0.01" value={draft.principal} onChange={e => setDraft({
              ...draft,
              principal: e.target.value
            })} /></label><label>Monthly payment ($)<input required type="number" min="0.01" max="1000000000" step="0.01" value={draft.monthlyPayment} onChange={e => setDraft({
              ...draft,
              monthlyPayment: e.target.value
            })} /></label><label>First payment year<input required type="number" min="1900" max="2200" value={draft.startYear} onChange={e => setDraft({
              ...draft,
              startYear: Number(e.target.value)
            })} /></label><label>First payment month<select value={draft.startMonth} onChange={e => setDraft({
              ...draft,
              startMonth: Number(e.target.value)
            })}>{Array.from({
                length: 12
              }, (_, i) => <option key={i} value={i + 1}>{new Date(2026, i, 1).toLocaleString('en-US', {
                  month: 'long'
                })}</option>)}</select></label><label>Due day (1–28)<input type="number" min="1" max="28" required value={draft.dueDay} onChange={e => setDraft({
              ...draft,
              dueDay: Number(e.target.value)
            })} /></label><label>Grace days (0–14)<input type="number" min="0" max="14" required value={draft.graceDays} onChange={e => setDraft({
              ...draft,
              graceDays: Number(e.target.value)
            })} /></label></div><button className="primary">Create repayment workbook</button> <button type="button" onClick={() => {
          setDraft({
            ...draft,
            borrower: '',
            principal: '',
            monthlyPayment: ''
          });
          setPath('');
          setError('');
        }}>Clear form</button></fieldset></form><details><summary>Link an existing app repayment workbook</summary><p>Requires a saved DD Loan ledger. Custom legacy spreadsheets need a separate migration.</p><label>Workbook path<input value={path} onChange={e => setPath(e.target.value)} /></label><button disabled={busy} onClick={async () => {
        try {
          const p = await onBrowse();
          if (p) setPath(p);
        } catch (e) {
          setError(e.message);
        }
      }}>Browse workbook</button><button disabled={busy || !path} onClick={async () => {
        setBusy(true);
        setError('');
        try {
          await onLink(path);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}>Link repayment workbook</button></details></section>;
}
