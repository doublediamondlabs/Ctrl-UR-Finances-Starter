import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../app/', import.meta.url)),
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-income-ui-'));
fs.cpSync(root, tmp, {
  recursive: true,
  filter: src => !src.split(path.sep).includes('node_modules')
});
fs.mkdirSync(path.join(tmp, 'Workbooks'), {
  recursive: true
});
const proc = spawn(process.env.PYTHON || 'python', ['-u', path.join(tmp, 'expense_book.py'), '--no-browser'], {
  stdio: ['ignore', 'pipe', 'pipe']
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let out = '';
proc.stdout.on('data', s => out += s);
proc.stderr.on('data', s => out += s);
async function wait(f, label, ms = 30000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (f()) return;
    await sleep(50);
  }
  fs.writeFileSync(path.join(os.tmpdir(), 'starter-ui-failure.html'), dom?.serialize() || '');
  throw Error('Timeout ' + label + '\n' + out + '\nUI errors: ' + (dom ? [...dom.window.document.querySelectorAll('.error')].map(e => e.textContent).join(' | ') : ''));
}
let dom;
try {
  await wait(() => out.includes('http://127.0.0.1:'), 'startup');
  const url = out.match(/http:\/\/127\.0\.0\.1:\d+\//)[0],
    html = await (await fetch(url)).text(),
    vc = new VirtualConsole(),
    errors = [];
  vc.on('jsdomError', e => {
    errors.push(e.message);
    console.error(e.message);
  });
  vc.on('error', (...a) => errors.push(a.join(' ')));
  dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window,
    d = w.document;
  Object.defineProperty(w.crypto, 'subtle', {
    value: webcrypto.subtle
  });
  w.fetch = (u, o) => fetch(new URL(u, url), o);
  w.structuredClone = structuredClone;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.confirm = () => true;
  w.alert = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  w.eval(fs.readFileSync(path.join(root, 'web/app.js'), 'utf8'));
  const buttons = (t, s = d) => [...s.querySelectorAll('button')].filter(e => e.textContent.trim().toLowerCase() === t.toLowerCase() || e.querySelector('strong')?.textContent.trim().toLowerCase() === t.toLowerCase() || e.querySelector(':scope > span')?.textContent.trim().toLowerCase() === t.toLowerCase()),
    click = async (t, s = d) => {
      await wait(() => buttons(t, s)[0] && !buttons(t, s)[0].disabled, "button ready: " + t);
      await sleep(40);
      const b = buttons(t, s)[0];
      assert.ok(b, 'Missing ' + t);
      assert.ok(!b.disabled, 'Disabled ' + t);
      b.click();
      await sleep(50);
    };
  const set = (el, val) => {
    const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
    el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', {
      bubbles: true
    }));
  };
  await wait(() => buttons('Create household').length, 'setup');
  assert.equal(buttons('Business workspace').length, 0);
  assert.equal(fs.existsSync(path.join(tmp, 'User-Data/linked-workbooks.json')), false);
  const field = (t, scope = d) => [...scope.querySelectorAll('label')].find(l => l.childNodes[0]?.textContent === t)?.querySelector('input,select,textarea');
  async function fill(t, v, scope) {
    const el = field(t, scope);
    assert.ok(el, 'Field ' + t);
    set(el, v);
    await sleep(30);
  }
  await fill('Household name', 'SYNTHETIC HOUSEHOLD');
  await fill('Starting calendar year', '2026');
  await click('Create household');
  await wait(() => buttons('Personal / Household').length && buttons('Reload deadlines & backup status').length, 'household created');
  await wait(() => !buttons('Reload deadlines & backup status')[0].disabled, 'overview ready');
  await sleep(120);
  await click('Customize');
  await sleep(80);
  assert.equal(buttons('Business workspace').length, 0);
  assert.equal(buttons('Family Loan').length, 0);
  assert.equal(buttons('Add loan tracker').length, 0);
  assert.ok(!d.querySelector('.annual-snapshot').textContent.includes('Business expenses'));
  const configPath = path.join(tmp, 'User-Data/linked-workbooks.json');
  let cfg = JSON.parse(fs.readFileSync(configPath));
  assert.deepEqual(cfg.preferences.modules, {
    move: false,
    business: false,
    inspections: false,
    rom: false,
    loans: false,
    family: false
  });
  assert.ok(fs.existsSync(path.join(tmp, cfg.years['2026'].path)));
  assert.equal(cfg.preferences.householdName, 'SYNTHETIC HOUSEHOLD');
  await click('Add deadline');
  await sleep(40);
  await fill('Title', 'SYNTHETIC monthly meeting');
  await fill('Due date', '2024-01-31');
  await fill('Repeat', 'monthly');
  await click('Save deadline');
  await wait(() => d.querySelectorAll('.task-card').length === 1, 'task saved');
  await click('Edit / complete');
  await sleep(40);
  await fill('Completed date (optional)', '2024-02-01');
  await click('Save deadline');
  await wait(() => d.querySelector('.task-card')?.textContent.includes('Feb 29, 2024'), 'monthly successor');
  d.querySelector('[aria-label="Copy SYNTHETIC monthly meeting"]').click();
  await sleep(40);
  assert.equal(field('Due date').value, '');
  await fill('Due date', '2024-04-15');
  await click('Save deadline');
  await wait(() => d.querySelectorAll('.task-card').length === 2, 'copied task saved');
  const taskConfig = JSON.parse(fs.readFileSync(configPath));
  assert.equal(taskConfig.deadlines.length, 3);
  assert.ok(taskConfig.deadlines.some(t => t.completed === '2024-02-01'));
  await click('Personal / Household');
  await wait(() => d.querySelector('.personal-section-tabs'), 'household');
  assert.equal(d.querySelectorAll('.personal-section-tabs [role=tab]').length, 3);
  assert.equal([...d.querySelectorAll('.year-tabs button')].filter(b => b.textContent.includes('Not linked')).length, 0);
  assert.ok(d.querySelector('.household-workspace') || d.querySelector('.expense-column'));
  const salary = d.querySelector('[data-household-category="Salary / Wages"]');
  assert.ok(salary);
  salary.querySelector('.household-category-toggle').click();
  await sleep(60);
  await click('+ Receipt', salary);
  await sleep(60);
  await fill('Statement description', 'SYNTHETIC PAYROLL', d.querySelector('dialog[open]'));
  await fill('Amount ($)', '2000', d.querySelector('dialog[open]'));
  await click('Save Entries To Workbook', d.querySelector('dialog[open]'));
  await wait(() => !d.querySelector('dialog[open]'), 'payroll saved');
  await sleep(70);
  await click('Household expenses', d.querySelector('.personal-section-tabs'));
  await sleep(60);
  const groceries = d.querySelector('[data-household-category="Groceries"]');
  groceries.querySelector('.household-category-toggle').click();
  await sleep(50);
  await click('+ Purchases', groceries);
  await sleep(60);
  await fill('Statement description', 'SYNTHETIC GROCERY', d.querySelector('dialog[open]'));
  await fill('Amount ($)', '125.50', d.querySelector('dialog[open]'));
  await click('Save Entries To Workbook', d.querySelector('dialog[open]'));
  await wait(() => !d.querySelector('dialog[open]'), 'purchase saved');
  await sleep(80);
  assert.ok(d.querySelector('.residence-overview').textContent.includes('$1,874.50'));
  await click('Reload workbook');
  await sleep(100);
  await wait(() => buttons('Reload workbook')[0] && !buttons('Reload workbook')[0].disabled, 'saved entries reload');
  assert.ok(d.querySelector('.residence-overview').textContent.includes('$1,874.50'));
  await click(fs.existsSync(path.join(root, '../PRACTICE-ONLY.txt')) ? 'Find That Thing (Practice)' : 'Find That Thing');
  await wait(() => d.querySelector('.find-controls'), 'search page');
  set(d.querySelector('.find-controls input'), 'SYNTHETIC GROCERY');
  await wait(() => d.querySelectorAll('.find-result').length === 1, 'cross-year search result');
  await click('Open Entry', d.querySelector('.find-result'));
  await wait(() => d.querySelector('dialog[open]'), 'search opens personal entry');
  assert.ok(d.querySelector('dialog[open]').textContent.includes('Edit entry'));
  d.querySelector('dialog[open] [aria-label="Close dialog"]').click();
  await sleep(100);
  await click('Year-end summary');
  await wait(() => d.querySelector('.spending-snapshot'), 'starter spending snapshot');
  assert.equal([...d.querySelectorAll('[aria-label="Spending area"] button')].some(b => b.textContent === 'Business'), false);
  assert.equal(d.querySelectorAll('.snapshot-donut svg').length, 2);
  await click('Full Year');
  d.querySelector('.snapshot-period-picker summary').click();
  await sleep(40);
  await click('2026', d.querySelector('[aria-label="Starting period year"]'));
  await click('Choose Categories');
  await wait(() => d.querySelector('.snapshot-category-picker'), 'category chooser');
  assert.ok(d.querySelector('.snapshot-category-picker').textContent.includes('Groceries'));
  await click('Default Mix');
  await click('Year in the Rearview');
  await wait(() => d.querySelector('.rearview-editor-month'), 'yearbook');
  assert.equal(d.querySelector('.rearview-highlights'), null);
  await fill('Cover title', 'SYNTHETIC YEARBOOK');
  await click('Save Yearbook');
  await wait(() => d.querySelector('.rearview [role=status]')?.textContent.includes('saved'), 'yearbook saved');
  await sleep(100);
  await click('Preview Yearbook');
  await sleep(80);
  assert.ok(d.querySelector('.rearview-cover').textContent.includes('SYNTHETIC YEARBOOK'));
  assert.ok(!d.querySelector('.rearview-printout').textContent.includes('SYNTHETIC GROCERY'));
  await click('Edition & Tribute');
  await wait(() => d.querySelector('.edition-settings'), 'edition editor');
  assert.equal(d.querySelector('aside .loop-edition'), null);
  d.querySelector('.edition-settings input[type=checkbox]').click();
  await sleep(50);
  await fill('Title', 'SYNTHETIC EDITION', d.querySelector('.edition-settings'));
  await click('Save Editions');
  await wait(() => d.querySelector('aside .loop-edition')?.textContent.includes('SYNTHETIC EDITION'), 'edition saved');
  await sleep(100);
  await click('Modules & appearance');
  await wait(() => d.querySelector('.preferences-form'), 'settings');
  async function openBusiness() {
    const toggle = d.querySelector('.sidebar-group-toggle');
    assert.ok(toggle);
    if (toggle.getAttribute('aria-expanded') !== 'true') {
      toggle.click();
      await sleep(40);
    }
    d.querySelector('.sidebar-group-open').click();
    await sleep(80);
  }
  function moduleInput(title) {
    return [...d.querySelectorAll('.module-card')].find(c => c.querySelector('strong')?.textContent === title)?.querySelector('input');
  }
  moduleInput('Inspections & Travel').click();
  await sleep(50);
  assert.equal(moduleInput('Business Finance').checked, true);
  await fill('Dashboard title', 'SYNTHETIC DASHBOARD');
  await fill('Tagline', 'Local test finances');
  await fill('Accent color', 'plum');
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'settings saved');
  await sleep(80);
  assert.ok(buttons('Business workspace').length);
  assert.equal(d.title, 'SYNTHETIC DASHBOARD');
  assert.equal(d.documentElement.style.getPropertyValue('--user-accent'), '#70427d');
  assert.equal(buttons('Family Loan').length, 0);
  console.log('UI checking business');
  await openBusiness();
  await wait(() => buttons('Inspections & Income').length, 'business enabled');
  await click('Inspections & Income');
  await wait(() => buttons('Add inspection').length, 'inspections enabled');
  assert.equal(buttons('RōM · Inspection Travel').length, 0);
  await click('Modules & appearance');
  await wait(() => d.querySelector('.preferences-form'), 'settings again');
  assert.equal(moduleInput('RōM Travel Exchange').checked, false);
  moduleInput('RōM Travel Exchange').click();
  await sleep(40);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'rom enabled');
  await openBusiness();
  assert.ok(buttons('RōM · Inspection Travel').length);
  await click('RōM · Inspection Travel');
  await wait(() => d.querySelector('.rom-transfer'), 'rom workspace');
  await click('← Back', d.querySelector('.rom-transfer'));
  await click('Modules & appearance');
  await wait(() => d.querySelector('.preferences-form'), 'rom settings');
  moduleInput('Business Finance').click();
  await sleep(50);
  assert.equal(moduleInput('Inspections & Travel').checked, false);
  assert.equal(moduleInput('RōM Travel Exchange').checked, false);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'disabled');
  await sleep(80);
  assert.equal(buttons('Business workspace').length, 0);
  moduleInput('Business Finance').click();
  await sleep(40);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'simple business on');
  await sleep(80);
  console.log('UI checking business');
  await openBusiness();
  await wait(() => buttons('Income & refunds').length, 'simple income navigation');
  await click('Income & refunds');
  await sleep(60);
  await click('Add business receipt / refund');
  await sleep(60);
  await fill('Business receipt description', 'SYNTHETIC BUSINESS RECEIPT');
  await fill('Sale or refund amount ($)', '300');
  await click('Save entry to workbook');
  await wait(() => !buttons('Save entry to workbook').length, 'business receipt saved');
  await sleep(100);
  assert.ok(d.body.textContent.includes('SYNTHETIC BUSINESS RECEIPT'));
  await click('Reload workbook');
  await sleep(150);
  await wait(() => buttons('Reload workbook')[0] && !buttons('Reload workbook')[0].disabled, 'business reloaded');
  assert.ok(d.body.textContent.includes('SYNTHETIC BUSINESS RECEIPT'));
  await click('Modules & appearance');
  await wait(() => d.querySelector('.preferences-form'), 'simple business off');
  moduleInput('Business Finance').click();
  await sleep(40);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'simple business hidden');
  await sleep(80);
  assert.equal(buttons('Business workspace').length, 0);
  moduleInput('Family Repayments').click();
  await sleep(30);
  moduleInput('Loan Tracking').click();
  await sleep(30);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'loans enabled');
  await sleep(80);
  await click('Family Loan');
  await wait(() => buttons('Create repayment workbook').length, 'fresh family setup');
  await fill('Borrower name', 'SYNTHETIC BORROWER');
  await fill('Original principal ($)', '1000');
  await fill('Monthly payment ($)', '100');
  await click('Unlock link settings');
  await sleep(30);
  await click('Create repayment workbook');
  await wait(() => d.querySelector('.link-review-dialog[open]'), 'link review');
  d.querySelector('.link-confirm-check input').click();
  await sleep(30);
  await click('Confirm connection change');
  await wait(() => buttons('+ Record payment').length, 'repayment workbook created');
  await click('Agreement & reference');
  await sleep(40);
  await click('Edit terms & reference');
  await sleep(40);
  await fill('Grace days (0–14)', '4');
  await fill('Title', 'SYNTHETIC AGREEMENT');
  await fill('Full text', 'SYNTHETIC PRIVATE REFERENCE');
  await click('Preview changes');
  await sleep(40);
  await click('Save terms & reference');
  await wait(() => buttons('Edit terms & reference').length, 'agreement saved');
  await click('Reload loan');
  await sleep(100);
  assert.ok(d.body.textContent.includes('SYNTHETIC PRIVATE REFERENCE'));
  cfg = JSON.parse(fs.readFileSync(configPath));
  const loanPath = path.join(tmp, cfg.loan.path),
    loanBefore = fs.readFileSync(loanPath);
  assert.ok(loanBefore.length > 0);
  await click('Modules & appearance');
  await wait(() => d.querySelector('.preferences-form'), 'disable family');
  moduleInput('Family Repayments').click();
  await sleep(30);
  moduleInput('Loan Tracking').click();
  await sleep(30);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'family off');
  await sleep(80);
  assert.equal(buttons('Family Loan').length, 0);
  assert.deepEqual(fs.readFileSync(loanPath), loanBefore);
  moduleInput('Family Repayments').click();
  await sleep(40);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'family on');
  await sleep(80);
  await click('Family Loan');
  await wait(() => buttons('+ Record payment').length, 'family restored');
  assert.deepEqual(fs.readFileSync(loanPath), loanBefore);
  assert.ok(d.body.textContent.includes('SYNTHETIC BORROWER'));
  await click('Modules & appearance');
  await wait(() => d.querySelector('.preferences-form'), 'restore defaults');
  await click('Restore appearance defaults');
  await sleep(50);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'defaults saved');
  await sleep(80);
  assert.equal(d.title, 'Ctrl Ur Finances');
  assert.equal(errors.length, 0, errors.join('\n'));
  moduleInput('Move & Housing Planner').click();
  await sleep(40);
  await click('Save settings');
  await wait(() => d.querySelector('.preferences-form .success'), 'planner enabled');
  await sleep(80);
  await click('Move & Housing Planner');
  await wait(() => d.querySelector('.move-planner'), 'planner loaded');
  assert.ok(!d.querySelector('.move-planner').textContent.match(/Texas|Illinois/));
  await click('Save Planner');
  await wait(() => d.body.textContent.includes('Planner saved.'), 'planner saved');
  const savedPlan = JSON.parse(fs.readFileSync(configPath)).movePlanner;
  assert.equal(savedPlan.plans[0].income, '');
  assert.deepEqual(savedPlan.plans[0].obligations, []);
  assert.deepEqual(savedPlan.excluded, {});
  assert.ok(!d.querySelector('.error'));
  console.log('UI planner enabled, generic, saved separately');
  const token = d.querySelector('meta[name="app-token"]').content;
  const api = async (route, body) => {
    const r = await fetch(url + 'api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        'X-App-Token': token,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    return data;
  };
  let backup = await api('backup/create', {});
  while (backup.state === 'running') {
    await sleep(80);
    backup = await api('backup/progress');
  }
  assert.equal(backup.state, 'complete', JSON.stringify(backup));
  backup = backup.result;
  assert.equal(backup.state, 'green');
  assert.ok(fs.existsSync(backup.path));
  const prev = await api('backup/preview', {
      path: backup.path
    }),
    restored = await api('backup/restore', {
      path: prev.path,
      revision: prev.revision
    });
  assert.ok(fs.existsSync(path.join(restored.folder, 'User-Data/linked-workbooks.json')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(restored.folder, 'User-Data/rearview-2026.json'))).title, 'SYNTHETIC YEARBOOK');
  assert.equal(JSON.parse(fs.readFileSync(path.join(restored.folder, 'User-Data/linked-workbooks.json'))).editions.items[0].title, 'SYNTHETIC EDITION');
  assert.equal(JSON.parse(fs.readFileSync(path.join(restored.folder, 'data-location.json'))).path, 'User-Data');
  console.log('PASS fresh UI: setup, generic blank household, no business/loan panels by default, module dependency toggles, title/color/defaults, new family ledger, disable/re-enable preserves ledger, full backup and isolated restore.');
} finally {
  dom?.window.close();
  proc.kill('SIGINT');
  await sleep(400);
  fs.rmSync(tmp, {
    recursive: true,
    force: true
  });
}
