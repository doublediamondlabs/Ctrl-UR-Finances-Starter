import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { webcrypto } from 'node:crypto';
import { bundleHarness } from './helpers.mjs';
import { taxData, assignTaxCategory, assignTaxEntry, taxCategoryLabel, taxRollups } from '../app/Source/businessReports.js';
import { groupSnapshot } from '../app/Source/taxSummary.js';
const row = (id, kind, amount, subCategory = '') => ({
  id,
  kind,
  amount,
  subCategory,
  scope: 'business',
  category: kind === 'inspection' ? 'Inspection' : 'Supplies',
  description: id,
  month: 'January',
  state: 'recorded'
});
const book = {
  year: 2026,
  records: [row('Paid inspection', 'inspection', 500), row('Missing income', 'inspection', null), row('Paper', 'expense', 50, 'Office'), row('Missing expense', 'expense', null, 'Office')],
  notes: []
};
const settings = {
  taxGroups: {
    '["Supplies","Office"]': 'Office Expense'
  },
  taxNotes: {
    '[2025,"group","Office Expense"]': {
      decision: 'Preserved'
    }
  }
};
const before = JSON.stringify(settings),
  prior = {
    ...book,
    year: 2025
  };
const old = taxData(prior, settings),
  snapshot = groupSnapshot(2025, taxRollups(old.groups)[0]);
const next = assignTaxCategory(settings, taxData(book, settings).groups, 'Supplies', 'Other Expenses', 2026);
assert.equal(taxData(book, next).groups[0].label, 'Other Expenses');
assert.equal(taxData(prior, next).groups[0].label, 'Office Expense');
assert.equal(taxCategoryLabel(next, 2027, 'Supplies', 'Office'), 'Office Expense');
assert.equal(groupSnapshot(2025, taxRollups(taxData(prior, next).groups)[0]), snapshot);
assert.equal(JSON.stringify(settings), before);
assert.deepEqual(next.taxNotes, settings.taxNotes);
const override = assignTaxEntry(next, 2026, 'Paper', 'Hold For Tax Review');
assert.equal(taxData(book, override).expenses.find(r => r.id === 'Paper').taxGroup, 'Hold For Tax Review');
assert.equal(taxData(book, next).missingIncome.length, 1);
assert.equal(taxData(book, next).missing.length, 1);
assert.equal(taxData(book, next).receipts, 500);
assert.equal(taxData(book, next).spending, 50);
assert.throws(() => assignTaxCategory(settings, old.groups, 'Supplies', 'Supplies'));
const w = new JSDOM('<div id="root"></div>', {
  url: 'http://localhost',
  runScripts: 'outside-only'
}).window;
Object.defineProperty(w, 'crypto', {
  value: webcrypto
});
const D = w.Date;
w.Date = class extends D {
  constructor(...a) {
    super(...(a.length ? a : [2026, 9, 16]));
  }
};
w.HTMLElement.prototype.scrollIntoView = () => {};
w.book = book;
w.settings = settings;
let blob;
w.URL.createObjectURL = b => {
  blob = b;
  return 'blob:test';
};
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = () => {};
w.eval(bundleHarness('qa-tax-preparation.jsx'));
const wait = () => new Promise(r => setTimeout(r, 70));
await wait();
await wait();
const d = w.document,
  button = t => [...d.querySelectorAll('button')].find(b => b.textContent.includes(t));
assert.match(d.body.textContent, /Business Income Less Recorded Expenses/);
assert.match(d.body.textContent, /Incomplete · known amounts only/);
assert.match(d.body.textContent, /Expense Group Summary/);
button('Income amounts missing').click();
await wait();
button('Open Entry').click();
assert.deepEqual(Array.from(w.entry), [2026, 'Missing income']);
button('Close List').click();
await wait();
button('Months to reconcile').click();
await wait();
assert.equal(d.querySelectorAll('.tax-attention .report-detail>button').length, 10);
assert.doesNotMatch(d.querySelector('.tax-attention .report-detail').textContent, /November|December/);
button('January 2026 · Open Financial Review').click();
assert.equal(w.month, 'January');
button('Export Tax Preparation Package').click();
const csv = await new Promise(resolve => {
  const reader = new w.FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsText(blob);
});
assert.match(csv, /Income Detail/);
assert.match(csv, /Missing Income Amounts","1/);
assert.match(csv, /Incomplete — known amounts only/);
assert.match(csv, /Before Tax Adjustments/);
button('Expense Groups & Review').click();
await wait();
const select = d.querySelector('.tax-group-choice select');
select.value = 'Other Expenses';
select.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
assert.equal(w.saved.taxGroups['[2026,"Supplies","Office"]'], 'Other Expenses');
assert.equal(w.saved.taxGroups['["Supplies","Office"]'], 'Office Expense');
assert.match(d.body.textContent, /2025 Instructions — Archived Reference/);
w.close();
console.log('PASS tax preparation: year isolation, preserved reviews/notes/overrides, missing income and expense warnings, entry/month navigation, future-month exclusion and package export.');
