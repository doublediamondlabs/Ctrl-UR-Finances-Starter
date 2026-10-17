import React, { useEffect, useRef, useState } from 'react';
export const taxNoteKey = (year, type, id) => JSON.stringify([Number(year), type, id]);
export function taxNoteExport(reporting, year) {
  return Object.entries(reporting.taxNotes || {}).flatMap(([key, n]) => {
    let parts;
    try {
      parts = JSON.parse(key);
    } catch {
      return [];
    }
    return parts[0] === Number(year) ? [[parts[1], n.title || parts[2], n.decision || '', n.reason || '', n.sources || '', n.reviewedDate || '']] : [];
  });
}
function Sources({
  text
}) {
  return <div>{(text || '').split('\n').filter(Boolean).map((line, i) => {
      let valid = false;
      try {
        valid = ['http:', 'https:'].includes(new URL(line.trim()).protocol);
      } catch {}
      return <p key={i}>{valid ? <a href={line.trim()} target="_blank" rel="noreferrer">{line}</a> : line}</p>;
    })}</div>;
}
export default function TaxTreatmentNotes({
  year,
  type,
  id,
  title,
  reporting,
  onSaveReporting
}) {
  const note = reporting.taxNotes?.[taxNoteKey(year, type, id)],
    dialog = useRef(null),
    [draft, setDraft] = useState(null),
    [baseline, setBaseline] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = draft && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    if (draft) dialog.current?.showModal();
  }, [!!draft]);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function edit() {
    const next = {
      decision: note?.decision || '',
      reason: note?.reason || '',
      sources: note?.sources || '',
      reviewedDate: note?.reviewedDate || ''
    };
    setBaseline(JSON.stringify(next));
    setDraft(next);
    setError('');
  }
  function close() {
    if (busy) return;
    if (dirty && !window.confirm('Discard unsaved treatment notes?')) return;
    dialog.current?.close();
    setDraft(null);
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const value = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])),
        notes = {
          ...reporting.taxNotes
        },
        key = taxNoteKey(year, type, id);
      if (Object.values(value).some(Boolean)) notes[key] = {
        ...value,
        title
      };else delete notes[key];
      await onSaveReporting({
        ...reporting,
        taxNotes: notes
      });
      dialog.current?.close();
      setDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <details className="tax-treatment-notes"><summary>Treatment Notes &amp; Sources{note ? ' · Saved' : ''}</summary><p className="hint">{type === 'group' ? 'Group decision' : 'Entry-specific exception'} · {year} · Your research and reasoning; separate from grouping review.</p>{note ? <div className="tax-note-content">{note.decision && <p><strong>Decision / Open Question</strong><br />{note.decision}</p>}{note.reason && <p><strong>Reason / Business Use</strong><br />{note.reason}</p>}{note.sources && <><strong>Sources</strong><Sources text={note.sources} /></>}{note.reviewedDate && <p>Reviewed · {new Date(note.reviewedDate + 'T12:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}</p>}</div> : <p className="hint">Optional: keep the explanation you will want next tax season.</p>}<button onClick={edit}>{note ? 'Edit Treatment Notes' : 'Add Treatment Notes'}</button>{draft && <dialog ref={dialog} className="tax-note-dialog" onCancel={e => {
      e.preventDefault();
      close();
    }}><form onSubmit={save}><h3>Treatment Notes &amp; Sources</h3><p>{title} · {year}</p>{error && <p role="alert">{error}</p>}{[['decision', 'Decision / Open Question', 2000], ['reason', 'Reason / Business Use', 4000], ['sources', 'Source Links / Publication References', 4000]].map(([key, label, max]) => <label key={key}>{label}<textarea value={draft[key]} maxLength={max} rows={key === 'decision' ? 2 : 3} disabled={busy} onChange={e => setDraft({
            ...draft,
            [key]: e.target.value
          })} /></label>)}<p className="hint">One source per line. Web links must start with https:// or http://. Publication names can be plain text.</p><label>Reviewed Date (Optional)<input type="date" value={draft.reviewedDate} disabled={busy} onChange={e => setDraft({
            ...draft,
            reviewedDate: e.target.value
          })} /></label><div className="report-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button className="primary" disabled={busy}>Save Treatment Notes</button></div></form></dialog>}</details>;
}
