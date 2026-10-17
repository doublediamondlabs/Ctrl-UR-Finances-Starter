import { bundleHarness } from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { validateLedger, moveInspectionMonth, monthlyIncome, travelRecords } from '../app/Source/inspectionIncome.js';
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
fixture.inspectionLedger.jobs[record.id].profile = {
  customerName: 'Test Customer',
  rvMake: 'Test',
  rvModel: 'RV',
  locationType: 'dealer',
  dealerName: 'Test Dealer',
  city: 'Sampletown',
  state: 'KY',
  quotedFee: null
};
fixture.inspectionLedger.jobs[record.id].visits.push({
  id: 'follow',
  date: '2026-10-08',
  miles: 25,
  vehicle: 'Truck',
  purpose: 'Repair verification',
  outcome: 'Completed',
  charge: 'included'
});
const destination = {
  id: 'murray',
  name: 'Example East',
  address: '100 Example Road',
  zip: '01234-5678',
  city: 'Exampletown',
  state: 'KY',
  locationType: 'dealer',
  notes: 'Usual route',
  miles: 120
};
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'dangerously',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.fixture = structuredClone(fixture);
w.reporting = {
  savedDestinations: [destination]
};
w.eval(fs.readFileSync(bundlePath, 'utf8'));
const wait = () => new Promise(r => setTimeout(r, 30));
const button = t => [...w.document.querySelectorAll('button')].find(b => b.textContent === t || b.querySelector('strong')?.textContent === t);
await wait();
button('Review Existing Records').click();
await wait();
button('Inspections & Mileage').click();
await wait();
button('Edit Inspection & Payments').click();
await wait();
button('Add Phone Number').click();
await wait();
for (const [key, value] of Object.entries({
  customerPhone: '+1 (555) 010-1234 ext. 07',
  vin: '0012-OLDER-RV'
})) {
  const el = w.document.querySelector('[data-detail=' + key + ']');
  assert.equal(el.required, key === 'customerPhone');
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new w.Event('input', {
    bubbles: true
  }));
  await wait();
}
const select = w.document.querySelector('[aria-label="Dealer name"]');
select.value = 'murray';
select.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
for (const [key, value] of Object.entries({
  address: '100 Example Road',
  zip: '01234-5678',
  city: 'Exampletown',
  state: 'KY',
  locationType: 'dealer'
})) assert.equal(w.document.querySelector('[data-detail="' + key + '"]').value, value);
const miles = [...w.document.querySelectorAll('.visit-editor label')].filter(l => l.textContent.startsWith('Actual miles driven')).map(l => l.querySelector('input').value);
assert.deepEqual(miles, ['120', '25']);
const city = w.document.querySelector('[data-detail="city"]');
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(city, 'Corrected City');
city.dispatchEvent(new w.Event('input', {
  bubbles: true
}));
await wait();
const followPanel = w.document.querySelectorAll('.visit-editor')[1];
[...followPanel.querySelectorAll('button')].find(b => b.textContent === 'Use Main Inspection Location').click();
await wait();
const update = [...w.document.querySelectorAll('label')].find(l => l.textContent.startsWith('Update saved destination with these location'));
assert.equal(update.querySelector('input').checked, false);
update.querySelector('input').click();
await wait();
button('Continue To Customer Payment').click();
await wait();
const paidBy = [...w.document.querySelectorAll('label')].find(l => l.textContent.startsWith('Paid By (optional)')).querySelector('input');
assert.equal(paidBy.required, false);
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(paidBy, 'Synthetic Parent LLC');
paidBy.dispatchEvent(new w.Event('input', {
  bubbles: true
}));
await wait();
button('Continue To Bank Connection').click();
await wait();
button('Review Inspection Before Saving').click();
await wait();
assert.ok(button('Save Reviewed Changes'), w.document.body.textContent);
button('Save Reviewed Changes').click();
await wait();
assert.equal(w.destinationSave.items[0].city, 'Corrected City');
assert.equal(w.destinationSave.items[0].miles, 120);
const job = w.saved.inspectionLedger.jobs[record.id];
assert.equal(job.profile.customerPhone, '+1 (555) 010-1234 ext. 07');
assert.equal(job.profile.vin, '0012-OLDER-RV');
assert.equal(job.profile.zip, '01234-5678');
assert.equal(w.destinationSave.items[0].zip, '01234-5678');
assert.equal(job.profile.city, 'Corrected City');
assert.equal(job.profile.customerName, 'Test Customer');
assert.equal(job.visits[0].destination.city, 'Corrected City');
assert.equal(job.visits[1].miles, 25);
assert.equal(job.visits[1].destination.city, 'Corrected City');
assert.equal(job.visits[1].destinationForLocation, false);
assert.deepEqual(JSON.parse(JSON.stringify(w.saved.inspectionLedger.events)), fixture.inspectionLedger.events.map(e => ({
  ...e,
  paidBy: 'Synthetic Parent LLC'
})));
const invalidPaidBy = structuredClone(w.saved);
invalidPaidBy.inspectionLedger.events[0].paidBy = 'x'.repeat(201);
assert.throws(() => validateLedger(invalidPaidBy), /Paid By/);
const blankPaidBy = structuredClone(w.saved);
blankPaidBy.inspectionLedger.events[0].paidBy = '';
validateLedger(blankPaidBy);
const legacy = w.locationHelpers.chooseInspectionDestination(fixture.inspectionLedger.jobs[record.id], {
  id: 'legacy',
  name: 'Older dealer',
  address: 'Full address saved before',
  miles: 80
});
assert.equal(legacy.profile.city, '');
assert.equal(legacy.profile.state, '');
assert.equal(legacy.profile.address, 'Full address saved before');
assert.equal(legacy.visits[1].miles, 25);
assert.equal(fixture.inspectionLedger.jobs[record.id].visits[0].miles, 40);
// Structured destination fields survive workbook serialization.
const base = w.codec.blankBook(2026),
  book = w.codec.readBook(base, 2026, true);
