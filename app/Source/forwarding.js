// Private allocation ledger; never changes borrower receipt amounts or dates.
const c = n => Math.round(Number(n) * 100),
  sum = rows => rows.reduce((n, r) => n + c(r.amount), 0);
const dateOK = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d + 'T12:00:00Z')) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
export function receiptDate(r) {
  return r.date || r.month + '-01';
}
export function allocated(loan, id, exceptId = null) {
  return (loan.remittances || []).filter(r => r.id !== exceptId).reduce((n, r) => n + (r.allocations || []).filter(a => a.receiptId === id).reduce((v, a) => v + c(a.amount), 0), 0) / 100;
}
export function unassignedHistory(loan, exceptId = null) {
  return (Number(loan.openingForwarded) || 0) > 0 || (loan.remittances || []).some(r => r.id !== exceptId && !Array.isArray(r.allocations));
}
export function validateForwarding(loan) {
  const receipts = new Map(loan.receipts.map(r => [r.id, r])),
    used = new Map(),
    ids = new Set();
  for (const r of loan.remittances || []) {
    if (!r.id || ids.has(r.id)) throw Error('Each forwarding record needs a unique ID.');
    ids.add(r.id);
    if (r.allocations === undefined) continue; // Existing unassigned history stays intact.
    if (!Array.isArray(r.allocations) || !r.allocations.length) throw Error('Select at least one receipt to forward.');
    const local = new Set();
    for (const a of r.allocations) {
      const receipt = receipts.get(a.receiptId);
      if (!receipt) throw Error('A forwarded receipt cannot be removed. Edit or remove its forwarding record first.');
      if (local.has(a.receiptId)) throw Error('A receipt is selected twice in a forwarding record.');
      local.add(a.receiptId);
      if (!Number.isFinite(a.amount) || a.amount <= 0 || Math.abs(a.amount * 100 - c(a.amount)) > 0.000001) throw Error('Use a positive amount with at most two decimal places for each selected receipt.');
      if (receiptDate(receipt) > r.date) throw Error('A forwarding date cannot precede a selected receipt. For imported receipts without a day, verify the actual date.');
      used.set(a.receiptId, (used.get(a.receiptId) || 0) + c(a.amount));
    }
    if (sum(r.allocations) !== c(r.amount)) throw Error('The selected receipt amounts must equal the amount sent.');
  }
  for (const [id, value] of used) if (value > c(receipts.get(id).amount)) throw Error('A receipt is assigned for more than its amount. Review its forwarding connections before reducing the receipt.');
  if (loan.forwardingReviewedThrough && !dateOK(loan.forwardingReviewedThrough)) throw Error('Choose a valid history-reviewed-through date.');
  if (loan.paymentsVerifiedThrough && !dateOK(loan.paymentsVerifiedThrough)) throw Error('Choose a valid payments-verified-through date.');
  return loan;
}
export function saveForwarding(loan, draft) {
  const next = structuredClone(loan),
    old = next.remittances.find(r => r.id === draft.id);
  if (!old && unassignedHistory(next, draft.id)) throw Error('Resolve the earlier unassigned forwarding history before creating new receipt batches.');
  if (!dateOK(draft.date)) throw Error('Enter the actual date sent.');
  const allocations = Object.entries(draft.selected).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([receiptId, amount]) => ({
    receiptId,
    amount: Number(amount)
  }));
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw Error('Enter the actual amount sent.');
  const row = {
    ...old,
    id: draft.id || crypto.randomUUID(),
    date: draft.date,
    amount,
    note: draft.note || '',
    reference: draft.reference || '',
    allocations
  };
  if (next.openingForwarded === null) {
    next.openingForwarded = 0;
    next.openingForwardedDate = [next.start + '-01', ...next.receipts.map(receiptDate), draft.date].sort()[0];
  }
  next.remittances = old ? next.remittances.map(r => r.id === old.id ? row : r) : [...next.remittances, row];
  next.forwardingReviewedThrough = '';
  next.paymentsVerifiedThrough = '';
  return validateForwarding(next);
}
