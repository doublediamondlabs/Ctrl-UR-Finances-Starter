import { customerContacts, customerNames } from './customerContacts.js';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { combine } from './sharedInspections.js';
import { inspectionBriefRows, localToday } from './inspectionBrief.js';
export function BriefSheet({
  row
}) {
  const {
    profile: p,
    location: l,
    visit: v
  } = row;
  return <article className="inspection-brief-sheet"><div className="brief-mast"><strong>INSPECTION BRIEF</strong><span>{row.date} · {v.purpose || 'Purpose not recorded'}</span></div><h2>{customerNames(p) || 'Customer: confirm before departure'}</h2><div className="brief-facts"><section><h3>WHAT</h3><p>{[p.rvYear, p.rvMake, p.rvModel].filter(Boolean).join(' ') || 'Confirm RV details'}<br />VIN: {p.vin || '__________________________'}<br />Appointment ID: {p.appointmentId || 'Confirm'}</p></section><section><h3>WHEN</h3><p>{row.date}<br />Time: __________________<br />Visit status: {v.outcome || 'Not recorded'}</p></section><section><h3>WHERE</h3><p>{row.destinationName}<br />{l?.address || 'Confirm street address'}<br />{[l?.city, l?.state].filter(Boolean).join(', ')}{l?.zip ? ' ' + l.zip : ''}</p></section></div><section className="brief-contacts"><h3>WHO</h3>{customerContacts(p).map((c, i) => <div className="brief-person" key={i}><strong>{c.name || 'Confirm customer'}</strong><p>{c.phones.length ? c.phones.map((r, j) => <React.Fragment key={j}>Phone{r.label ? ' (' + r.label + ')' : ''}: {r.value}{r.preferred ? ' · Preferred' : ''}<br /></React.Fragment>) : <>Phone: __________________________<br /></>}{c.emails.map((r, j) => <React.Fragment key={j}>Email{r.label ? ' (' + r.label + ')' : ''}: {r.value}{r.preferred ? ' · Preferred' : ''}<br /></React.Fragment>)}</p></div>)}<p>{row.destinationName || 'Contact / location: confirm'}</p></section><section><h3>WHY / VISIT PURPOSE</h3><p>{v.purpose || 'Confirm visit purpose'}{v.note && ' — ' + v.note}</p></section><section className="brief-reminder"><h3>REMEMBER THIS NEXT TIME · CONTACTS & COORDINATION</h3><p>{row.reminder || 'No saved destination reminder. Contact / phone: __________________________'}</p></section>{row.missing.length > 0 && <p className="brief-confirm"><strong>Confirm before departure:</strong> {row.missing.join(' · ')}</p>}<section className="brief-writing"><h3>HOW / FIELD NOTES</h3>{['Before / coordination', 'During / findings', 'After / follow-up'].map(x => <div className="brief-lines" key={x}><strong>{x}</strong><div /><div /><div /></div>)}</section></article>;
}
export default function InspectionBrief({
  api,
  readBook
}) {
  const [date, setDate] = useState(localToday),
    [data, setData] = useState({
      rows: [],
      undated: 0
    }),
    [selected, setSelected] = useState([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false);
  const serial = useRef(0);
  async function load() {
    const n = ++serial.current;
    setBusy(true);
    setError('');
    setData({
      rows: [],
      undated: 0
    });
    setSelected([]);
    setPreview(false);
    try {
      const ctx = await api('inspection/context');
      const cfg = await api('years');
      const registry = combine(ctx.books.map(p => readBook(p.base64, p.year, true)), ctx.shared);
      if (n === serial.current) setData(inspectionBriefRows(registry, cfg.reporting?.savedDestinations || []));
    } catch (e) {
      if (n === serial.current) setError(e.message);
    } finally {
      if (n === serial.current) setBusy(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      serial.current++;
      document.body.classList.remove('printing-inspection-brief');
    };
  }, []);
  useEffect(() => {
    setSelected(data.rows.filter(r => r.date === date).map(r => r.key));
    setPreview(false);
  }, [date, data]);
  useEffect(() => {
    const done = () => document.body.classList.remove('printing-inspection-brief');
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);
  const day = data.rows.filter(r => r.date === date),
    chosen = day.filter(r => selected.includes(r.key));
  function print() {
    document.body.classList.add('printing-inspection-brief');
    try {
      window.print();
    } catch (e) {
      document.body.classList.remove('printing-inspection-brief');
      setError(e.message);
    }
  }
  return <section className="panel inspection-brief"><h2>Inspection Brief</h2><p className="hint">Review → print → clip → pack out. Uses recorded visit dates across linked years. Canceled visits and mileage-only trips are excluded. Nothing here changes your records.</p><div className="brief-controls"><label>Visit date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><button disabled={busy} onClick={load}>Refresh Inspections</button><button disabled={busy || !chosen.length} onClick={() => setPreview(!preview)}>{preview ? 'Hide Preview' : 'Preview Selected'}</button><button disabled={busy || !chosen.length} onClick={print}>Print / Save as PDF</button></div>{busy ? <p role="status">Reading linked inspections…</p> : error ? <p role="alert" className="error">Could not load a complete inspection list. {error} Check linked files and refresh.</p> : <><p className="hint">Time and contact details are not inferred. Saved destination reminders supply any contacts you recorded there. Refresh after changes in another window.</p>{data.undated > 0 && <p className="notice">{data.undated} visit(s) have no date and cannot appear on a dated brief. Review them in Business workspace.</p>}{day.length ? <div className="brief-choices">{day.map(r => <label key={r.key}><input type="checkbox" checked={selected.includes(r.key)} onChange={e => {
            setSelected(e.target.checked ? [...selected, r.key] : selected.filter(k => k !== r.key));
          }} />{customerNames(r.profile) || 'Customer not recorded'} · {r.destinationName || 'Location not recorded'} · {r.visit.purpose} · {r.visit.outcome}</label>)}</div> : <p>No dated inspections found for this day.</p>}<p className="hint">One brief starts on each new printed page. Additional contacts and long notes continue onto another page as needed. Contact blocks and individual writing areas stay together where they fit; check print preview. Use Letter paper and turn off browser headers/footers.</p>{preview && <div className="brief-preview">{chosen.map(r => <BriefSheet key={r.key} row={r} />)}</div>}</>}{createPortal(<div className="inspection-brief-printout">{chosen.map(r => <BriefSheet key={r.key} row={r} />)}</div>, document.body)}</section>;
}
