import React from 'react';
export default function LocationReview({
  data,
  onReview,
  onOpen,
  busy = false
}) {
  return <>
 {data.review.length > 0 && <details className="report-detail"><summary>{data.review.length} Visits / Original Rows Need Classification</summary><p className="hint">These rows are not included in classified location totals.</p>{data.review.map((r, i) => <article key={r.id + ':' + (r.visitId || i)}><strong>{r.label} · {r.inspectionDate || r.month}</strong><p>{r.reason}</p>{onReview && <form onSubmit={e => {
          e.preventDefault();
          onReview(r, new FormData(e.currentTarget).get('note'));
        }}><label>Why details are unavailable<textarea name="note" required maxLength={1000} /></label><button disabled={busy}>Reviewed — Details Unavailable</button><p className="hint">Acknowledges this location-classification prompt only. Recorded miles stay unchanged; this row remains outside classified location totals.</p></form>}<button disabled={!onOpen} onClick={() => onOpen({
          ...r,
          activityDate: r.inspectionDate
        })}>Open Record</button></article>)}</details>}
 {(data.acknowledged || []).length > 0 && <details className="report-detail"><summary>{data.acknowledged.length} Reviewed — Details Unavailable</summary>{data.acknowledged.map(r => <article key={r.reviewKey}><strong>{r.label} · {r.inspectionDate || r.month}</strong><p>{r.ack.note}</p><small>Reviewed {r.ack.reviewedAt.slice(0, 10)} · Excluded from classified location totals</small><div className="income-tabs"><button disabled={!onOpen} onClick={() => onOpen({
            ...r,
            activityDate: r.inspectionDate
          })}>Open Record</button>{onReview && <button disabled={busy} onClick={() => onReview(r, null)}>Reopen Classification Review</button>}</div></article>)}</details>}
 {data.excluded > 0 && <p className="hint">{data.excluded} scheduled visit(s) excluded.</p>}
</>;
}
