import { locationTotals } from './dealerVisits.js';
import LocationReview from './LocationReview.jsx';
import React, { useState } from 'react';
import { MONTHS } from './inspectionIncome.js';
export default function DealerVisits({
  data,
  vehicle,
  onVehicle,
  onOpen,
  start,
  end,
  year,
  onReview,
  busy = false,
  privateSales = false,
  showControls = true,
  showReview = true
}) {
  const [selected, setSelected] = useState('');
  const active = data.groups.find(g => g.key === selected) || data.groups[0];
  return <section className="dealer-visits"><h3>{privateSales ? 'Private-Sale Visits' : 'Recorded Dealer Visits'}</h3>
 {showControls && <> <p className="hint">One count per recorded visit, including return visits and unsuccessful inspection visits with recorded travel. Multiple inspections on one outing can have separate visit records; these counts are not unique round trips. Scheduled visits are excluded. Unconfirmed or unidentified visits appear below for review.</p>
 <label>Dealer Visit Vehicle<select value={vehicle} onChange={e => onVehicle(e.target.value)}>{['All', 'Truck', 'Van', 'Other', 'Unassigned'].map(v => <option key={v}>{v}</option>)}</select></label>
</>}
 <div className="business-report-cards"><article><small>Distinct Inspection Jobs</small><strong>{locationTotals(data.groups).jobs}</strong></article><article><small>{privateSales ? 'Cities / Areas' : 'Dealer Locations'}</small><strong>{data.groups.length}</strong></article><article><small>{privateSales ? 'Recorded Private-Sale Visits' : 'Recorded Dealer Visits'}</small><strong>{data.groups.reduce((n, g) => n + g.rows.length, 0)}</strong></article><article><small>{privateSales ? 'Recorded Private-Sale Miles' : 'Recorded Dealer Miles'}</small><strong>{data.groups.reduce((n, g) => n + g.miles, 0).toLocaleString()} mi</strong></article></div>
 <div className="entry-guidance"><strong>About These Groups</strong><p>{privateSales ? 'Grouped by city and state. Expand a month to see customers, RVs and individual addresses.' : 'Grouped by recorded dealer name, street address, city and state. Spelling or address differences remain separate.'} Mileage comes from each visit; changing a saved destination does not change this history.</p></div>
 <nav className="manufacturer-tabs dealer-tabs" aria-label={privateSales ? 'Private-sale areas' : 'Dealer locations'}>{data.groups.map(g => <button key={g.key} type="button" className={active?.key === g.key ? 'primary' : ''} aria-pressed={active?.key === g.key} onClick={() => setSelected(g.key)} title={[g.address, g.city, g.state].filter(Boolean).join(', ')}><span>{g.name}{!privateSales && <small>{[g.city, g.state].filter(Boolean).join(', ') || 'Location incomplete'}</small>}</span><span className="manufacturer-count">{g.rows.length}</span></button>)}</nav>
 {data.groups.filter(g => g.key === active?.key).map(g => <section key={g.key} className="manufacturer-records"><h3>{g.name} · {g.rows.length} recorded visit{g.rows.length === 1 ? '' : 's'} · {g.miles.toLocaleString()} mi</h3>
 {!privateSales && <p>{[g.address, g.city, g.state].filter(Boolean).join(', ')}</p>}{g.missingLocation && <p className="hint">{privateSales ? 'City/state details are incomplete for this area.' : 'Location details are incomplete; this group may need review before comparing branches.'}</p>}{g.missingMiles > 0 && <p className="hint">{g.missingMiles} visit(s) have missing mileage, excluded from the mileage total.</p>}
 {MONTHS.slice(start, end + 1).filter(m => g.rows.some(r => r.month === m)).map(m => {
        const rows = g.rows.filter(r => r.month === m);
        return <details key={m} className="report-detail"><summary>{m} {year} · {rows.length} visits · {rows.reduce((n, r) => n + (Number.isFinite(r.miles) ? r.miles : 0), 0).toLocaleString()} mi</summary>{rows.map(r => <article key={r.id + ':' + r.visitId}><strong>{r.inspectionDate} · {privateSales ? r.customer || r.label : r.label}</strong>{privateSales && <><p>{r.rv || 'RV details not recorded'}</p><small>{r.visitAddress || 'Street address not recorded'}</small></>}<p>{r.vehicle} · {r.miles ?? 'Unknown'} mi · {r.purpose} · {r.inspectionStatus}</p><button disabled={!onOpen} onClick={() => onOpen({
              ...r,
              activityDate: r.inspectionDate
            })}>Open Record</button></article>)}</details>;
      })}</section>)}
 {!data.groups.length && <p>No confirmed {privateSales ? 'private-sale' : 'dealer'} visits match this period and vehicle.</p>}
 {showReview && <LocationReview data={data} onReview={onReview} onOpen={onOpen} busy={busy} />}
 </section>;
}
