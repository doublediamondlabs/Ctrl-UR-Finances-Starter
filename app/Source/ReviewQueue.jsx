import React, { useEffect, useState } from 'react';
import { MONTHS } from './analytics.js';
import { monthProgress, progressHash } from './monthProgress.js';
import { financialReviewSummary, inspectionReviewSummary } from './reviewQueue.js';
export default function ReviewQueue({
  book,
  reporting,
  domain,
  onContinue,
  busy,
  inspectionsEnabled = true
}) {
  const financial = MONTHS.map((_, m) => financialReviewSummary(book, reporting, domain, m));
  const progress = domain === 'business' && inspectionsEnabled ? MONTHS.map((_, m) => {
    const key = book.year + '-' + String(m + 1).padStart(2, '0');
    return monthProgress(book, m, reporting.inspectionProgress?.[key]?.awaiting || {});
  }) : [];
  const signature = JSON.stringify(progress.map(p => p.snapshot)),
    [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    setResult(null);
    if (domain === 'business' && inspectionsEnabled) Promise.all(progress.map(p => progressHash(p.snapshot))).then(hashes => {
      if (active) setResult({
        signature,
        hashes
      });
    }).catch(() => {
      if (active) setResult({
        signature,
        error: true
      });
    });
    return () => {
      active = false;
    };
  }, [signature, domain, book, inspectionsEnabled]);
  const inspected = domain === 'business' && inspectionsEnabled ? progress.map((p, m) => inspectionReviewSummary(book, reporting, m, p, result?.signature === signature ? result.hashes?.[m] : null)) : [];
  function section(title, rows) {
    const ordered = [...rows].sort((a, b) => a.month - b.month),
      active = rows.filter(r => r.needs),
      checking = rows.some(r => r.state.startsWith('Checking'));
    return <details className="review-queue-section" aria-label={title}><summary className="review-section-heading"><strong>{title}</strong>{checking ? <span className="hint">{result?.error ? 'Review status could not be checked. Refresh Overview to try again.' : 'Checking inspection reviews…'}</span> : <span className={active.length ? 'report-incomplete' : 'hint'}>{active.length ? `${active.length} ${active.length === 1 ? 'month needs' : 'months need'} attention` : 'No recorded work currently needs attention.'}</span>}</summary>
 {ordered.map(r => <article className={`review-queue-item ${r.needs ? 'needs-attention' : 'no-attention'}`} key={r.month}>
 <details className="review-month-details"><summary><strong>{r.label} {book.year} · {r.state}</strong></summary>
 <div className="review-month-explanation"><p>{r.stage === 'future' ? 'Future month · not due for review. ' : r.stage === 'current' ? 'Current month · in progress. ' : ''}{r.reason}</p>{r.samples.map((s, i) => <small key={i}>{s}</small>)}{r.reviewedAt && <small>Last {r.kind === 'inspection' ? 'inspection review' : 'financial review'}: {new Date(r.reviewedAt).toLocaleDateString()}</small>}</div></details>
 <button disabled={busy || checking} aria-label={`${r.needs ? 'Continue Review' : 'Open Month'}: ${r.label} ${book.year}, ${title}`} onClick={() => onContinue?.({
          domain,
          month: r.month,
          kind: r.kind
        })}>{r.needs ? 'Continue Review' : 'Open Month'}</button></article>)}</details>;
  }
  return <div className="review-queue">{section('Financial Reconciliation', financial)}{domain === 'business' && inspectionsEnabled && section('Inspection Review', inspected)}<div className="entry-guidance"><strong>About These Reviews</strong><p>Empty months are not automatically reviewed. Future months remain available, without being treated as overdue.{domain === 'business' && ' Financial and inspection reviews are recorded separately.'}</p></div></div>;
}
