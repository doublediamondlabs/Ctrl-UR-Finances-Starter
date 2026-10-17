import { open, els, attr, encode, NS } from './import-legacy.ts';
import { appendSheet } from './workbook.js';
import { zipSync, strToU8 } from 'fflate';
import { schedule, calculateLoan, validateLoan } from './loan.js';
export function readLoan(base64) {
  const w = open(base64),
    dd = w.sheets.find(s => s.name === 'DD Loan');
  if (dd) {
    const rows = els(dd.doc, 'row').map(r => Number(attr(r, 'r'))).filter(r => r > 1);
    const state = {
      receipts: [],
      remittances: []
    };
    for (const r of rows) {
      const type = dd.get('A' + r),
        value = JSON.parse(dd.get('B' + r));
      if (type === 'settings') Object.assign(state, value);else if (type === 'receipt') state.receipts.push(value);else if (type === 'remittance') state.remittances.push(value);
    }
    return validateLoan({
      ...state,
      version: 3
    });
  }
  throw Error('This file needs a saved DD Loan ledger. Importing custom legacy repayment layouts requires a separate migration.');
}
export function writeLoan(base64, input) {
  const loan = validateLoan(structuredClone(input)),
    w = open(base64),
    {
      receipts,
      remittances,
      ...settings
    } = loan;
  appendSheet(w, 'DD Loan', [['Type', 'Data'], ['settings', JSON.stringify({
    ...settings,
    imported: false
  })], ...receipts.map(r => ['receipt', JSON.stringify(r)]), ...remittances.map(r => ['remittance', JSON.stringify(r)])], [20, 120]);
  const today = new Date().toLocaleDateString('en-CA'),
    c = calculateLoan(loan, /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10));
  appendSheet(w, 'Loan Overview', [['Current loan ledger', 'Value'], ['Borrower', loan.borrower], ['Original principal', loan.principal], ['Interest', 0], ['Current monthly payment', loan.monthlyPayment], ['Due day', loan.dueDay], ['Grace days', loan.graceDays || 0], ['All receipts', receipts.reduce((n, r) => n + r.amount, 0)], ['Remaining principal', Math.round((loan.principal - receipts.reduce((n, r) => n + r.amount, 0)) * 100) / 100], ['As of', today], ['Overall shortfall as of date', c.arrears], ['Important', 'Use the app for edits. Original Payments and Sandbox sheets remain import history.']], [44, 110]);
  appendSheet(w, 'Loan Receipts', [['Receipt ID', 'Receipt month', 'Exact receipt date', 'Amount', 'Timing evidence', 'Private note'], ...receipts.map(r => [r.id, r.month, r.date || '', r.amount, r.timing, r.note || ''])], [38, 18, 22, 18, 65, 20, 95]);
  appendSheet(w, 'Loan Schedule', [['Month', 'Due date', 'Grace ends', 'Scheduled', 'Received in this month as of date', 'Historical monthly gap', 'Status'], ...c.rows.map(r => [r.month, r.due, r.deadline, r.amount, r.paid, r.missing, r.status])], [18, 20, 18, 22, 18, 30]);
  appendSheet(w, 'Private Remittances', [['Private tracking', 'Date', 'Amount', 'Note'], ['Previously forwarded total', loan.openingForwardedDate || '', loan.openingForwarded, 'Confirm in app before relying on held balance'], ...remittances.map(r => [r.id, r.date, r.amount, r.note || '']), ['Private note', '', '', loan.privateNote || '']], [40, 20, 20, 100]);
  appendSheet(w, 'Private Forwarding Links', [['Forwarding ID', 'Date sent', 'Total sent', 'Bank reference', 'Receipt ID', 'Receipt month', 'Receipt date', 'Portion forwarded', 'Private receipt note'], ...remittances.flatMap(r => (r.allocations || []).map(a => {
    const receipt = receipts.find(x => x.id === a.receiptId);
    return [r.id, r.date, r.amount, r.reference || '', a.receiptId, receipt?.month || '', receipt?.date || '', a.amount, receipt?.note || ''];
  }))], [38, 18, 18, 35, 38, 18, 18, 20, 75]);
  if (loan.agreementReference) appendSheet(w, 'Private Agreement', [['Private reference', 'Text'], ['Title', loan.agreementReference.title || ''], ['Current terms', loan.agreementTermsNote || ''], ...loan.agreementReference.text.split('\n').map((line, i) => [String(i + 1), line])], [22, 120]);
  const serializer = new XMLSerializer();
  for (const s of w.sheets) w.files[s.path] = strToU8(serializer.serializeToString(s.doc));
  w.files['xl/workbook.xml'] = strToU8(serializer.serializeToString(w.wb));
  w.files['xl/_rels/workbook.xml.rels'] = strToU8(serializer.serializeToString(w.rel));
  return encode(zipSync(w.files, {
    level: 6
  }));
}
