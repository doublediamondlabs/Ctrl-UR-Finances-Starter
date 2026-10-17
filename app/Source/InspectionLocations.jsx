import React from 'react';
import DealerVisits from './DealerVisits.jsx';
import LocationReview from './LocationReview.jsx';
import { locationTotals } from './dealerVisits.js';
export default function InspectionLocations({
  data,
  view,
  onView,
  vehicle,
  onVehicle,
  ...props
}) {
  const types = [['all', 'All Locations'], ['dealers', 'Dealers'], ['private', 'Private Sales']];
  const rows = [['Dealers', data.groups], ['Private Sales', data.privateGroups], ['All Locations', [...data.groups, ...data.privateGroups]]];
  return <section className="inspection-locations"><nav className="income-tabs" aria-label="Inspection location types">{types.map(([key, label]) => <button key={key} className={view === key ? 'primary' : ''} aria-pressed={view === key} onClick={() => onView(key)}>{label}</button>)}</nav>
 <div className="report-controls"><label>Location Visit Vehicle<select value={vehicle} onChange={e => onVehicle(e.target.value)}>{['All', 'Truck', 'Van', 'Other', 'Unassigned'].map(v => <option key={v}>{v}</option>)}</select></label></div>
 <div className="entry-guidance"><strong>How Location Counts Work</strong><p>Counts use the selected year, months and vehicle. Inspection jobs count once per location type; recorded visits include return visits. A job visiting both types counts once in All Locations, so the job counts may not add up. Visit counts are not unique round trips. Reviewed mileage-only travel is included in visits and miles, not inspection jobs. Scheduled visits are excluded.</p></div>
 {view === 'all' ? <><h3>All Inspection Locations</h3><div className="table-wrap"><table><thead><tr><th>Location Type</th><th>Distinct Inspection Jobs</th><th>Recorded Visits</th><th>Recorded Miles</th></tr></thead><tbody>{rows.map(([label, groups]) => {
              const t = locationTotals(groups);
              return <tr key={label}><th>{label}</th><td>{t.jobs}</td><td>{t.visits}</td><td>{t.miles.toLocaleString()} mi{t.missingMiles > 0 && <small> · {t.missingMiles} visits missing mileage</small>}</td></tr>;
            })}</tbody></table></div><div className="entry-guidance"><strong>Explore the Visits</strong><p>Choose Dealers or Private Sales above to explore the underlying visits. Entries awaiting classification or acknowledged as unavailable remain outside these totals.</p></div></> : <DealerVisits key={view} {...props} data={{
      ...data,
      groups: view === 'private' ? data.privateGroups : data.groups
    }} vehicle={vehicle} onVehicle={onVehicle} privateSales={view === 'private'} showControls={false} showReview={false} />}
 <LocationReview data={data} {...props} />
 </section>;
}
