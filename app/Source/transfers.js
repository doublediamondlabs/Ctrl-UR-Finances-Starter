export function validateTransfer(t, year) {
  const date = new Date(t.date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== t.date || date.getUTCFullYear() !== Number(year)) throw Error('Enter a valid transfer date within ' + year + '.');
  if (!Number.isFinite(t.amount) || t.amount <= 0) throw Error('Enter a positive transfer amount.');
  if (!t.from?.trim() || !t.to?.trim() || t.from.trim().toLowerCase() === t.to.trim().toLowerCase()) throw Error('Enter two different account names.');
  if (!['personal', 'business', 'both'].includes(t.scope)) throw Error('Choose the transfer area.');
  if ((t.note || '').length > 30000) throw Error('Keep notes under 30,000 characters.');
  return t;
}
export function saveTransfer(book, input, sourceId = '') {
  const next = structuredClone(book),
    t = {
      ...input,
      id: input.id || crypto.randomUUID(),
      amount: Math.round(Number(input.amount) * 100) / 100,
      from: input.from.trim(),
      to: input.to.trim()
    };
  validateTransfer(t, book.year);
  next.transfers = next.transfers || [];
  if (sourceId) {
    const source = next.records.find(r => r.id === sourceId);
    if (!source || source.kind !== 'expense' || !(source.amount < 0) || source.state !== 'recorded') throw Error('Choose an existing recorded negative expense to convert.');
    if (next.bankHistory?.some(h => h.recordId === sourceId)) throw Error('This entry is bank-linked; conversion is not supported here.');
    if (next.transfers.some(t => t.sourceId === sourceId)) throw Error('This entry has already been converted.');
    t.sourceId = sourceId;
    t.originalAmount = source.amount;
    t.originalDescription = source.description;
    t.note = [t.note, ...next.notes.filter(n => n.recordId === sourceId).map(n => n.text)].filter(Boolean).join('\n\n');
    validateTransfer(t, book.year);
    next.records = next.records.filter(r => r.id !== sourceId);
    next.notes = next.notes.filter(n => n.recordId !== sourceId);
  }
  const old = next.transfers.findIndex(x => x.id === t.id);
  if (old < 0) next.transfers.push(t);else next.transfers[old] = t;
  return next;
}
