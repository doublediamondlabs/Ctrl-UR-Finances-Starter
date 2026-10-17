import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://127.0.0.1'
}).window;
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.eval(bundleHarness('qa-exit-app.jsx'));
const wait = ms => new Promise(r => setTimeout(r, ms || 40));
await wait();
const d = w.document;
const button = t => [...d.querySelectorAll('button')].find(b => b.textContent === t);
const open = () => d.querySelector('.exit-app-button').click();
w.setBlocked(true);
await wait();
open();
await wait();
assert.match(d.querySelector('dialog').textContent, /Finish your open task/);
assert.equal(w.calls.length, 0);
button('Return to Ctrl Ur Finances').click();
await wait();
w.setBlocked(false);
await wait();
open();
await wait();
assert.equal(d.querySelector('.app-shell').inert, true);
button('Keep Working').click();
await wait();
assert.equal(w.calls.length, 0);
open();
await wait();
w.fail = true;
d.querySelector('dialog .primary').click();
await wait();
assert.match(d.querySelector('[role=alert]').textContent, /Backup operation/);
assert.ok(button('Keep Working'));
w.fail = false;
d.querySelector('dialog .primary').click();
await wait(450);
assert.match(d.querySelector('dialog').textContent, /Ctrl Ur Finances has closed/);
assert.equal(w.calls[1].path, 'app/exit');
assert.equal(d.querySelector('.app-shell').inert, true);
w.close();
console.log('PASS exit UI: dirty task blocked, cancel, server refusal retains app, confirmed exit and inert closed page.');
