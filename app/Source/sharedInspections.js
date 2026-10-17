let current = null;
export const setShared = value => {
  current = value;
};
export const getShared = () => current;
export const keyFor = (year, id) => /^\d{4}\|/.test(id) ? id : year + '|' + id;
export function normalize(book) {
  const b = structuredClone(book),
    year = b.year,
    l = b.inspectionLedger || {
      jobs: {},
      events: [],
      payouts: [],
      retired: []
    };
  if (l.sharedVersion) return b;
  const ids = new Map(b.records.filter(r => r.kind === 'inspection').map(r => [r.id, keyFor(year, r.id)]));
  const jobid = id => ids.get(id) || keyFor(year, id),
    eventid = id => keyFor(year, id);
  for (const r of b.records) if (ids.has(r.id)) r.id = ids.get(r.id);
  for (const n of b.notes) if (ids.has(n.recordId)) n.recordId = ids.get(n.recordId);
  for (const h of b.bankHistory || []) if (ids.has(h.recordId)) h.recordId = ids.get(h.recordId);
  const jobs = {};
  for (const [id, j] of Object.entries(l.jobs)) {
    const k = jobid(id);
    jobs[k] = {
      ...j,
      ownerYear: year,
      visits: j.visits || [{
        id: k + ':initial',
        date: j.date || '',
        purpose: 'Initial inspection',
        outcome: j.status,
        vehicle: j.vehicle || '',
        miles: j.miles,
        charge: 'included',
        quotedFee: null,
        note: j.reason || ''
      }]
    };
  }
  b.inspectionLedger = {
    sharedVersion: 1,
    jobs,
    events: l.events.map(e => ({
      ...e,
      id: eventid(e.id),
      jobId: jobid(e.jobId)
    })),
    payouts: l.payouts.map(p => ({
      ...p,
      id: eventid(p.id),
      items: p.items.map(i => ({
        ...i,
        eventId: i.eventId.startsWith('legacy:') ? 'legacy:' + jobid(i.eventId.slice(7)) : eventid(i.eventId)
      }))
    })),
    retired: l.retired.map(r => ({
      ...r,
      recordId: jobid(r.recordId),
      ...(r.jobId ? {
        jobId: jobid(r.jobId)
      } : {})
    })),
    sources: [],
    linkedYears: []
  };
  return b;
}
export function combine(books, existing) {
  const l = existing ? structuredClone(existing) : {
    sharedVersion: 1,
    jobs: {},
    events: [],
    payouts: [],
    retired: [],
    sources: [],
    linkedYears: []
  };
  for (const raw of books) {
    const b = normalize(raw),
      n = b.inspectionLedger;
    const importLedger = !existing || !existing.linkedYears?.includes(b.year);
    // Existing registry is authoritative for known years; import only the new year's own jobs/events.
    const ownJobs = new Set(Object.entries(n.jobs).filter(([id, j]) => !existing || Number(j.ownerYear) === Number(b.year)).map(([id]) => id));
    for (const [id, j] of Object.entries(importLedger ? n.jobs : {})) if (ownJobs.has(id) && !l.jobs[id]) l.jobs[id] = j;
    for (const key of ['events', 'payouts', 'retired']) for (const item of importLedger ? n[key] : []) {
      if (existing && (key === 'events' && !ownJobs.has(item.jobId) || key === 'payouts' && Number(item.date.slice(0, 4)) !== Number(b.year) || key === 'retired' && !b.records.some(r => r.id === item.recordId))) continue;
      const id = key === 'retired' ? 'recordId' : 'id';
      if (!l[key].some(x => x[id] === item[id])) l[key].push(item);
    }
    l.sources = l.sources.filter(r => Number(r.ownerYear) !== Number(b.year));
    for (const r of b.records.filter(r => r.kind === 'inspection')) {
      const source = {
        ...r,
        ownerYear: b.year,
        notes: b.notes.filter(n => n.recordId === r.id)
      };
      l.sources = l.sources.filter(x => x.id !== r.id);
      l.sources.push(source);
    }
  }
  l.linkedYears = books.map(b => Number(b.year));
  return l;
}
export function attach(raw, shared = current) {
  const b = normalize(raw);
  if (shared) b.inspectionLedger = structuredClone(shared);
  return b;
}
export async function refreshShared(api, readRaw) {
  const ctx = await api('inspection/context');
  const books = ctx.books.map(p => readRaw(p.base64, p.year, true));
  const registry = combine(books, ctx.shared);
  setShared(registry);
  return {
    ...ctx,
    registry
  };
}
