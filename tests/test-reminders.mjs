import { bundleHarness } from './helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.eval(bundleHarness('qa-reminders.jsx'));
const wait = () => new Promise(r => setTimeout(r, 70));
await wait();
const d = w.document;
function select(id) {
  const e = d.querySelector('[aria-label="Dealer name"]');
  e.value = id;
  e.dispatchEvent(new w.Event('change', {
    bubbles: true
  }));
}
select('a');
await wait();
assert.match(d.querySelector('.destination-reminder').textContent, /Use east entrance/);
assert.equal(w.job.visits[0].miles, 120);
d.querySelector('.destination-reminder button').click();
await wait();
const area = d.querySelector('.destination-reminder textarea');
Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set.call(area, 'Ask for Sam');
area.dispatchEvent(new w.Event('input', {
  bubbles: true
}));
await wait();
assert.equal(w.job.visits[0].destinationReminderSave, true);
assert.match(d.querySelector('#visit .destination-reminder').textContent, /Ask for Sam/);
let result = w.changeDestinations(w.items, [{
  ...w.job.visits[0],
  miles: 999,
  destination: {
    ...w.job.visits[0].destination,
    address: 'trip-only address'
  }
}]);
assert.equal(result.items[0].reminder, 'Ask for Sam');
assert.equal(result.items[0].miles, 120);
assert.equal(result.items[0].address, '10 North');
assert.equal(result.items[0].notes, 'Original note');
assert.equal(result.items[1].reminder, 'Call first');
assert.equal(w.items[0].reminder, 'Use east entrance');
result = w.changeDestinations(w.items, [{
  ...w.job.visits[0],
  destination: {
    ...w.job.visits[0].destination,
    reminder: ''
  }
}]);
assert.equal(result.items[0].reminder, '');
assert.throws(() => w.changeDestinations([], w.job.visits), /removed/);
assert.throws(() => w.validateDestinations([{
  ...w.items[0],
  reminder: 'x'.repeat(1001)
}]), /1,000/);
const old = structuredClone(w.items[0]);
delete old.reminder;
assert.equal(w.validateDestinations([old])[0].reminder, undefined);
result = w.changeDestinations(w.items, [{
  destinationSave: 'update',
  destination: {
    ...w.items[0],
    reminder: 'stale snapshot'
  },
  miles: 121
}]);
assert.equal(result.items[0].reminder, 'Use east entrance');
assert.equal(result.items[0].miles, 121);
select('b');
await wait();
assert.equal(w.job.visits[0].destinationReminderSave, false);
assert.match(d.querySelector('.destination-reminder').textContent, /Call first/);
assert.doesNotMatch(d.querySelector('.destination-reminder').textContent, /Ask for Sam/);
const source = fs.readFileSync(new URL('../app/Source/InspectionIncome.jsx', import.meta.url), 'utf8');
assert.match(source, /destinationSave,\s*destinationReminderSave,\s*\.\.\.v/);
w.close();
console.log('PASS reminders: per-location display, both inspection/visit editors, drafts, clear, old records, reminder-only mileage/address preservation, deleted destination and length guards.');
