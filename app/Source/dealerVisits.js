import { ledger } from './inspectionIncome.js';
const clean = value => (value || '').trim().replace(/\s+/g, ' ');
const norm = value => clean(value).toLowerCase();

// Reporting only: use the location and mileage recorded on the visit, never
// today's saved defaults. A follow-up must not inherit the initial location.
export function dealerVisits(book, trips, vehicle = 'All', acknowledgements = {}, includePrivate = false) {
  const jobs = ledger(book).jobs,
    groups = new Map(),
    privateGroups = new Map(),
    review = [],
    acknowledged = [];
  let excluded = 0;
  for (const row of trips) {
    if (vehicle !== 'All' && row.vehicle !== vehicle) continue;
    const job = jobs[row.id],
      visit = job?.visits?.find(v => v.id === row.visitId);
    const location = visit?.destination || (visit?.purpose === 'Initial inspection' ? job?.profile : null);
    const type = location?.locationType || (visit?.destination?.name ? 'dealer' : '');
    if (type === 'private' && !includePrivate) continue;
    if (visit?.outcome === 'Scheduled') {
      excluded++;
      continue;
    }
    const happened = visit && (job.entryType === 'travel' ? job.travelReview === 'reviewed' && visit.miles > 0 : ['Completed', 'Partially completed'].includes(visit.outcome) || visit.outcome === 'Not performed' && visit.miles > 0);
    const name = clean(location?.dealerName) || clean(location?.name);
    if (!row.inspectionDate || !happened || !['dealer', 'private'].includes(type) || type === 'dealer' && !name) {
      const reason = !visit ? 'Original entry needs visit details' : !row.inspectionDate ? 'Visit date missing' : !happened ? 'Travel not confirmed by visit outcome' : !location ? 'Visit location missing' : 'Dealer name or location type missing';
      const reviewKey = JSON.stringify([book.year, row.id, row.visitId || 'original']);
      const signature = JSON.stringify([row.inspectionDate, row.month, row.vehicle, row.miles, row.purpose, row.inspectionStatus, location || null, job?.travelReview || '', row.note || '', job?.reason || '', reason]);
      const item = {
          ...row,
          reason,
          reviewKey,
          signature
        },
        ack = acknowledgements[reviewKey];
      if (ack?.signature === signature) acknowledged.push({
        ...item,
        ack
      });else review.push(item);
      continue;
    }
    const address = clean(location.address),
      city = clean(location.city),
      state = clean(location.state);
    const isPrivate = type === 'private',
      target = isPrivate ? privateGroups : groups;
    const key = JSON.stringify((isPrivate ? [city, state] : [name, address, city, state]).map(norm));
    if (!target.has(key)) target.set(key, {
      key,
      name: isPrivate ? [city, state].filter(Boolean).join(', ') || 'Location not recorded' : name,
      address: isPrivate ? '' : address,
      city,
      state,
      rows: [],
      miles: 0,
      missingMiles: 0,
      missingLocation: isPrivate ? !city || !state : !address || !city || !state
    });
    const group = target.get(key);
    group.rows.push({
      ...row,
      entryType: job.entryType || 'inspection',
      customer: clean(job.profile?.customerName),
      rv: [job.profile?.rvYear, job.profile?.rvMake, job.profile?.rvModel].filter(Boolean).join(' '),
      visitAddress: [address, city, state, clean(location.zip)].filter(Boolean).join(', ')
    });
    if (Number.isFinite(row.miles)) group.miles += row.miles;else group.missingMiles++;
  }
  return {
    groups: [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name) || a.key.localeCompare(b.key)),
    privateGroups: [...privateGroups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    review,
    acknowledged,
    excluded
  };
}
export function dealerVisitCSV(data) {
  return [[], ['Recorded Dealer Visits — Not Unique Round Trips'], ['Dealer', 'Address', 'City', 'State', 'Recorded Visits', 'Recorded Miles', 'Visits Missing Mileage'], ...data.groups.map(g => [g.name, g.address, g.city, g.state, g.rows.length, g.miles, g.missingMiles]), [], ['Dealer', 'Date', 'Month', 'Vehicle', 'Recorded Miles', 'Inspection / Travel', 'Purpose', 'Outcome'], ...data.groups.flatMap(g => g.rows.map(r => [g.name, r.inspectionDate, r.month, r.vehicle, r.miles, r.label, r.purpose, r.inspectionStatus])), [], ['Visits / Original Rows Needing Classification'], ['Record', 'Date / Month', 'Reason'], ...data.review.map(r => [r.label, r.inspectionDate || r.month, r.reason]), [], ['Reviewed — Details Unavailable'], ['Record', 'Date / Month', 'Reason', 'Explanation', 'Reviewed At'], ...(data.acknowledged || []).map(r => [r.label, r.inspectionDate || r.month, r.reason, r.ack.note, r.ack.reviewedAt]), ['Scheduled visits excluded', data.excluded]];
}
export const inspectionLocations = (book, trips, vehicle = 'All', acknowledgements = {}) => dealerVisits(book, trips, vehicle, acknowledgements, true);
export function locationTotals(groups) {
  const rows = groups.flatMap(g => g.rows);
  return {
    jobs: new Set(rows.filter(r => r.entryType !== 'travel').map(r => r.id)).size,
    visits: rows.length,
    miles: groups.reduce((n, g) => n + g.miles, 0),
    missingMiles: groups.reduce((n, g) => n + g.missingMiles, 0)
  };
}
export function inspectionLocationCSV(data) {
  return [...dealerVisitCSV(data), [], ['Private Sales by City and State'], ['City', 'State', 'Distinct Inspection Jobs', 'Recorded Visits', 'Recorded Miles', 'Visits Missing Mileage'], ...data.privateGroups.map(g => {
    const t = locationTotals([g]);
    return [g.city, g.state, t.jobs, t.visits, t.miles, t.missingMiles];
  }), [], ['Private Sale Customer', 'RV', 'Date', 'Month', 'Vehicle', 'Recorded Miles', 'Address', 'Purpose', 'Outcome'], ...data.privateGroups.flatMap(g => g.rows.map(r => [r.customer || r.label, r.rv, r.inspectionDate, r.month, r.vehicle, r.miles, r.visitAddress, r.purpose, r.inspectionStatus])), [], ['Location Type', 'Distinct Inspection Jobs', 'Recorded Visits', 'Recorded Miles'], ...['Dealers', 'Private Sales', 'All Locations'].map(label => {
    const groups = label === 'Dealers' ? data.groups : label === 'Private Sales' ? data.privateGroups : [...data.groups, ...data.privateGroups];
    const t = locationTotals(groups);
    return [label, t.jobs, t.visits, t.miles];
  })];
}
