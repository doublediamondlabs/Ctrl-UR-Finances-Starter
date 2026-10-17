import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.eval(bundleHarness('qa-overview-utilities.jsx'));
const wait = () => new Promise(r => setTimeout(r, 40));
await wait();
const d = w.document,
  button = t => [...d.querySelectorAll('button')].find(b => b.textContent === t),
  tabs = d.querySelectorAll('.overview-utility-tabs>button');
assert.ok([...tabs].every(b => b.getAttribute('aria-expanded') === 'false'));
assert.ok(d.getElementById('overview-backup-panel').hidden);
assert.match(tabs[0].textContent, /Backup needs attention/);
assert.match(tabs[1].textContent, /Locked/);
tabs[1].click();
await wait();
assert.match(tabs[1].textContent, /Locked/);
button('Unlock Link Settings').click();
await wait();
assert.match(tabs[1].textContent, /Unlocked/);
tabs[1].click();
await wait();
assert.ok(d.getElementById('overview-links-panel').hidden);
assert.match(tabs[1].textContent, /Unlocked/);
w.lockLinks();
await wait();
assert.match(tabs[1].textContent, /Locked/);
tabs[0].click();
await wait();
assert.equal(d.getElementById('overview-backup-panel').hidden, false);
button('Open Backup & Recovery').click();
assert.equal(w.recovery, true);
button('2026').click();
assert.equal(w.yearChosen, 2026);
tabs[1].click();
await wait();
assert.ok(d.getElementById('overview-backup-panel').hidden);
w.lockLinks();
w.close();
console.log('PASS default-collapsed utilities, visible backup status, expansion does not unlock, explicit unlock/relock status, recovery and year controls.');
