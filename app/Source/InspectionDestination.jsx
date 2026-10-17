import React from 'react';
import DestinationReminder from './DestinationReminder.jsx';
import { states } from './inspectionDetails.js';
export const initialVisitIndex = visits => {
  return visits.findIndex(v => v.purpose === 'Initial inspection');
};
export function locationSnapshot(profile) {
  return {
    locationType: profile.locationType || '',
    dealerName: profile.dealerName || '',
    address: profile.address || '',
    city: profile.city || '',
    state: profile.state || '',
    zip: profile.zip || ''
  };
}
export function applyLocationProfile(job, profile) {
  const i = initialVisitIndex(job.visits || []);
  return {
    ...job,
    profile,
    visits: (job.visits || []).map((v, n) => n === i && v.destinationForLocation && v.destination ? {
      ...v,
      destination: {
        ...v.destination,
        ...locationSnapshot(profile),
        name: v.destinationSave === 'new' && (!v.destination.name || v.destination.name === job.profile.dealerName) ? profile.dealerName || v.destination.name : v.destination.name
      }
    } : v)
  };
}
export function chooseInspectionDestination(job, destination) {
  const i = initialVisitIndex(job.visits || []);
  if (!job.visits?.[i]) return job;
  const profile = {
    ...job.profile,
    locationType: destination.locationType || 'dealer',
    dealerName: destination.dealerName || destination.name,
    address: destination.address || '',
    city: destination.city || '',
    state: destination.state || '',
    zip: destination.zip || ''
  };
  return {
    ...job,
    profile,
    visits: job.visits.map((v, n) => n === i ? {
      ...v,
      destination: {
        ...structuredClone(destination),
        ...locationSnapshot(profile)
      },
      destinationForLocation: true,
      destinationSave: '',
      destinationReminderSave: false,
      miles: destination.miles
    } : v)
  };
}
export default function InspectionDestination({
  job,
  items,
  onChange
}) {
  const profile = job.profile || {},
    i = initialVisitIndex(job.visits || []),
    v = job.visits?.[i];
  const d = v?.destinationForLocation ? v.destination : null,
    existing = items.find(x => x.id === d?.id),
    type = profile.locationType;
  const choices = items.filter(x => (x.locationType || 'dealer') === type);
  const selected = existing && choices.some(x => x.id === existing.id) ? existing : null;
  const update = patch => onChange({
    ...job,
    visits: job.visits.map((x, n) => n === i ? {
      ...x,
      ...patch
    } : x)
  });
  const set = (key, value) => {
    let next = applyLocationProfile(job, {
      ...profile,
      [key]: value
    });
    if (key === 'locationType' && value !== type) next = {
      ...next,
      visits: next.visits.map((x, n) => n === i ? {
        ...x,
        destination: null,
        destinationForLocation: false,
        destinationSave: '',
        destinationReminderSave: false
      } : x)
    };
    onChange(next);
  };
  const choose = id => {
    const saved = choices.find(x => x.id === id);
    if (saved) onChange(chooseInspectionDestination(job, saved));else if (v) update({
      destination: null,
      destinationForLocation: false,
      destinationSave: '',
      destinationReminderSave: false
    });
  };
  const saveChoice = checked => {
    if (!checked) {
      update({
        destinationSave: ''
      });
      return;
    }
    update({
      destination: d || {
        id: crypto.randomUUID(),
        name: type === 'dealer' ? profile.dealerName || '' : '',
        notes: '',
        ...locationSnapshot(profile)
      },
      destinationForLocation: true,
      destinationSave: existing ? 'update' : 'new'
    });
  };
  return <><div className="form-grid"><label>Location type<select data-detail="locationType" value={type || ''} onChange={e => set('locationType', e.target.value)}><option value="">Choose Private Sale or Dealer</option><option value="dealer">Dealer</option><option value="private">Private Sale</option></select></label>
 {type === 'dealer' && <><label>Dealer name<select aria-label="Dealer name" disabled={!v} value={selected?.id || ''} onChange={e => choose(e.target.value)}><option value="">Enter a new dealer / use current fields</option>{choices.map(x => <option key={x.id} value={x.id}>{x.name}{[x.address, x.city, x.state].filter(Boolean).length ? ' — ' + [x.address, x.city, x.state].filter(Boolean).join(', ') : ''}</option>)}</select></label>{(!selected || !!v?.destinationSave) && <label>{selected ? 'Dealer name for this inspection' : 'Dealer name (manual entry)'}<input data-detail="dealerName" maxLength={200} value={profile.dealerName || ''} onChange={e => set('dealerName', e.target.value)} /></label>}</>}
 {type === 'private' && <label>Private-sale location<select aria-label="Private-sale location" disabled={!v} value={selected?.id || ''} onChange={e => choose(e.target.value)}><option value="">Enter a new private-sale location / use current fields</option>{choices.map(x => <option key={x.id} value={x.id}>{x.name}{x.address ? ' — ' + x.address : ''}</option>)}</select></label>}
 <label>City<input data-detail="city" maxLength={120} value={profile.city || ''} onChange={e => set('city', e.target.value)} /></label><label>State<select data-detail="state" value={profile.state || ''} onChange={e => set('state', e.target.value)}><option value="">Choose state</option>{states.map(x => <option key={x}>{x}</option>)}</select></label><label>ZIP code (optional)<input type="text" maxLength={10} data-detail="zip" value={profile.zip || ''} onChange={e => set('zip', e.target.value)} /></label><label>Street address (optional)<input data-detail="address" maxLength={500} value={profile.address || ''} onChange={e => set('address', e.target.value)} /></label></div>
 {selected && <DestinationReminder key={selected.id} saved={selected} destination={d} pending={v.destinationReminderSave} onChange={reminder => update({
      destination: {
        ...d,
        reminder
      },
      destinationReminderSave: true
    })} />}
 {type && <p className="hint">Choose a saved {type === 'dealer' ? 'dealer' : 'private-sale location'} to fill its address and the initial visit’s usual round-trip mileage, or enter the fields manually. This is the same list used in Business Defaults and Visits &amp; Mileage.</p>}
 {v && type && <><label className="income-check"><input type="checkbox" checked={!!v.destinationSave} onChange={e => saveChoice(e.target.checked)} />{existing ? 'Update saved destination with these location details and initial-visit mileage' : 'Save this location for future trips'}</label>{d && v.destinationSave && <label>Destination short / common name<input maxLength={150} value={d.name || ''} onChange={e => update({
          destination: {
            ...d,
            name: e.target.value
          }
        })} /></label>}{d && v.destinationSave === 'new' && <label>Remember This Next Time (optional)<textarea maxLength={1000} value={d.reminder || ''} onChange={e => update({
          destination: {
            ...d,
            reminder: e.target.value
          }
        })} /></label>}{selected && <p className="hint">Dealer / location: {profile.dealerName || selected.name}. Initial visit: {v.miles ?? 'not entered'} miles. Adjust actual mileage under Visits &amp; Mileage.</p>}{selected && (!selected.city || !selected.state) && <p className="hint">Complete any missing city/state fields and check Update saved destination to reuse them next time.</p>}</>}
 {!v && <p className="hint">Manual location entry is available. Add an Initial inspection visit under Visits &amp; Mileage to select or save a destination and its mileage.</p>}
 </>;
}
