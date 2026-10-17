import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
import { dealerVisits, dealerVisitCSV } from '../app/Source/dealerVisits.js';
const visit = {
  id: 'v',
  date: '2026-04-10',
  purpose: 'Other follow-up',
  outcome: 'Completed',
  miles: 80,
  vehicle: 'Truck'
};
const profile = {
  locationType: 'dealer',
  dealerName: 'One Time Dealer',
  address: '123 Road',
  city: 'Anna',
  state: 'IL',
  zip: '01234'
};
const book = {
  year: 2026,
  inspectionLedger: {
    jobs: {
      j: {
        profile,
        visits: [visit]
      }
    }
  }
};
const row = {
  id: 'j',
  visitId: 'v',
  inspectionDate: visit.date,
  month: 'April',
  vehicle: 'Truck',
  miles: 80,
  label: 'Synthetic customer',
  purpose: visit.purpose,
  inspectionStatus: visit.outcome
};
const report = dealerVisits(book, [row]),
  r = report.review[0],
  acks = {
    [r.reviewKey]: {
      signature: r.signature,
      note: 'Unable to reconstruct location',
      reviewedAt: '2026-10-15T00:00:00Z'
    }
  };
const acknowledged = dealerVisits(book, [row], 'All', JSON.parse(JSON.stringify(acks)));
assert.equal(acknowledged.review.length, 0);
assert.equal(acknowledged.acknowledged.length, 1);
assert.equal(acknowledged.groups.length, 0);
assert.equal(row.miles, 80);
assert.ok(dealerVisitCSV(acknowledged).some(x => x.includes('Unable to reconstruct location')));
assert.equal(dealerVisits(book, [{
  ...row,
  miles: 84
}], 'All', acks).review.length, 1);
assert.equal(dealerVisits({
  ...book,
  year: 2025
}, [row], 'All', acks).review.length, 1);
assert.equal(dealerVisits(book, [row], 'All', {}).review.length, 1);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.visit = visit;
w.profile = profile;
w.items = [{
  id: 'saved',
  name: 'Saved Branch',
  address: '456 Road',
  city: 'Elsewhere',
  state: 'IL',
  notes: '',
  miles: 200
}];
w.report = {
  ...report,
  acknowledged: acknowledged.acknowledged
};
w.eval(bundleHarness('qa-visit-location.jsx'));
const wait = () => new Promise(r => setTimeout(r, 30));
await wait();
const button = t => [...w.document.querySelectorAll('button')].find(b => b.textContent === t);
button('Use Main Inspection Location').click();
await wait();
assert.equal(w.currentVisit.destination.address, '123 Road');
assert.equal(w.currentVisit.destination.zip, '01234');
assert.equal(w.currentVisit.miles, 80);
assert.equal(w.currentVisit.destinationSave, '');
const copied = structuredClone(w.currentVisit.destination);
profile.address = 'Changed later';
assert.equal(copied.address, '123 Road');
const resolved = structuredClone(book);
resolved.inspectionLedger.jobs.j.visits[0].destination = copied;
assert.equal(dealerVisits(resolved, [row], 'All', acks).groups.length, 1);
assert.equal(dealerVisits(resolved, [row], 'All', acks).acknowledged.length, 0);
assert.equal(w.destinationChanges(w.items, [w.currentVisit]).changes.length, 0);
button('Enter One-Time Location').click();
await wait();
assert.equal(w.currentVisit.destination.name, '');
assert.equal(w.currentVisit.miles, 80);
assert.equal(w.currentVisit.destinationSave, '');
const input = [...w.document.querySelectorAll('label')].find(l => l.textContent.startsWith('Short / common name')).querySelector('input');
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, 'One-off branch');
input.dispatchEvent(new w.Event('input', {
  bubbles: true
}));
await wait();
assert.equal(w.currentVisit.destination.name, 'One-off branch');
assert.equal(w.destinationChanges(w.items, [w.currentVisit]).items.length, 1);
button('Choose Saved Destination').click();
await wait();
const select = [...w.document.querySelectorAll('label')].find(l => l.textContent.startsWith('Saved destination')).querySelector('select');
select.value = 'saved';
select.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
assert.equal(w.currentVisit.miles, 200);
assert.equal(w.currentVisit.destination.id, 'saved');
const form = w.document.querySelector('form');
form.querySelector('textarea').value = 'Unable to reconstruct location';
form.dispatchEvent(new w.Event('submit', {
  bubbles: true,
  cancelable: true
}));
assert.equal(w.reviewSave.note, 'Unable to reconstruct location');
button('Reopen Classification Review').click();
assert.equal(w.reviewSave.note, null);
w.close();
console.log('PASS explicit location copy, one-time location without saved default, saved mileage selection, historical isolation, acknowledgement scope/persistence, changed-data reopening, resolved record recovery, CSV, note submission and reopen.');
