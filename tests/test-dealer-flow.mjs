import { bundleHarness } from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const tempBundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-feature-'));
const bundlePath = path.join(tempBundleDir, 'test.js');
fs.writeFileSync(bundlePath, bundleHarness('qa-dealer-flow.jsx'));
const items = [{
  id: 'dealer',
  name: 'Example East',
  dealerName: "Example Dealer East",
  address: '100 Example Road',
  city: 'Exampletown',
  state: 'KY',
  locationType: 'dealer',
  miles: 156,
  notes: ''
}, {
  id: 'private',
  name: 'Private return visit',
  address: '123 Test St',
  city: 'Anna',
  state: 'IL',
  locationType: 'private',
  miles: 80,
  notes: ''
}];
const job = {
  profile: {
    customerName: 'Keep Customer',
    rvMake: 'RV',
    rvModel: 'Model',
    rvYear: '',
    appointmentId: '',
    quotedFee: null,
    locationType: '',
    dealerName: '',
    city: '',
    state: '',
    address: ''
  },
  visits: [{
    id: 'initial',
    purpose: 'Initial inspection',
    miles: 10
  }, {
    id: 'follow',
    purpose: 'Repair verification',
    miles: 30
  }]
};
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'dangerously',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.job = job;
w.items = items;
w.eval(fs.readFileSync(bundlePath, 'utf8'));
const wait = () => new Promise(r => setTimeout(r, 25));
await wait();
const choose = async (selector, value) => {
  const el = w.document.querySelector(selector);
  assert.ok(el, selector);
  el.value = value;
  el.dispatchEvent(new w.Event('change', {
    bubbles: true
  }));
  await wait();
};
const input = async (selector, value) => {
  const el = w.document.querySelector(selector);
  assert.ok(el, selector);
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new w.Event('input', {
    bubbles: true
  }));
  await wait();
};
await choose('[data-detail="locationType"]', 'dealer');
let chooser = w.document.querySelector('[aria-label="Dealer name"]');
assert.equal(chooser.options.length, 2);
assert.match(chooser.options[0].textContent, /Enter a new dealer/);
assert.equal(chooser.options[1].value, 'dealer');
await choose('[aria-label="Dealer name"]', 'dealer');
assert.equal(w.current.profile.address, '100 Example Road');
assert.equal(w.current.profile.city, 'Exampletown');
assert.equal(w.current.visits[0].miles, 156);
assert.equal(w.current.visits[1].miles, 30);
assert.equal(w.current.profile.customerName, 'Keep Customer');
assert.equal(w.changes().changes.length, 0);
await choose('[aria-label="Dealer name"]', '');
await input('[data-detail="dealerName"]', 'New Dealer');
await input('[data-detail="address"]', 'New Street');
assert.equal(w.changes().changes.length, 0);
w.document.querySelector('input[type="checkbox"]').click();
await wait();
assert.equal(w.changes().items.at(-1).name, 'New Dealer');
assert.equal(w.changes().items.at(-1).address, 'New Street');
assert.equal(w.changes().items.at(-1).locationType, 'dealer');
await choose('[data-detail="locationType"]', 'private');
assert.equal(w.document.querySelector('[aria-label="Dealer name"]'), null);
assert.equal(w.document.querySelector('[aria-label="Private-sale location"]').options.length, 2);
assert.equal(w.changes().changes.length, 0);
await choose('[aria-label="Private-sale location"]', 'private');
assert.equal(w.current.profile.city, 'Anna');
assert.equal(w.current.visits[0].miles, 80);
await choose('[aria-label="Private-sale location"]', '');
await input('[data-detail="address"]', '456 Private Road');
assert.equal(w.changes().changes.length, 0);
w.document.querySelector('input[type="checkbox"]').click();
await wait();
assert.throws(() => w.changes(), /short name/);
const name = [...w.document.querySelectorAll('label')].find(l => l.textContent.startsWith('Destination short')).querySelector('input');
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(name, 'Private return stop');
name.dispatchEvent(new w.Event('input', {
  bubbles: true
}));
await wait();
assert.equal(w.changes().items.at(-1).locationType, 'private');
assert.equal(w.changes().items.at(-1).address, '456 Private Road');
assert.equal(items.length, 2);
assert.equal(items[0].miles, 156);
w.close();
console.log('PASS Dealer -> saved list -> location/mileage fill; new dealer manual entry and optional save; private-sale manual/reuse/save; shared list and follow-up preservation.');
fs.rmSync(tempBundleDir, {
  recursive: true,
  force: true
});
