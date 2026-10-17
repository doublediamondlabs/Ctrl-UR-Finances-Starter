import { customerContacts, customerNames } from './customerContacts.js';
import { ledger, validateLedger, MONTHS } from './inspectionIncome.js';
const stable = v => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const clone = x => structuredClone(x);
const uid = () => crypto.randomUUID();
export function visitSnapshot(book, jobId, visitId) {
  const j = ledger(book).jobs[jobId],
    v = j?.visits?.find(v => v.id === visitId);
  if (!j || !v || j.entryType === 'travel') throw Error('The linked inspection visit was not found.');
  const p = j.profile || {},
    d = v.destination || (v.purpose === 'Initial inspection' ? p : {});
  return {
    name: customerNames(p) || 'Inspection',
    date: v.date || '',
    outcome: v.outcome || '',
    purpose: v.purpose || '',
    vehicle: v.vehicle || '',
    miles: v.miles ?? null,
    rv: [p.rvYear, p.rvMake, p.rvModel].filter(Boolean).join(' '),
    vin: p.vin || '',
    contacts: customerContacts(p).map(c => [c.name, ...c.phones.map(r => 'Phone: ' + r.value + (r.label ? ' (' + r.label + ')' : '')), ...c.emails.map(r => 'Email: ' + r.value + (r.label ? ' (' + r.label + ')' : ''))].filter(Boolean).join('\n')).join('\n\n'),
    destination: [d.dealerName || d.name, d.address, d.city, d.state, d.zip].filter(Boolean).join(', '),
    quote: v.charge === 'separate' ? v.quotedFee ?? null : p.quotedFee ?? null,
    notes: [j.reason, v.note, ...(book.records.some(r => r.id === jobId) ? book.notes || [] : ledger(book).sources?.find(r => r.id === jobId)?.notes || []).filter(n => n.recordId === jobId).map(n => n.text)].filter(Boolean).join('\n\n')
  };
}
export function prepareTravelExport(book, jobId, visitId, books = [book]) {
  const next = clone(book),
    v = ledger(next).jobs[jobId]?.visits?.find(v => v.id === visitId),
    inspection = visitSnapshot(book, jobId, visitId);
  if (!v.romExport && v.outcome !== 'Scheduled') throw Error('Start travel planning from a scheduled visit. Existing linked visits can be refreshed after their status changes.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inspection.date)) throw Error('Enter and save the visit date before exporting.');
  const packet = {
    format: 'double-diamond-inspection-trip',
    version: 2,
    linkId: v.romExport?.linkId || uid(),
    generation: uid(),
    jobId,
    visitId,
    exportedAt: new Date().toISOString(),
    inspection,
    expenseCatalog: expenseCatalog(books)
  };
  v.romExport = clone(packet);
  validateLedger(next);
  return {
    next,
    packet
  };
}
function validateReturn(p) {
  if (!p || p.format !== 'double-diamond-trip-results' || p.version !== 1) throw Error('Choose a Return to Expense Book JSON exported by RōM.');
  for (const k of ['linkId', 'generation', 'jobId', 'visitId', 'tripId']) if (typeof p[k] !== 'string' || !p[k] || p[k].length > 200) throw Error('Invalid transfer identity.');
  if (p.actualMiles !== null && (typeof p.actualMiles !== 'number' || !Number.isFinite(p.actualMiles) || p.actualMiles < 0 || p.actualMiles > 1e9)) throw Error('Invalid actual mileage.');
  if (typeof p.notes !== 'string' || p.notes.length > 3000) throw Error('Trip notes must be 3,000 characters or fewer.');
  if (p.actualMiles === null && !p.notes.trim()) throw Error('No mileage or notes selected for return.');
}
function previewTravelReturnV1(book, p) {
  validateReturn(p);
  const v = ledger(book).jobs[p.jobId]?.visits?.find(v => v.id === p.visitId),
    ex = v?.romExport;
  if (!ex || ex.linkId !== p.linkId) throw Error('This return does not match a visit exported from this Expense Book.');
  const receipt = {
    generation: p.generation,
    tripId: p.tripId,
    actualMiles: p.actualMiles,
    notes: p.notes
  };
  if (v.romReceipt?.generation === p.generation) {
    if (stable(v.romReceipt) === stable(receipt)) return {
      already: true
    };
    throw Error('A different result was already applied for this handoff. Export the visit again, refresh RōM, then prepare a new return.');
  }
  if (ex.generation !== p.generation) throw Error('This handoff has been superseded. Import the latest Expense Book export into RōM and prepare a new return.');
  if (stable(visitSnapshot(book, p.jobId, p.visitId)) !== stable(ex.inspection)) throw Error('The inspection changed after export. Export it again and refresh the linked RōM trip before returning results.');
  const next = clone(book),
    nv = ledger(next).jobs[p.jobId].visits.find(v => v.id === p.visitId);
  if (p.actualMiles !== null) nv.miles = p.actualMiles;
  if (p.notes.trim()) {
    const block = 'RōM trip notes:\n' + p.notes.trim();
    if (!(nv.note || '').includes(block)) nv.note = [nv.note, block].filter(Boolean).join('\n\n');
  }
  if (nv.note?.length > 5000) throw Error('The combined visit notes exceed 5,000 characters. Shorten the return notes.');
  nv.romReceipt = receipt;
  validateLedger(next);
  return {
    next,
    before: clone(v),
    after: clone(nv),
    inspection: ex.inspection
  };
}
export function expenseCatalog(books) {
  return books.map(b => ({
    year: Number(b.year),
    categories: (b.categories || []).filter(c => c.role !== 'residence' && c.name !== 'Residence').map(c => ({
      name: c.name,
      subs: [...(c.subs || [])]
    }))
  }));
}
const validDate = s => {
  const d = new Date(s + 'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(+d) && d.toISOString().slice(0, 10) === s && +s.slice(0, 4) >= 1900 && +s.slice(0, 4) <= 2200;
};
function expenseError(x, books) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(x.id)) return 'Invalid expense ID.';
  for (const [k, max] of [['date', 10], ['payee', 200], ['description', 500], ['category', 200], ['subCategory', 200], ['bucket', 20]]) if (typeof x[k] !== 'string' || x[k].length > max) return 'Invalid expense ' + k + '.';
  if (!validDate(x.date)) return 'Enter a valid expense date.';
  if (!x.payee.trim() || !x.description.trim()) return 'Enter payee and description.';
  if (typeof x.amount !== 'number' || !Number.isFinite(x.amount) || x.amount <= 0 || x.amount > 1e9 || Math.abs(x.amount * 100 - Math.round(x.amount * 100)) > .0001) return 'Use a positive amount with at most two decimal places.';
  if (!['Fuel', 'Lodging', 'Meals', 'Other'].includes(x.bucket)) return 'Invalid travel cost group.';
  const b = books.find(b => Number(b.year) === +x.date.slice(0, 4));
  if (!b) return 'Link the ' + x.date.slice(0, 4) + ' workbook before importing.';
  const c = expenseCatalog([b])[0].categories.find(c => c.name === x.category);
  if (!c) return 'Category no longer exists in ' + b.year + '. Refresh RōM from Expense Book and choose a current category.';
  if (x.subCategory && !c.subs.includes(x.subCategory)) return 'Subcategory no longer exists. Refresh RōM and choose a current subcategory.';
  return '';
}
export function applyTravelExpensePlan(book, plan) {
  const b = clone(book);
  for (const a of plan?.additions || []) {
    if (a.year !== Number(b.year)) continue;
    if (b.records.some(r => r.id === a.record.id)) throw Error('A trip expense already exists. Reload before importing.');
    const problem = expenseError(a.expense, [b]);
    if (problem) throw Error(problem);
    b.records.push(clone(a.record));
    b.notes.push(clone(a.note));
  }
  return b;
}
export function previewTravelReturn(book, p, options = {}) {
  if (p?.version !== 2) return previewTravelReturnV1(book, p);
  const books = options.books || [book];
  if (p.format !== 'double-diamond-trip-results' || !Array.isArray(p.expenses) || p.expenses.length > 500) throw Error('Invalid RōM expense return file.');
  // Reuse v1 identity/mileage validation, allowing an expense-only return.
  validateReturn({
    ...p,
    version: 1,
    notes: p.notes || (p.expenses.length && p.actualMiles === null ? 'expense-only validation' : '')
  });
  if (typeof p.notes !== 'string') throw Error('Invalid return notes.');
  const l = ledger(book),
    v = l.jobs[p.jobId]?.visits?.find(v => v.id === p.visitId),
    ex = v?.romExport;
  if (!ex || ex.linkId !== p.linkId) throw Error('This return does not match a visit exported from this Expense Book.');
  if (ex.version !== 2 || ex.generation !== p.generation) throw Error('Export this visit again and refresh RōM before importing this expense handoff.');
  const expected = v.romReturnState?.generation === p.generation ? v.romReturnState.snapshot : ex.inspection;
  if (stable(visitSnapshot(book, p.jobId, p.visitId)) !== stable(expected)) throw Error('The inspection changed after export. Export it again and refresh RōM before returning results.');
  const receipts = l.romExpenseReceipts || [],
    seen = new Set();
  const expenseRows = p.expenses.map(x => {
    if (!x || typeof x.id !== 'string' || seen.has(x.id)) throw Error('Missing or duplicate expense IDs in this return.');
    seen.add(x.id);
    const receipt = receipts.find(r => r.linkId === p.linkId && r.expenseId === x.id),
      problem = expenseError(x, books);
    if (receipt) return {
      expense: x,
      imported: true,
      problem: receipt.signature === stable(x) ? '' : 'This expense was already imported and has since changed in RōM. Edit its existing Expense Book entry; it cannot be imported again.',
      matches: []
    };
    if (problem) return {
      expense: x,
      imported: false,
      problem,
      matches: []
    };
    const b = books.find(b => Number(b.year) === +String(x.date).slice(0, 4)),
      matches = (b?.records || []).filter(r => r.kind === 'expense' && r.scope === 'business' && r.amount != null && Math.round(r.amount * 100) === Math.round(x.amount * 100) && (r.transactionDate ? r.transactionDate === x.date : r.month === MONTHS[+x.date.slice(5, 7) - 1])).map(r => ({
        description: r.description,
        date: r.transactionDate || r.month,
        state: r.state
      }));
    if (p.expenses.some(other => other.id !== x.id && other.date === x.date && other.amount === x.amount)) matches.push({
      description: 'Another item in this return has the same date and amount',
      date: x.date,
      state: 'return file'
    });
    return {
      expense: x,
      imported: false,
      problem,
      matches
    };
  });
  const selected = options.selectedIds ?? expenseRows.filter(r => !r.imported && !r.problem && !r.matches.length).map(r => r.expense.id),
    ack = new Set(options.acknowledgedIds || []);
  const next = clone(book),
    nv = ledger(next).jobs[p.jobId].visits.find(v => v.id === p.visitId),
    additions = [];
  const receipt = {
      generation: p.generation,
      tripId: p.tripId,
      actualMiles: p.actualMiles,
      notes: p.notes
    },
    hasMain = p.actualMiles !== null || !!p.notes.trim();
  let mainChanged = false;
  if (hasMain) {
    if (v.romReceipt?.generation === p.generation) {
      if (stable(v.romReceipt) !== stable(receipt)) throw Error('Mileage or notes were already applied for this handoff. Refresh via a new export, or return only additional expenses.');
    } else {
      if (p.actualMiles !== null) nv.miles = p.actualMiles;
      if (p.notes.trim()) {
        const block = 'RōM trip notes:\n' + p.notes.trim();
        if (!(nv.note || '').includes(block)) nv.note = [nv.note, block].filter(Boolean).join('\n\n');
      }
      if (nv.note?.length > 5000) throw Error('The combined visit notes exceed 5,000 characters. Shorten the return notes.');
      nv.romReceipt = receipt;
      mainChanged = true;
    }
  }
  for (const row of expenseRows.filter(r => selected.includes(r.expense.id))) {
    const x = row.expense;
    if (row.imported || row.problem) throw Error(row.problem || 'An already-imported expense cannot be selected again.');
    if (row.matches.length && !ack.has(x.id)) continue;
    const year = +x.date.slice(0, 4),
      month = MONTHS[+x.date.slice(5, 7) - 1],
      id = 'rom-expense:' + p.linkId + ':' + x.id;
    const record = {
      id,
      kind: 'expense',
      scope: 'business',
      state: 'recorded',
      month,
      sheet: month,
      category: x.category,
      subCategory: x.subCategory,
      description: x.payee + ' · ' + x.description,
      transactionDate: x.date,
      amount: x.amount,
      miles: null,
      location: '',
      percent: null,
      recurringType: 'variable',
      isNew: true
    };
    const note = {
      id: uid(),
      recordId: id,
      sheet: month,
      cell: 'New entry',
      storage: 'app',
      text: 'Imported from RōM. Payee: ' + x.payee + '\nInspection: ' + ex.inspection.name + '\nVisit: ' + ex.inspection.date + ' · ' + ex.inspection.purpose + '\nTrip ID: ' + p.tripId + ' · Expense ID: ' + x.id
    };
    additions.push({
      year,
      record,
      note,
      expense: clone(x)
    });
    (ledger(next).romExpenseReceipts ||= []).push({
      linkId: p.linkId,
      expenseId: x.id,
      tripId: p.tripId,
      signature: stable(x),
      recordId: id,
      year
    });
  }
  nv.romReturnState = {
    generation: p.generation,
    snapshot: visitSnapshot(next, p.jobId, p.visitId)
  };
  validateLedger(next);
  const unresolved = expenseRows.some(r => selected.includes(r.expense.id) && r.matches.length && !ack.has(r.expense.id));
  const already = !mainChanged && !additions.length && expenseRows.every(r => r.imported && !r.problem);
  return {
    next,
    before: clone(v),
    after: clone(nv),
    inspection: ex.inspection,
    expenseRows,
    selectedIds: selected,
    expensePlan: {
      additions,
      revisions: options.revisions || []
    },
    expenseTotal: additions.reduce((n, a) => n + Math.round(a.expense.amount * 100), 0) / 100,
    newExpenseCount: additions.length,
    canApply: !unresolved && (mainChanged || additions.length > 0),
    already
  };
}
export function assertTravelRevisions(packets, plan) {
  for (const expected of plan.revisions || []) {
    const fresh = packets.find(p => p.year === expected.year);
    if (!fresh || fresh.revision !== expected.revision) throw Error('A linked workbook changed after the trip expense preview. Reload and preview again.');
  }
  for (const a of plan.additions || []) if (!(plan.revisions || []).some(p => p.year === a.year)) throw Error('Missing workbook revision for the trip expense preview.');
}
