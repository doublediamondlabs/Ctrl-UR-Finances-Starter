import React from 'react';
import DestinationReminder from './DestinationReminder.jsx';
import { states } from './inspectionDetails.js';
export function DestinationFields({
  value,
  onChange,
  mileage = true,
  reminder = true
}) {
  return <><div className="form-grid"><label>Short / common name<input maxLength={150} value={value.name || ''} onChange={e => onChange({
          ...value,
          name: e.target.value
        })} /></label><label>Address (optional)<input maxLength={500} value={value.address || ''} onChange={e => onChange({
          ...value,
          address: e.target.value
        })} /></label><label>City (optional)<input maxLength={120} value={value.city || ''} onChange={e => onChange({
          ...value,
          city: e.target.value
        })} /></label><label>State (optional)<select value={value.state || ''} onChange={e => onChange({
          ...value,
          state: e.target.value
        })}><option value="">Choose state</option>{states.map(x => <option key={x}>{x}</option>)}</select></label><label>ZIP code (optional)<input type="text" maxLength={10} value={value.zip || ''} onChange={e => onChange({
          ...value,
          zip: e.target.value
        })} /></label><label>Location type<select value={value.locationType || ''} onChange={e => onChange({
          ...value,
          locationType: e.target.value
        })}><option value="">Dealer (default)</option><option value="dealer">Dealer</option><option value="private">Private Sale</option></select></label><label>Dealer name (optional)<input maxLength={200} value={value.dealerName || ''} onChange={e => onChange({
          ...value,
          dealerName: e.target.value
        })} /></label>{mileage && <label>Usual round-trip miles<input type="number" min="0" max="100000" step="0.1" value={value.miles ?? ''} onChange={e => onChange({
          ...value,
          miles: e.target.value === '' ? null : Number(e.target.value)
        })} /></label>}</div><label>Destination notes (optional)<input maxLength={1000} value={value.notes || ''} onChange={e => onChange({
        ...value,
        notes: e.target.value
      })} /></label>{reminder && <label>Remember This Next Time (optional)<textarea maxLength={1000} value={value.reminder || ''} onChange={e => onChange({
        ...value,
        reminder: e.target.value
      })} /><span className="hint">Shown when this saved location is selected for an inspection or visit.</span></label>}</>;
}
export function DestinationPicker({
  visit,
  items,
  onChange
}) {
  const d = visit.destination,
    existing = items.find(x => x.id === d?.id);
  return <section className="workflow-decision"><label>Saved destination<select value={existing?.id || (d ? 'new' : '')} onChange={e => {
        const selected = items.find(x => x.id === e.target.value);
        if (selected) onChange({
          destination: structuredClone(selected),
          miles: selected.miles,
          destinationForLocation: false,
          destinationSave: '',
          destinationReminderSave: false
        });else onChange({
          destination: e.target.value === 'new' ? {
            id: crypto.randomUUID(),
            name: '',
            address: '',
            notes: ''
          } : null,
          destinationForLocation: false,
          destinationReminderSave: false,
          destinationSave: e.target.value === 'new' ? 'new' : ''
        });
      }}><option value="">No saved destination</option><option value="new">New destination…</option>{items.map(x => <option key={x.id} value={x.id}>{x.name}{x.address ? ' — ' + x.address : ''}</option>)}</select></label>{d && <><p className="hint">{existing ? `Usual round-trip mileage: ${existing.miles} miles. Selecting a destination fills the visit mileage below; check it against this trip.` : 'Enter the round-trip mileage in Actual miles driven below.'}</p><DestinationReminder key={d.id} saved={existing} destination={d} pending={visit.destinationReminderSave} onChange={reminder => onChange({
        destination: {
          ...d,
          reminder
        },
        destinationReminderSave: true
      })} /><DestinationFields value={d} mileage={false} reminder={!existing} onChange={destination => onChange({
        destination,
        destinationForLocation: false
      })} /><label className="income-check"><input type="checkbox" checked={!!visit.destinationSave} onChange={e => onChange({
          destinationSave: e.target.checked ? existing ? 'update' : 'new' : ''
        })} />{existing ? 'Update saved destination with this address, notes and visit mileage' : 'Save for future trips'}</label><p className="hint">Saved destinations change only when you save the inspection. Earlier visits keep their recorded details and mileage.</p></>}</section>;
}
export default function Destinations({
  items,
  onChange
}) {
  return <section><h3>Saved Destinations & Mileage</h3><p className="hint">Use common names such as Bish’s Murray or Fun Town Anna. Addresses help distinguish branches. Mileage is the usual round trip from your business starting point. Changes here never rewrite earlier visits.</p>{items.map((d, i) => <details key={d.id}><summary>{d.name || 'New destination'} · {d.miles ?? 'Unknown'} round-trip miles</summary><DestinationFields value={d} onChange={value => onChange(items.map((x, n) => n === i ? value : x))} /><button type="button" onClick={() => {
        if (confirm('Remove this saved destination? Existing visits keep their details and mileage.')) onChange(items.filter(x => x.id !== d.id));
      }}>Remove Saved Destination</button></details>)}<button type="button" onClick={() => onChange([...items, {
      id: crypto.randomUUID(),
      name: '',
      address: '',
      notes: '',
      miles: null
    }])}>Add Destination</button></section>;
}