Object.assign(book, structuredClone(w.saved));
const round = w.codec.readBook(w.codec.writeBook(base, book), 2026, true);
assert.equal(round.inspectionLedger.events[0].paidBy, 'Synthetic Parent LLC');
assert.equal(round.inspectionLedger.events[0].amount, 500);
assert.equal(round.inspectionLedger.payouts[0].amount, 500);
assert.equal(round.inspectionLedger.jobs[record.id].profile.customerPhone, '+1 (555) 010-1234 ext. 07');
assert.equal(round.inspectionLedger.jobs[record.id].profile.vin, '0012-OLDER-RV');
assert.equal(round.inspectionLedger.jobs[record.id].profile.zip, '01234-5678');
assert.equal(round.inspectionLedger.jobs[record.id].profile.city, 'Corrected City');
assert.equal(round.inspectionLedger.jobs[record.id].visits[0].destination.state, 'KY');
assert.equal(round.inspectionLedger.jobs[record.id].visits[1].destination.city, 'Corrected City');
assert.equal(round.inspectionLedger.jobs[record.id].visits[1].miles, 25);
const fresh = structuredClone(fixture.inspectionLedger.jobs[record.id]);
fresh.profile.dealerName = '';
fresh.visits[0].destination = {
  id: 'new',
  name: ''
};
fresh.visits[0].destinationSave = 'new';
fresh.visits[0].destinationForLocation = true;
const typed = w.locationHelpers.applyLocationProfile(fresh, {
  ...fresh.profile,
  dealerName: 'New Dealer'
});
assert.equal(typed.visits[0].destination.name, 'New Dealer');
w.close();
console.log('PASS inspection-location selector, dealer/address/city/state fill, initial mileage, follow-up preservation, opt-in default update, legacy address compatibility and workbook roundtrip.');
fs.rmSync(tempBundleDir, {
  recursive: true,
  force: true
});
