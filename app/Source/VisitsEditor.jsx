import VisitLocation from './VisitLocation.jsx';
import React, { useState, useEffect } from 'react';
export const newVisit = () => ({
  id: crypto.randomUUID(),
  date: '',
  purpose: 'Repair verification',
  outcome: 'Scheduled',
  vehicle: '',
  miles: null,
  charge: 'undecided',
  quotedFee: null,
  note: ''
});
export default function VisitsEditor({
  visits,
  events,
  onChange,
  destinations = [],
  profile
}) {
  const [expanded, setExpanded] = useState(() => visits.filter(v => !v.date).map(v => v.id));
  useEffect(() => {
    setExpanded(ids => [...new Set([...ids, ...visits.filter(v => !v.date).map(v => v.id)])]);
  }, [visits.length]);
  const change = (i, p) => onChange(visits.map((v, n) => i === n ? {
    ...v,
    ...p
  } : v));
  return <section><h3>Visits & mileage</h3><p className="hint">Each visit keeps its own date and outcome. Enter actual miles driven; a quoted fee never creates income.</p>{visits.map((v, i) => <details className="visit-editor" key={v.id} open={expanded.includes(v.id)}><summary onClick={e => {
        e.preventDefault();
        setExpanded(ids => ids.includes(v.id) ? ids.filter(id => id !== v.id) : [...ids, v.id]);
      }}>{v.date || 'Date not entered'} · {v.purpose} · {v.outcome} · {v.vehicle || 'Vehicle not recorded'} · {v.miles ?? 'Unknown'} miles</summary><VisitLocation profile={profile} visit={v} items={destinations} onChange={patch => change(i, patch)} /><div className="form-grid"><label>Visit date<input type="date" value={v.date} onChange={e => change(i, {
            date: e.target.value
          })} /></label><label>Visit purpose<select value={v.purpose} onChange={e => change(i, {
            purpose: e.target.value
          })}>{['Initial inspection', 'Repair verification', 'Other follow-up'].map(x => <option key={x}>{x}</option>)}</select></label><label>Visit outcome<select value={v.outcome} onChange={e => change(i, {
            outcome: e.target.value
          })}>{['Scheduled', 'Completed', 'Partially completed', 'Not performed', 'Canceled', 'Not reviewed'].map(x => <option key={x}>{x}</option>)}</select></label><label>Visit vehicle<select value={v.vehicle} onChange={e => change(i, {
            vehicle: e.target.value
          })}><option value="">Not recorded</option>{['Truck', 'Van', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label><label>Actual miles driven<input type="number" min="0" step="0.1" value={v.miles ?? ''} onChange={e => change(i, {
            miles: e.target.value === '' ? null : Number(e.target.value)
          })} /></label><label>Charge treatment<select value={v.charge} onChange={e => change(i, {
            charge: e.target.value
          })}><option value="undecided">Not decided yet</option><option value="courtesy">Courtesy / no charge</option><option value="included">Included in original fee</option><option value="separate">Separately charged</option></select></label>{v.charge === 'separate' && <label>Visit quoted fee (not income)<input type="number" step="0.01" min="0" value={v.quotedFee ?? ''} onChange={e => change(i, {
            quotedFee: e.target.value === '' ? null : Number(e.target.value)
          })} /></label>}</div><label>Visit notes / repairs checked<textarea maxLength={5000} value={v.note || ''} onChange={e => change(i, {
          note: e.target.value
        })} /></label>{events.some(e => e.visitId === v.id) ? <p className="hint">A payment/refund is linked to this visit. Reassign its Visit field or choose Whole job before removing the visit.</p> : <button type="button" onClick={() => {
        if (confirm('Remove this visit and its mileage? Payments and refunds will not be deleted.')) onChange(visits.filter(x => x.id !== v.id));
      }}>Remove Visit</button>}</details>)}<button type="button" onClick={() => onChange([...visits, newVisit()])}>Add Visit</button></section>;
}
