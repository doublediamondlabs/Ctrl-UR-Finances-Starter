import VisitLocation from './VisitLocation.jsx';
import React from 'react';
import { Guidance } from './SettlementEditor.jsx';
export default function TravelEditor({
  job,
  onChange,
  retainedPeriod,
  destinations = []
}) {
  const set = (key, value) => onChange({
    ...job,
    [key]: value
  });
  const change = (id, key, value) => onChange({
    ...job,
    visits: job.visits.map(v => v.id === id ? {
      ...v,
      [key]: value
    } : v)
  });
  return <section className="travel-editor"><h3>Mileage-Only / Other Travel</h3><Guidance title="Keep The Travel Record"><p>This records travel without a customer, payment or bank deposit. Unknown details can stay blank under Needs Research. Undated mileage remains in {retainedPeriod}; a date assigns it to that date’s month and year.</p></Guidance><div className="form-grid"><label>Travel description<input maxLength={200} value={job.travelDescription || ''} onChange={e => set('travelDescription', e.target.value)} /></label><label>Review status<select value={job.travelReview || 'research'} onChange={e => set('travelReview', e.target.value)}><option value="research">Needs Research</option><option value="reviewed">Reviewed</option></select></label></div><label>Travel purpose (leave blank if unknown)<input maxLength={1000} value={job.travelPurpose || ''} onChange={e => set('travelPurpose', e.target.value)} /></label>{job.visits.map((v, i) => <section className="travel-trip" key={v.id}><h4>{job.visits.length > 1 ? 'Trip ' + (i + 1) : 'Travel Details'}</h4><div className="form-grid"><label>Travel date (if known)<input type="date" value={v.date || ''} onChange={e => change(v.id, 'date', e.target.value)} /></label><label>Vehicle (if known)<select value={v.vehicle || ''} onChange={e => change(v.id, 'vehicle', e.target.value)}><option value="">Not Known Yet</option>{['Truck', 'Van', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label><label>Miles driven<input type="number" min="0" step="0.1" value={v.miles ?? ''} onChange={e => change(v.id, 'miles', e.target.value === '' ? null : Number(e.target.value))} /></label></div><VisitLocation visit={v} items={destinations} onChange={patch => onChange({
        ...job,
        visits: job.visits.map(x => x.id === v.id ? {
          ...x,
          ...patch
        } : x)
      })} />{v.note && <p className="hint">Original visit note: {v.note}</p>}</section>)}<label>Travel notes<textarea maxLength={5000} value={job.reason || ''} onChange={e => set('reason', e.target.value)} /></label></section>;
}
