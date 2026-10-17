import packet from './reviewed-trial.json';
import { ledger, validateLedger } from './inspectionIncome.js';
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export function previewReviewedTrial(book) {
  if (book.year !== packet.year) throw Error('This reviewed history belongs to 2026 only.');
  const existing = ledger(book);
  if (Object.keys(existing.jobs).length || existing.events.length || existing.payouts.length || existing.retired.length) throw Error('Inspection history already exists. No trial history was applied. Review existing records before merging.');
  for (const source of packet.sources) {
    const current = book.records.find(r => r.id === source.id);
    if (stable(current) !== stable(source)) throw Error('A source inspection or payout row changed since comparison: ' + source.id + '. No history was applied.');
  }
  const ids = new Set(packet.sources.map(r => r.id));
  const notes = book.notes.filter(n => ids.has(n.recordId));
  if (stable(notes) !== stable(packet.notes)) throw Error('Source inspection notes changed since comparison. Review before importing; nothing has been applied.');
  const next = structuredClone(book);
  next.inspectionLedger = structuredClone(packet.ledger);
  validateLedger(next);
  return next;
}
