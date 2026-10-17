import { inspectionReviewSummary } from './reviewQueue.js';
import React, { useEffect, useState, useMemo } from 'react';
import { monthProgress, progressHash } from './monthProgress.js';
import { MONTHS } from './inspectionIncome.js';
export default function MonthProgress({
  book,
  month,
  reporting = {},
  onSaveReporting,
  onAction,
  busy = false,
  informationAsOf,
  workspaceActions
}) {
  const fallbackAsOf = useMemo(() => new Date().toISOString(), [book]);
  const displayedAsOf = new Date(informationAsOf || fallbackAsOf).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  const key = `${book.year}-${String(month + 1).padStart(2, '0')}`,
    saved = reporting.inspectionProgress?.[key] || {},
    waiting = saved.awaiting || {},
    p = monthProgress(book, month, waiting),
    [hash, setHash] = useState(null),
    [expanded, setExpanded] = useState(null),
    [confirm, setConfirm] = useState(false),
    [checked, setChecked] = useState(false),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [waitEdit, setWaitEdit] = useState(null),
    [note, setNote] = useState('');
  useEffect(() => {
    let active = true;
    setHash(null);
    setConfirm(false);
    setChecked(false);
    progressHash(p.snapshot).then(h => {
      if (active) setHash({
        snapshot: p.snapshot,
        value: h
      });
    }).catch(() => {
      if (active) setError('Review status could not be checked. Reload the app before marking this month reviewed.');
    });
    return () => {
      active = false;
    };
  }, [p.snapshot]);
  const ready = hash?.snapshot === p.snapshot,
    reviewed = ready && saved.fingerprint === hash.value,
    locked = busy || working,
    stamp = saved.reviewedAt ? new Date(saved.reviewedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : '',
    status = saved.reviewedAt ? ready ? reviewed ? `Reviewed ${stamp}` : `Changed since review · ${stamp}` : 'Checking review status…' : 'Not yet reviewed';
  async function persist(patch) {
    setWorking(true);
    setError('');
    try {
      await onSaveReporting({
        ...reporting,
        inspectionProgress: {
          ...reporting.inspectionProgress,
          [key]: {
            ...saved,
            ...patch
          }
        }
      });
      setConfirm(false);
      setChecked(false);
      setWaitEdit(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  const reviewSummary = inspectionReviewSummary(book, reporting, month, p, ready ? hash.value : null);
  const cards = [{
    name: '1 · Inspection details',
    small: 'Customer, RV, location and appointment',
    rows: p.details,
    total: p.jobs.length,
    ready: p.jobs.length - p.details.length
  }, {
    name: '2 · Outcomes & payments',
    small: 'Visit outcome, vehicle/miles, payments and refunds',
    rows: p.outcomes,
    total: p.jobs.length,
    ready: p.jobs.length - p.outcomes.length
  }, {
    name: '3 · Bank matching',
    small: 'Customer receipts and refunds → bank transactions',
    rows: [...p.bank, ...p.issues],
    total: p.events.length,
    ready: p.events.length - p.bank.length - p.awaiting.length
  }];
  return <section id="inspection-month-review" className="monthly-progress" aria-label="Monthly inspection progress"><div className="progress-heading"><h2>{MONTHS[month]} {book.year} · Monthly inspection progress</h2><span className={saved.reviewedAt && !reviewed ? 'progress-amber' : reviewed ? 'progress-green' : ''}>{status}</span></div>{workspaceActions}<div className="progress-cards">{cards.map((c, i) => <button key={c.name} disabled={locked} aria-expanded={expanded === i} className={i === 2 && p.issues.some(x => x.red) ? 'red' : c.rows.length || i === 2 && p.awaiting.length ? 'amber' : c.total ? 'green' : 'neutral'} onClick={() => setExpanded(expanded === i ? null : i)}><strong>{c.name}</strong><small>{c.small}</small><b>{i === 2 ? `${p.bank.length} to match · ${p.issues.length} settlements to review` : c.total ? `${c.ready} of ${c.total} ready` : "No Entries Recorded"}</b>{i === 2 && p.awaiting.length > 0 && <small>{p.awaiting.length} awaiting later deposit</small>}{i === 2 && p.later.length > 0 && <small>{p.later.length} matched to a later month</small>}</button>)}</div>
 <div className="progress-next"><span>{reviewSummary.reason}</span>{p.next && <button disabled={locked} onClick={() => onAction(p.next)}>Continue →</button>}<button disabled={locked || !ready || p.blocking > 0 || reviewed} onClick={() => {
        setConfirm(true);
        setChecked(false);
      }}>Mark Month Reviewed</button></div>
 {expanded !== null && <div className="progress-detail">{cards[expanded].rows.map((row, i) => <div className="progress-item" key={row.eventId || row.kind + row.id + i}><span><strong>{row.label}</strong><small>{row.reason}</small></span><button disabled={locked} onClick={() => onAction(row)}>{row.kind === 'bank' ? "Match To Bank Deposit" : row.kind === 'payout' ? "Review Settlement" : "Review Inspection"}</button>{row.kind === 'bank' && !row.payoutId && <button disabled={locked} onClick={() => {
          setWaitEdit(row.eventId);
          setNote('');
        }}>Awaiting Later Deposit</button>}</div>)}{!cards[expanded].rows.length && <div className="progress-empty"><p>No items to review in this step</p><small>Information as of {displayedAsOf}</small></div>}{expanded === 2 && p.awaiting.map(row => <div className="progress-item" key={row.eventId}><span><strong>{row.label} · Awaiting later deposit</strong><small>{row.reason} · {row.note}</small></span><button disabled={locked} onClick={() => onAction(row)}>Match Deposit</button><button disabled={locked} onClick={() => {
          const next = {
            ...waiting
          };
          delete next[row.eventId];
          persist({
            awaiting: next
          });
        }}>Remove Waiting Status</button></div>)}</div>}
 {waitEdit && <div className="progress-confirm"><label>Why is this awaiting a later deposit?<input value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label><p>This records your explanation. It does not confirm a deposit or change income.</p><button disabled={locked || !note.trim()} onClick={() => persist({
        awaiting: {
          ...waiting,
          [waitEdit]: {
            note: note.trim(),
            markedAt: new Date().toISOString()
          }
        }
      })}>Save Waiting Status</button><button disabled={locked} onClick={() => setWaitEdit(null)}>Cancel</button></div>}
 {confirm && <div className="progress-confirm"><label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I compared this month’s inspection details, customer payments/refunds and bank connections with my scheduling records, processor information and bank statement. Any awaiting deposits are documented.</label><p>This records my review as of today, based on information entered. It does not independently verify completeness or mark expenses reconciled.</p><button disabled={locked || !checked || !ready || p.blocking > 0} onClick={() => persist({
        reviewedAt: new Date().toISOString(),
        fingerprint: hash.value
      })}>Confirm Month Reviewed</button><button disabled={locked} onClick={() => setConfirm(false)}>Cancel</button></div>}
 {error && <p role="alert" className="error">{error}</p>}<details className="progress-help"><summary>What does this status mean?</summary><p>This review covers only <strong>ENTERED</strong> inspection records. Compare HG, HGpay, and bank records to ensure all inspections, payments, and refunds have been entered. Expense reconciliation remains a separate task.</p><p>“Information as of” is when the displayed workbook data was loaded or refreshed after saving—not the date you marked the month reviewed.</p><p>Relevant changes flag a dated review for another review. Later bank deposits do not move a customer payment’s income month.</p></details></section>;
}
