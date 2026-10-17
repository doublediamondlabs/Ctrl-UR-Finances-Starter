import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.eval(bundleHarness('qa-recovery-layout.jsx'));
const wait = () => new Promise(r => setTimeout(r, 40));
await wait();
const d = w.document,
  button = t => [...d.querySelectorAll('button')].find(b => b.textContent === t),
  tab = t => [...d.querySelectorAll('.recovery-sections button')].find(b => b.textContent.startsWith(t));
for (let i = 0; i < 30 && !tab('Backup Retention')?.textContent.includes('On'); i++) await wait();
assert.ok([...d.querySelectorAll('.recovery-section-body')].every(p => p.hidden));
assert.match(tab('Backup Retention').textContent, /On/);
assert.ok(!button('Back Up Everything Now').closest('[hidden]'));
assert.match(d.querySelector('.recovery-dashboard').textContent, /C:\/Backups/);
tab('Backup Options').click();
await wait();
assert.equal(d.getElementById('recovery-options-panel').hidden, false);
assert.equal(tab('Backup Options').getAttribute('aria-expanded'), 'true');
const input = d.getElementById('backup-destination');
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, 'D:/NewBackups');
input.dispatchEvent(new w.Event('input', {
  bubbles: true
}));
await wait();
tab('Restore a Backup').click();
await wait();
assert.equal(d.getElementById('recovery-options-panel').hidden, true);
assert.equal(d.getElementById('recovery-restore-panel').hidden, false);
button('Use Last Successful Backup').click();
await wait();
button('Preview Backup').click();
await wait();
assert.ok(button('Restore Into Separate Review Folder'));
tab('Backup Retention').click();
await wait();
assert.equal(d.getElementById('recovery-restore-panel').hidden, true);
tab('Restore a Backup').click();
await wait();
assert.ok(button('Restore Into Separate Review Folder'));
tab('Restore a Backup').click();
await wait();
assert.ok([...d.querySelectorAll('.recovery-section-body')].every(p => p.hidden));
button('Back Up Everything Now').click();
await wait();
assert.equal(w.calls.find(c => c.route === 'backup/create').body.destination, 'D:/NewBackups');
assert.match(d.body.textContent, /Preparing/);
w.close();
console.log('PASS compact recovery: default collapsed, single section, status/actions visible, input and restore-preview preservation, backup request unchanged.');
