import React, { useState } from 'react';
import { DestinationPicker, DestinationFields } from './Destinations.jsx';
export function copyMainLocation(profile) {
  return {
    destination: {
      id: crypto.randomUUID(),
      name: (profile.dealerName || 'Inspection location').slice(0, 150),
      notes: '',
      ...Object.fromEntries(['locationType', 'dealerName', 'address', 'city', 'state', 'zip'].map(k => [k, profile[k] || '']))
    },
    destinationForLocation: false,
    destinationSave: '',
    destinationReminderSave: false
  };
}
export default function VisitLocation({
  visit,
  profile,
  items = [],
  onChange
}) {
  const [showSaved, setShowSaved] = useState(() => !!items.find(d => d.id === visit.destination?.id));
  const useMain = () => {
    onChange(copyMainLocation(profile));
    setShowSaved(false);
  };
  const oneTime = () => {
    onChange({
      destination: {
        id: crypto.randomUUID(),
        name: '',
        address: '',
        notes: '',
        locationType: 'dealer'
      },
      destinationForLocation: false,
      destinationSave: '',
      destinationReminderSave: false
    });
    setShowSaved(false);
  };
  const d = visit.destination,
    existing = items.find(x => x.id === d?.id);
  return <section className="visit-location"><h4>Location for This Visit</h4><div className="income-tabs">
 {profile && <button type="button" disabled={!profile.locationType} onClick={useMain}>Use Main Inspection Location</button>}
 <button type="button" onClick={() => setShowSaved(true)}>Choose Saved Destination</button>
 <button type="button" onClick={oneTime}>Enter One-Time Location</button></div>
 <p className="hint">Each visit can have its own branch or address. Using the main location copies its current details without changing actual miles. A one-time location does not need to be added to Business Defaults.</p>
 {showSaved ? <DestinationPicker visit={visit} items={items} onChange={onChange} /> : d ? <><DestinationFields value={d} mileage={false} reminder={false} onChange={destination => onChange({
        destination,
        destinationForLocation: false
      })} /><label className="income-check"><input type="checkbox" checked={!!visit.destinationSave} onChange={e => onChange({
          destinationSave: e.target.checked ? existing ? 'update' : 'new' : ''
        })} />{existing ? 'Update saved destination with these details and visit mileage' : 'Also save this location for future trips (optional)'}</label><p className="hint">These location details belong to this visit. Check the Actual miles driven field separately.</p></> : <p className="hint">{visit.purpose === 'Initial inspection' && profile?.locationType ? 'The main inspection location is used for this initial visit until you choose a separate location.' : 'No visit-specific location recorded. Choose a location above if known.'}</p>}
 </section>;
}
