import { customerNames } from './customerContacts.js';
export const states = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AS GU MP PR VI'.split(' ');
export const emptyProfile = () => ({
  customerName: '',
  customerPhone: '',
  vin: '',
  rvYear: '',
  rvMake: '',
  rvModel: '',
  appointmentId: '',
  locationType: '',
  dealerName: '',
  city: '',
  state: '',
  zip: '',
  address: '',
  quotedFee: null
});
export const inspectionLabel = p => [customerNames(p), [p.rvYear, p.rvMake, p.rvModel].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
export const locationLabel = p => [p.locationType === 'dealer' ? 'Dealer' : p.locationType === 'private' ? 'Private Sale' : '', p.locationType === 'dealer' ? p.dealerName : '', [p.city, p.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
export function duplicateInspections(book, id, job) {
  const p = job.profile;
  if (!p) return [];
  const norm = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return Object.entries(book.inspectionLedger?.jobs || {}).filter(([key, j]) => {
    if (key === id || !j.profile) return false;
    const q = j.profile;
    return norm(p.appointmentId) && norm(p.appointmentId) === norm(q.appointmentId) || job.date && job.date === j.date && norm(p.customerName) && norm(p.customerName) === norm(q.customerName) && norm(p.rvMake + ' ' + p.rvModel).trim() && norm(p.rvMake + ' ' + p.rvModel) === norm(q.rvMake + ' ' + q.rvModel);
  }).map(([id, j]) => ({
    id,
    label: inspectionLabel(j.profile),
    date: j.date
  }));
}
export function inspectionCues(book, id) {
  const j = book.inspectionLedger?.jobs[id];
  if (!j) return ['Payment date not reviewed'];
  const cues = [];
  if (!j.visits?.length) cues.push('No visits recorded');
  for (const v of j.visits || []) {
    if (!v.date && !cues.includes('Visit date missing')) cues.push('Visit date missing');
    if (v.miles == null && !cues.includes('Actual mileage missing')) cues.push('Actual mileage missing');
    if (!v.vehicle && !cues.includes('Visit vehicle missing')) cues.push('Visit vehicle missing');
  }
  if (!book.inspectionLedger.events.some(e => e.jobId === id && e.type === 'payment') && !['Canceled', 'Not performed'].includes(j.status)) cues.push('Awaiting payment');
  return cues;
}
