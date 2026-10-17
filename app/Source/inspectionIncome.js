import { validateCustomers } from './customerContacts.js';
import { inspectionLabel, states } from './inspectionDetails.js';
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const ledger = b => b.inspectionLedger || {
  jobs: {},
  events: [],
  payouts: [],
  retired: []
};
export const cents = n => Math.round(Number(n) * 100);
export const total = rows => rows.reduce((s, e) => s + (Number.isFinite(e.amount) ? cents(e.amount) : 0), 0) / 100;
export const jobLabel = (b, id) => {
  const job = ledger(b).jobs[id];
  if (job?.entryType === 'travel') return job.travelDescription || 'Mileage-Only / Other Travel';
  const profile = job?.profile;
  if (profile) return inspectionLabel(profile);
  const e = b.records.find(e => e.id === id) || ledger(b).sources?.find(e => e.id === id);
  return (e?.notes || b.notes || []).find(n => n.recordId === id && n.cell?.startsWith('K'))?.text?.split('\n')[0] || e?.description || 'Unknown inspection';
};
export function incomeRecords(b) {
  const l = ledger(b),
    retired = new Set(l.retired.map(r => r.recordId));
  return [...b.records.filter(r => r.kind !== 'inspection' || !l.jobs[r.id] && !retired.has(r.id)), ...l.events.filter(e => Number(e.date.slice(0, 4)) === b.year).map(e => ({
    id: 'event:' + e.id,
    sourceJobId: e.jobId,
    kind: 'inspection',
    category: 'Inspection',
    scope: 'business',
    subCategory: e.type === 'refund' ? 'Refund' : 'Customer payment',
    state: 'recorded',
    amount: e.type === 'refund' ? -e.amount : e.amount,
    miles: 0,
    month: MONTHS[Number(e.date.slice(5, 7)) - 1],
    transactionDate: e.date,
    description: jobLabel(b, e.jobId) + ' · ' + e.type,
    sourceNote: e.note || '',
    sheet: 'DD Income',
    amountCell: 'G' + (l.events.indexOf(e) + 2)
  }))];
}
export function allVisits(b) {
  return Object.entries(ledger(b).jobs).flatMap(([jobId, j]) => (j.visits || []).map(v => ({
    ...v,
    jobId,
    ownerYear: j.ownerYear
  })));
}
export function travelRecords(b) {
  const l = ledger(b),
    retired = new Set(l.retired.map(r => r.recordId)),
    visits = allVisits(b);
  const old = b.records.filter(r => r.kind === 'inspection' && !l.jobs[r.id] && !retired.has(r.id)).map(r => ({
    ...r,
    vehicle: '',
    inspectionStatus: 'Not reviewed',
    inspectionDate: ''
  }));
  return [...old, ...visits.filter(v => v.date ? Number(v.date.slice(0, 4)) === b.year : v.ownerYear === b.year).map(v => {
    const source = l.sources?.find(r => r.id === v.jobId) || b.records.find(r => r.id === v.jobId) || {};
    return {
      ...source,
      id: v.jobId,
      visitId: v.id,
      month: v.date ? MONTHS[Number(v.date.slice(5, 7)) - 1] : source.month,
      miles: v.miles,
      vehicle: v.vehicle,
      inspectionStatus: v.outcome,
      inspectionDate: v.date,
      sheet: 'DD Visits',
      milesCell: 'G' + (visits.findIndex(x => x.id === v.id) + 2)
    };
  })];
}
// Read-only presentation: visit history remains authoritative and is never rewritten.
export function inspectionSummary(job) {
  const visits = [...(job?.visits || [])].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const dates = visits.map(v => v.date).filter(Boolean);
  const completed = visits.find(v => v.outcome === 'Completed' && v.purpose !== 'Repair verification');
  const travel = job?.entryType === 'travel';
  return {
    status: travel ? job.travelReview === 'reviewed' ? 'Travel Reviewed' : 'Needs Research' : completed ? 'Completed' : job?.status || 'Not reviewed',
    completedDate: !travel && completed ? completed.date || '' : '',
    firstDate: dates[0] || '',
    lastDate: dates.at(-1) || '',
    pendingFollowups: travel ? 0 : visits.filter(v => v.purpose !== 'Initial inspection' && ['Scheduled', 'Not reviewed'].includes(v.outcome)).length
  };
}
export function inspectionJobs(b) {
  const l = ledger(b);
  return [...(l.sources || b.records.filter(r => r.kind === 'inspection'))].filter(r => !l.retired.some(x => x.recordId === r.id)).map(r => {
    const j = l.jobs[r.id],
      v = j?.visits || [];
    return {
      ...r,
      inspectionDate: v.find(x => x.date)?.date || '',
      inspectionStatus: j?.entryType === 'travel' ? j.travelReview === 'reviewed' ? 'Travel Reviewed' : 'Needs Research' : j?.status || 'Not reviewed',
      vehicle: '',
      miles: j ? v.reduce((s, x) => s + (x.miles || 0), 0) : r.miles,
      visitCount: v.length
    };
  });
}
export function monthlyIncome(b, m) {
  const rows = incomeRecords(b).filter(r => r.kind === 'inspection' && r.state === 'recorded' && r.month === m);
  return {
    payments: total(rows.filter(e => e.amount > 0)),
    refunds: -total(rows.filter(e => e.amount < 0)),
    net: total(rows),
    legacy: rows.filter(r => !r.sourceJobId).length
  };
}
export function payoutStatus(b, p) {
  const l = ledger(b),
    issues = [];
  let selected = 0;
  for (const x of p.items) {
    const e = settlementEvents(b).find(e => e.id === x.eventId);
    if (!e) {
      issues.push('A selected payment/refund is missing');
      continue;
    }
    const signed = e.type === 'refund' ? -e.amount : e.amount;
    selected += cents(signed);
    if (cents(x.amount) !== cents(signed) || x.date !== e.date) issues.push('A selected payment/refund changed');
    if (e.date > p.date) issues.push('Payment/refund date is after settlement');
  }
  const difference = (cents(p.amount) - selected) / 100;
  return {
    selected: selected / 100,
    difference,
    issues,
    label: issues.length ? 'Needs review' : difference !== 0 ? 'Unmatched' : p.status === 'confirmed' ? 'Confirmed' : p.items.length ? 'Suggested' : 'Unmatched'
  };
}
export function validateLedger(b) {
  const l = ledger(b),
    ids = new Set(),
    retired = new Set(),
    eventIds = new Set(),
    used = new Set(),
    visitIds = new Set();
  const date = d => {
    const n = new Date(d + 'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(n.getTime()) || n.toISOString().slice(0, 10) !== d || Number(d.slice(0, 4)) < 1900 || Number(d.slice(0, 4)) > 2200) throw Error('Use a valid calendar date between 1900 and 2200.');
  };
  const money = (n, positive = true) => {
    if (!Number.isFinite(n) || Math.abs(n) > 1e9 || positive && n <= 0 || Math.abs(n * 100 - cents(n)) > .0001) throw Error('Use a valid amount with at most two decimal places.');
  };
  for (const [id, j] of Object.entries(l.jobs)) {
    const r = b.records.find(r => r.id === id) || l.sources?.find(r => r.id === id);
    if (!r || r.kind !== 'inspection') throw Error('The inspection source is missing.');
    if (!['Scheduled', 'Completed', 'Partially completed', 'Not performed', 'Canceled', 'Not reviewed'].includes(j.status)) throw Error('Choose an inspection status.');
    if (j.date) date(j.date);
    if (!['', 'Truck', 'Van', 'Other'].includes(j.vehicle)) throw Error('Choose a vehicle.');
    if (j.miles !== null && (!Number.isFinite(j.miles) || j.miles < 0)) throw Error('Mileage must be nonnegative.');
    if ((j.reason || '').length > 5000) throw Error('Inspection note is too long.');
    if (j.entryType === 'travel') {
      if (r.amount || l.events.some(e => e.jobId === id)) throw Error('Mileage-only entries cannot replace an entry with income or payments.');
      if (!j.travelDescription?.trim()) throw Error('Enter a travel description.');
      if (!['research', 'reviewed'].includes(j.travelReview)) throw Error('Choose Needs Research or Reviewed.');
      if ((j.travelDescription || '').length > 200 || (j.travelPurpose || '').length > 1000) throw Error('Travel description or purpose is too long.');
      if (!j.visits?.length) throw Error('Enter the travel mileage.');
      if (j.travelReview === 'reviewed' && (!j.travelPurpose?.trim() || j.visits.some(v => !v.date || !v.vehicle || v.miles == null))) throw Error('To mark travel reviewed, enter its purpose, date, vehicle and mileage. Otherwise use Needs Research.');
    }
    if (j.profile && j.entryType !== 'travel') {
      const p = j.profile;
      validateCustomers(p);
      if (p.zip !== undefined && (typeof p.zip !== 'string' || p.zip.length > 10)) throw Error('Keep ZIP code to 10 characters or fewer.');
      for (const key of ['customerPhone', 'vin']) if (p[key] !== undefined && (typeof p[key] !== 'string' || p[key].length > 100)) throw Error('Keep customer phone and VIN to 100 characters each.');
      if (!p.customerName?.trim()) throw Error('Enter the customer name.');
      if (!['private', 'dealer'].includes(p.locationType) && !(j.detailsPending && p.locationType === '')) throw Error('Choose Private Sale or Dealer.');
      if (!j.detailsPending && p.locationType === 'dealer' && !p.dealerName?.trim()) throw Error('Enter the dealer name.');
      if (!j.detailsPending && !p.city?.trim() || !states.includes(p.state) && !(j.detailsPending && p.state === '')) throw Error('Enter the city and choose a state.');
      if (p.rvYear && !/^\d{4}$/.test(p.rvYear)) throw Error('Use four digits for RV year.');
      if (p.quotedFee !== null && p.quotedFee !== undefined) {
        money(p.quotedFee, false);
        if (p.quotedFee < 0) throw Error('Quoted fee cannot be negative.');
      }
      for (const value of Object.values(p)) if (typeof value === 'string' && value.length > 1000) throw Error('Inspection detail is too long.');
    }
    for (const v of j.visits || []) {
      if (!v.id || visitIds.has(v.id)) throw Error('Visit IDs must be unique.');
      visitIds.add(v.id);
      if (v.miles > 0 && !v.date && !v.id.endsWith(':initial') && !(j.entryType === 'travel' && j.travelReview === 'research')) throw Error('Enter the visit date so its actual mileage goes into the correct month and year.');
      if (!['Initial inspection', 'Repair verification', 'Other follow-up', ...(j.entryType === 'travel' ? ['Other travel'] : [])].includes(v.purpose) || !['Scheduled', 'Completed', 'Partially completed', 'Not performed', 'Canceled', 'Not reviewed'].includes(v.outcome)) throw Error('Choose a purpose and outcome for each visit.');
      if (v.date) date(v.date);
      if (!['', 'Truck', 'Van', 'Other'].includes(v.vehicle)) throw Error('Choose a vehicle for each visit.');
      if (v.miles !== null && (!Number.isFinite(v.miles) || v.miles < 0)) throw Error('Actual visit mileage must be nonnegative.');
      if (!['courtesy', 'included', 'separate', 'undecided'].includes(v.charge)) throw Error('Choose a visit charge treatment.');
      if (v.quotedFee != null) {
        money(v.quotedFee, false);
        if (v.quotedFee < 0) throw Error('Quoted visit fee cannot be negative.');
      }
      if ((v.note || '').length > 5000) throw Error('Visit note is too long.');
    }
    ids.add(id);
  }
  for (const r of l.retired) {
    const source = b.records.find(e => e.id === r.recordId) || l.sources?.find(e => e.id === r.recordId);
    if (!source || source.kind !== 'inspection' || retired.has(r.recordId) || ids.has(r.recordId)) throw Error('Invalid superseded entry.');
    if (source.miles) throw Error('An entry with mileage cannot be superseded. Preserve or transfer that travel first.');
    if (!r.reason?.trim()) throw Error('Explain why the old entry is superseded.');
    retired.add(r.recordId);
  }
  for (const e of l.events) {
    if (!e.id || eventIds.has(e.id) || !ids.has(e.jobId)) throw Error('Invalid or duplicate payment/refund reference.');
    eventIds.add(e.id);
    if (e.visitId && !l.jobs[e.jobId].visits?.some(v => v.id === e.visitId)) throw Error('Reassign or unlink the payment before removing its visit.');
    date(e.date);
    money(e.amount);
    if (!['payment', 'refund'].includes(e.type)) throw Error('Choose payment or refund.');
    if (e.paidBy !== undefined && (typeof e.paidBy !== 'string' || e.paidBy.length > 200)) throw Error('Keep Paid By to 200 characters or fewer.');
    if ((e.method || '').length > 100 || (e.reference || '').length > 200) throw Error('Payment method/reference is too long.');
    if ((e.note || '').length > 5000) throw Error('Payment note is too long.');
  }
  for (const id of ids) {
    let received = 0;
    for (const e of l.events.filter(e => e.jobId === id).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type))) {
      received += (e.type === 'refund' ? -1 : 1) * cents(e.amount);
      if (received < 0) throw Error('Refunds cannot exceed payments received for the inspection by that date.');
    }
  }
  const payouts = new Set();
  for (const p of l.payouts) {
    if (!p.id || payouts.has(p.id)) throw Error('Duplicate settlement ID.');
    payouts.add(p.id);
    date(p.date);
    money(p.amount, false);
    if (!['suggested', 'confirmed'].includes(p.status)) throw Error('Choose Suggested or Confirmed.');
    if (p.statementMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.statementMonth)) throw Error('Choose a valid statement month.');
    if ((p.bankAccount || '').length > 200 || (p.otherEvidence || '').length > 1000) throw Error('Statement source or evidence description is too long.');
    if (p.evidence && (!Array.isArray(p.evidence) || p.evidence.some(x => !['bank', 'processor', 'scheduling', 'other'].includes(x)))) throw Error('Choose valid evidence sources.');
    if (p.confirmedAt && !Number.isFinite(Date.parse(p.confirmedAt))) throw Error('Invalid confirmation date.');
    if ((p.note || '').length > 5000 || (p.reference || '').length > 200) throw Error('Settlement note/reference is too long.');
    for (const x of p.items) {
      if (used.has(x.eventId)) throw Error('A payment or refund can connect to only one settlement.');
      used.add(x.eventId);
      money(x.amount, false);
      if (x.date && !Number.isFinite(Date.parse(x.date))) throw Error('Invalid settlement snapshot.');
    }
  }
}
export function changes(before, after) {
  return MONTHS.map(m => ({
    month: m,
    before: monthlyIncome(before, m).net,
    after: monthlyIncome(after, m).net
  })).filter(r => cents(r.before) !== cents(r.after));
}
export function settlementEvents(b) {
  const l = ledger(b);
  return [...l.events, ...(l.sources || b.records).filter(r => r.kind === 'inspection' && !l.jobs[r.id] && !l.retired.some(x => x.recordId === r.id) && r.amount && r.state === 'recorded').map(r => ({
    id: 'legacy:' + r.id,
    jobId: r.id,
    date: '',
    month: r.month,
    ownerYear: r.ownerYear || b.year,
    type: r.amount < 0 ? 'refund' : 'payment',
    amount: Math.abs(r.amount),
    legacy: true,
    note: 'Original month retained; payment date not reviewed.'
  }))];
}
export function annualView(b, year) {
  const sources = ledger(b).sources || [];
  return {
    ...b,
    year,
    records: year === b.year ? b.records : sources.filter(r => Number(r.ownerYear) === year)
  };
}
export function crossYearChanges(before, after) {
  const years = [...new Set([before.year, ...(ledger(after).linkedYears || []), ...ledger(after).events.map(e => Number(e.date.slice(0, 4))), ...allVisits(after).filter(v => v.date).map(v => Number(v.date.slice(0, 4)))])].sort();
  return years.flatMap(year => {
    const a = annualView(before, year),
      b = annualView(after, year);
    return MONTHS.map(month => ({
      year,
      month,
      before: monthlyIncome(a, month).net,
      after: monthlyIncome(b, month).net,
      milesBefore: travelRecords(a).filter(r => r.month === month).reduce((s, r) => s + (r.miles || 0), 0),
      milesAfter: travelRecords(b).filter(r => r.month === month).reduce((s, r) => s + (r.miles || 0), 0)
    })).filter(r => cents(r.before) !== cents(r.after) || r.milesBefore !== r.milesAfter);
  });
}
export function mileageNeedsReview(b, row) {
  const j = ledger(b).jobs[row.id],
    v = j?.visits?.find(v => v.id === row.visitId);
  return !v || !v.date || !v.vehicle || v.miles == null || (j.entryType === 'travel' ? j.travelReview !== 'reviewed' || !j.travelPurpose?.trim() : ['Not reviewed', 'Scheduled'].includes(v.outcome));
}
export function canRemoveOriginal(book, id) {
  const l = ledger(book),
    r = book.records.find(r => r.id === id);
  return !!r && r.kind === 'inspection' && !l.jobs[id] && !l.retired.some(x => x.recordId === id) && !l.events.some(e => e.jobId === id) && !l.payouts.some(p => p.items.some(x => x.eventId === 'legacy:' + id));
}

// Correct the filing month without rewriting dated activity or linked identities.
export function moveInspectionMonth(book, id, targetMonth) {
  if (!MONTHS.includes(targetMonth)) throw Error('Choose a destination month.');
  const source = book.records.find(r => r.id === id && r.kind === 'inspection');
  if (!source) throw Error('Open the inspection in its original workbook year to move it.');
  if (source.month === targetMonth) throw Error('Choose a different month.');
  const next = structuredClone(book);
  next.records.find(r => r.id === id).month = targetMonth;
  next.inspectionLedger = structuredClone(ledger(book));
  const snapshot = next.inspectionLedger.sources?.find(r => r.id === id);
  if (snapshot) snapshot.month = targetMonth;
  return next;
}
