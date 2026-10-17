export function inspectionBriefRows(registry, destinations = []) {
  const rows = [];
  let undated = 0;
  for (const [id, job] of Object.entries(registry.jobs || {})) {
    if (job.entryType === 'travel') continue;
    for (const visit of job.visits || []) {
      if (!visit.date) {
        undated++;
        continue;
      }
      if (visit.outcome === 'Canceled' || job.status === 'Canceled') continue;
      const saved = destinations.find(d => d.id === visit.destination?.id),
        initial = visit.purpose === 'Initial inspection',
        p = job.profile || {},
        location = visit.destination || (initial ? p : null);
      const missing = [];
      if (!p.customerName) missing.push('Customer name');
      if (![p.rvMake, p.rvModel].filter(Boolean).length) missing.push('RV details');
      if (!location?.address) missing.push('Street address');
      if (!p.appointmentId) missing.push('Appointment ID');
      if (!visit.purpose) missing.push('Visit purpose');
      rows.push({
        key: id + ':' + visit.id,
        jobId: id,
        visitId: visit.id,
        date: visit.date,
        profile: p,
        location,
        visit,
        reminder: saved?.reminder || '',
        destinationName: saved?.name || visit.destination?.name || location?.dealerName || '',
        missing
      });
    }
  }
  return {
    rows: rows.sort((a, b) => a.date.localeCompare(b.date) || a.destinationName.localeCompare(b.destinationName) || a.key.localeCompare(b.key)),
    undated
  };
}
export function localToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
