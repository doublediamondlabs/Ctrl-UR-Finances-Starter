import { ledger, travelRecords, MONTHS } from './inspectionIncome.js';
export const emptyRearview = () => ({
  title: '',
  intro: '',
  outlook: '',
  cover: null,
  months: Array.from({
    length: 12
  }, () => ({
    note: '',
    photos: []
  }))
});
export function rearviewStats(book) {
  const l = ledger(book),
    retired = new Set((l.retired || []).map(x => x.recordId)),
    sets = MONTHS.map(() => new Set()),
    all = new Set();
  let undated = 0;
  for (const [id, j] of Object.entries(l.jobs)) {
    if (retired.has(id) || j.entryType === 'travel') continue;
    for (const v of j.visits || []) {
      if (!['Completed', 'Partially completed'].includes(v.outcome)) continue;
      if (!v.date) {
        if (Number(j.ownerYear) === Number(book.year)) undated++;
        continue;
      }
      if (Number(v.date.slice(0, 4)) !== Number(book.year)) continue;
      const m = Number(v.date.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) {
        sets[m].add(id);
        all.add(id);
      }
    }
  }
  for (const r of book.records) {
    if (r.kind === 'inspection' && r.state === 'recorded' && !l.jobs[r.id] && !retired.has(r.id)) {
      const m = MONTHS.indexOf(r.month);
      if (m >= 0) {
        sets[m].add(r.id);
        all.add(r.id);
      }
    }
  }
  const miles = Array(12).fill(0);
  let missingMiles = 0;
  for (const r of travelRecords(book)) {
    if (retired.has(r.id) || l.jobs[r.id]?.entryType === 'travel') continue;
    if (l.jobs[r.id] && !['Completed', 'Partially completed'].includes(r.inspectionStatus)) continue;
    if (!l.jobs[r.id] && r.state !== 'recorded') continue;
    const m = MONTHS.indexOf(r.month);
    if (m < 0) continue;
    if (Number.isFinite(r.miles) && r.miles >= 0) miles[m] += r.miles;else missingMiles++;
  }
  const active = new Set();
  book.records.filter(r => r.scope === 'business' && r.state === 'recorded').forEach(r => {
    const m = MONTHS.indexOf(r.month);
    if (m >= 0) active.add(m);
  });
  (l.events || []).filter(e => Number(e.date?.slice(0, 4)) === Number(book.year)).forEach(e => active.add(Number(e.date.slice(5, 7)) - 1));
  sets.forEach((s, m) => {
    if (s.size) active.add(m);
  });
  return {
    inspections: all.size,
    miles: miles.reduce((a, b) => a + b, 0),
    active: active.size,
    missingMiles,
    undated,
    months: MONTHS.map((name, m) => ({
      name,
      inspections: sets[m].size,
      miles: miles[m]
    }))
  };
}
