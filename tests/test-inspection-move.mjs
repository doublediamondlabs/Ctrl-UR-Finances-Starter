import { bundleHarness } from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { moveInspectionMonth, monthlyIncome, travelRecords } from '../app/Source/inspectionIncome.js';
const tempBundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-feature-'));
const bundlePath = path.join(tempBundleDir, 'test.js');
fs.writeFileSync(bundlePath, bundleHarness('qa-inspection-move.jsx'));
const record = {
  id: '2026|test',
  month: 'January',
  sheet: 'January',
  kind: 'inspection',
  category: 'Inspection',
  subCategory: '',
  description: 'Move fixture',
  amount: 0,
  miles: null,
  state: 'recorded',
  scope: 'business',
  isNew: true
};
const fixture = {
  year: 2026,
  records: [record],
  notes: [{
    id: 'note',
    recordId: record.id,
    text: 'Preserve me',
    storage: 'app',
    sheet: 'January',
    cell: ''
  }],
  bankHistory: [{
    key: 'link',
    recordId: record.id,
    action: 'match'
  }],
  inspectionLedger: {
    sharedVersion: 1,
    linkedYears: [2026],
    jobs: {
      [record.id]: {
        ownerYear: 2026,
        vehicle: '',
        miles: null,
        status: 'Completed',
        reason: 'Keep job',
        visits: [{
          id: 'visit',
          date: '2026-10-08',
          miles: 40,
          vehicle: 'Truck',
          purpose: 'Initial inspection',
          outcome: 'Completed',
          charge: 'included'
        }]
      }
    },
    events: [{
      id: 'payment',
      jobId: record.id,
      type: 'payment',
      date: '2026-10-08',
      amount: 500
    }],
    payouts: [{
      id: 'deposit',
      date: '2026-10-09',
      amount: 500,
      status: 'suggested',
      items: [{
        eventId: 'payment',
        amount: 500,
        date: '2026-10-08'
      }]
    }],
    retired: [],
    sources: [{
      ...record,
      ownerYear: 2026
    }]
  }
};
const before = JSON.stringify(fixture),
  moved = moveInspectionMonth(fixture, record.id, 'October');
assert.equal(JSON.stringify(fixture), before);
assert.equal(moved.records[0].month, 'October');
assert.equal(moved.inspectionLedger.sources[0].month, 'October');
for (const k of ['jobs', 'events', 'payouts', 'retired']) assert.deepEqual(moved.inspectionLedger[k], fixture.inspectionLedger[k]);
assert.deepEqual(moved.notes, fixture.notes);
assert.deepEqual(moved.bankHistory, fixture.bankHistory);
assert.equal(monthlyIncome(moved, 'October').net, 500);
assert.equal(monthlyIncome(moved, 'January').net, 0);
assert.equal(travelRecords(moved)[0].month, 'October');
assert.throws(() => moveInspectionMonth(fixture, record.id, 'Bad'));
assert.throws(() => moveInspectionMonth(fixture, 'missing', 'October'));
assert.throws(() => moveInspectionMonth(fixture, record.id, 'January'));
const undated = structuredClone(fixture);
undated.inspectionLedger.jobs[record.id].visits[0].date = '';
assert.equal(travelRecords(moveInspectionMonth(undated, record.id, 'October'))[0].month, 'October');
const jan = structuredClone(fixture);
jan.inspectionLedger.events[0].date = '2026-01-08';
assert.equal(monthlyIncome(moveInspectionMonth(jan, record.id, 'October'), 'January').net, 500);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'dangerously',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.fixture = structuredClone(fixture);
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.eval(fs.readFileSync(bundlePath, 'utf8'));
const wait = () => new Promise(r => setTimeout(r, 30));
const button = t => [...w.document.querySelectorAll('button')].find(b => b.textContent === t || b.querySelector('strong')?.textContent === t);
await wait();
button('Review Existing Records').click();
await wait();
button('Inspections & Mileage').click();
await wait();
button('Move to Month').click();
await wait();
assert.equal(w.dirty, true);
const select = w.document.querySelector('form select');
select.value = 'October';
select.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
button('Preview Changes').click();
await wait();
assert.match(w.document.body.textContent, /Move from January to October 2026/);
assert.match(w.document.body.textContent, /Income and mileage totals unchanged/);
w.failSave = true;
button('Save Reviewed Changes').click();
await wait();
assert.ok(button('Save Reviewed Changes'));
assert.equal(w.saved, undefined);
w.failSave = false;
button('Save Reviewed Changes').click();
await wait();
assert.equal(w.moved, 9);
assert.equal(w.saved.records[0].month, 'October');
const base = w.codec.blankBook(2026);
let book = w.codec.readBook(base, 2026, true);
Object.assign(book, structuredClone(fixture));
let bytes = w.codec.writeBook(base, book);
book = w.codec.readBook(bytes, 2026, true);
const changed = moveInspectionMonth(book, record.id, 'October');
const registry = w.shared.combine([changed], changed.inspectionLedger);
bytes = w.codec.writeBook(bytes, w.shared.attach(changed, registry));
const round = w.codec.readBook(bytes, 2026, true);
assert.equal(round.records.length, 1);
assert.equal(round.records[0].id, record.id);
assert.equal(round.records[0].month, 'October');
assert.equal(round.records[0].sheet, 'October');
assert.equal(round.notes[0].text, 'Preserve me');
assert.equal(round.notes[0].recordId, record.id);
assert.equal(round.bankHistory[0].recordId, record.id);
assert.equal(round.inspectionLedger.sources[0].month, 'October');
for (const k of ['jobs', 'events', 'payouts']) assert.deepEqual(JSON.parse(JSON.stringify(round.inspectionLedger[k])), fixture.inspectionLedger[k]);
w.close();
console.log('PASS: month move UI, preview, failed-save retention, destination navigation, immutable dates/links, undated mileage, shared registry and workbook save/reopen.');
fs.rmSync(tempBundleDir, {
  recursive: true,
  force: true
});
