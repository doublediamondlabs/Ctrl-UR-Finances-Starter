import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.eval(bundleHarness('qa-backup-retention.jsx'));
const wait = () => new Promise(r => setTimeout(r, 40));
await wait();
const d = w.document,
  button = t => [...d.querySelectorAll('button')].find(b => b.textContent === t);
assert.equal(d.querySelector('details').open, false);
assert.match(d.querySelector('summary').textContent, /Off/);
button('Review Folders & Enable').click();
await wait();
assert.match(d.body.textContent, /Scanning backup folders/);
assert.match(d.body.textContent, /42 items checked/);
assert.ok(!button('Cancel Scan').disabled);
assert.ok(button('Review Folders & Enable').closest('fieldset').disabled);
button('Cancel Scan').click();
await wait();
assert.match(d.body.textContent, /Folder scan cancelled/);
assert.ok(!w.calls.some(c => c.body?.enabled));
button('Review Folders & Enable').click();
await wait();
w.finishScan();
for (let i = 0; i < 40 && !button('Enable Automatic Retention'); i++) await wait();
assert.match(d.body.textContent, /Synthetic\/Expense-Book-Backups\/Annual/);
assert.match(d.body.textContent, /2.0 MB/);
assert.ok(!w.calls.some(c => c.body?.enabled));
button('Enable Automatic Retention').click();
await wait();
assert.match(d.querySelector('summary').textContent, /On/);
assert.ok(w.calls.some(c => c.body?.reviewed));
button('Turn Retention Off').click();
await wait();
assert.match(d.querySelector('summary').textContent, /Off/);
w.close();
console.log('PASS collapsed retention, immediate progress, poll completion, cancellation, review before enabling and disable.');
