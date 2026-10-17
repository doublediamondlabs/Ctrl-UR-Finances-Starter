import { bundleHarness } from './helpers.mjs';
const testBundle = bundleHarness('qa-review-queue.jsx');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { markReconciliation } from '../app/Source/analytics.js';
import { monthProgress, progressHash } from '../app/Source/monthProgress.js';
import { financialReviewSummary, inspectionReviewSummary } from '../app/Source/reviewQueue.js';
const today = new Date(2026, 9, 12),
  book = {
    year: 2026,
    records: [{
      id: 'expense',
      kind: 'expense',
      category: 'Fuel',
      description: 'Station receipt',
      scope: 'business',
      month: 'February',
      amount: 50,
      state: 'recorded'
    }, {
      id: 'personal',
      kind: 'expense',
      category: 'Residence',
      subCategory: 'Groceries',
      description: 'Grocery receipt',
      scope: 'residence',
      month: 'February',
      amount: 20,
      state: 'recorded'
    }, {
      id: '2026|job',
      kind: 'inspection',
      category: 'Inspection',
      description: 'Sample inspection',
      scope: 'business',
      month: 'February',
      amount: 0,
      state: 'recorded'
    }],
    notes: [],
    transfers: [],
    householdCategories: [],
    incomeSources: [],
    inspectionLedger: {
      sharedVersion: 1,
      jobs: {
        '2026|job': {
          ownerYear: 2026,
          status: 'Completed',
          paymentState: 'no_charge',
          profile: {
            customerName: 'Example',
            rvMake: 'Example',
            rvModel: 'RV',
            locationType: 'private',
            city: 'Exampletown',
            state: 'IL'
          },
          visits: [{
            id: 'visit',
            date: '2026-02-02',
            purpose: 'Initial inspection',
            outcome: 'Completed',
            charge: 'included',
            vehicle: 'Truck',
            miles: 20
          }]
        }
      },
      events: [],
      payouts: [],
      retired: [],
      linkedYears: [2026]
    }
  };
let reporting = markReconciliation(book, {}, 'business', 1);
reporting = markReconciliation(book, reporting, 'personal', 1);
const p = monthProgress(book, 1);
reporting.inspectionProgress = {
  '2026-02': {
    reviewedAt: '2026-10-12T12:00:00Z',
    fingerprint: await progressHash(p.snapshot)
  }
};
book.records[0].amount = 60;
const financial = financialReviewSummary(book, reporting, 'business', 1, today);
assert.equal(financial.state, 'Changed since review');
assert.equal(financial.needs, true);
assert.match(financial.samples[0], /Business expenses → Fuel.*amount/);
assert.equal(inspectionReviewSummary(book, reporting, 1, monthProgress(book, 1), await progressHash(monthProgress(book, 1).snapshot), today).state, 'Reviewed');
assert.equal(financialReviewSummary(book, reporting, 'personal', 1, today).needs, false);
const legacy = {
  reconciled: reporting.reconciled
};
assert.match(financialReviewSummary(book, legacy, 'business', 1, today).reason, /exact changes are unavailable/);
assert.equal(financialReviewSummary(book, legacy, 'business', 1, today).samples.length, 0);
const future = structuredClone(book);
future.records.push({
  ...book.records[0],
  id: 'future',
  month: 'December'
});
assert.equal(financialReviewSummary(future, reporting, 'business', 11, today).needs, false);
assert.equal(financialReviewSummary(book, {}, 'business', 0, today).needs, false);
assert.equal(financialReviewSummary(book, {}, 'business', 1, today).state, 'Not reconciled');
const inspected = structuredClone(book);
inspected.inspectionLedger.jobs['2026|job'].visits[0].miles = 30;
const ip = monthProgress(inspected, 1),
  changed = inspectionReviewSummary(inspected, reporting, 1, ip, await progressHash(ip.snapshot), today);
assert.equal(changed.state, 'Changed since review');
assert.equal(changed.needs, true);
assert.match(changed.reason, /exact earlier field changes were not stored/);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'dangerously',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.TextEncoder = TextEncoder;
Object.defineProperty(w.crypto, 'subtle', {
  value: webcrypto.subtle
});
w.fixture = structuredClone(book);
w.reporting = structuredClone(reporting);
w.eval(testBundle);
const wait = () => new Promise(r => setTimeout(r, 35));
await wait();
await wait();
for (let i = 0; i < 80 && w.document.body.textContent.includes('Checking inspection reviews'); i++) await wait();
const d = w.document,
  sections = d.querySelectorAll('.review-queue-section');
assert.equal(sections.length, 2);
for (const section of sections) {
  assert.equal(section.tagName, "DETAILS");
  assert.equal(section.open, false);
  assert.ok(section.querySelector(":scope > summary strong").textContent.match(/Financial Reconciliation|Inspection Review/));
  section.open = true;
  const rows = [...section.querySelectorAll(':scope > article')];
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.map(r => r.querySelector('summary strong').textContent.split(' ')[0]), ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
  for (const row of rows) {
    assert.equal(row.querySelector('details').open, false);
    assert.ok(!row.querySelector('details').contains(row.querySelector('button')));
  }
}
const queueRow = [...sections[0].querySelectorAll(':scope > article')].find(el => el.textContent.includes('February'));
assert.ok(queueRow);
assert.match(queueRow.textContent, /1 entry changed since financial review/);
assert.equal(sections[1].querySelectorAll(':scope > article.needs-attention').length, 0);
assert.match(sections[1].textContent, /February 2026 · Reviewed/);
queueRow.querySelector('button').click();
await wait();
assert.equal(w.task.domain, 'business');
assert.equal(w.task.month, 1);
assert.equal(w.task.kind, 'financial');
const panel = d.querySelector('.personal-review');
assert.ok(panel.textContent.includes(financial.reason));
assert.match(panel.textContent, /Business expenses/);
panel.querySelector('.personal-review-item button').click();
assert.equal(w.opened.id, 'expense');
panel.querySelector('input[type=checkbox]').click();
await wait();
w.failSave = true;
[...panel.querySelectorAll('button')].find(b => b.textContent === 'Mark Month Reconciled').click();
await wait();
assert.match(panel.textContent, /Save failed for test/);
assert.equal(w.currentReporting.reconciled['2026:business:1'], reporting.reconciled['2026:business:1']);
w.failSave = false;
[...panel.querySelectorAll('button')].find(b => b.textContent === 'Mark Month Reconciled').click();
await wait();
await wait();
assert.match(panel.textContent, /No changes detected since financial reconciliation/);
assert.deepEqual(JSON.parse(JSON.stringify(w.currentReporting.inspectionProgress)), reporting.inspectionProgress);
assert.equal(w.currentReporting.reconciled['2026:personal:1'], reporting.reconciled['2026:personal:1']);
assert.equal(sections[0].querySelectorAll(':scope > article.needs-attention').length, 0);
assert.equal(book.records[0].amount, 60);
w.close();
console.log('PASS separate financial/inspection status; exact finance change reasons and legacy fallback; future/empty grouping; continue/open entry; failed-save retention; reconciliation clears only its own queue, preserving inspection/personal reviews and transactions.');
