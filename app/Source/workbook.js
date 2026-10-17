import { attach } from './sharedInspections.js';
import { ledger as inspectionLedger, incomeRecords, travelRecords, validateLedger, jobLabel, allVisits } from './inspectionIncome.js';
import { validateTransfer } from './transfers.js';
import { initializeHousehold } from './household.js';
import { zipSync, strToU8 } from 'fflate';
import { open, setCell, getCell, els, attr, text, NS, xml, importBook as legacyImport, months, categories, encode } from './import-legacy.ts';
export { months, encode };
export const baseCategories = [...categories, 'Residence'];
const sum = (a, key = 'amount') => Math.round(a.reduce((n, e) => n + (e[key] ?? 0), 0) * 100) / 100;
const cellnum = c => Number(c.replace(/\D/g, ''));
const getRows = s => els(s.doc, 'row').map(r => Number(attr(r, 'r'))).filter(n => n > 1);
const cellVal = (s, c) => !c || s.get(c) === '' ? null : Number(s.get(c));
function notesFrom(w) {
  const ns = [];
  for (const s of w.sheets) if (s.comments) for (const c of els(s.comments, 'comment')) ns.push({
    id: s.name + '!' + attr(c, 'ref'),
    sheet: s.name,
    cell: attr(c, 'ref'),
    text: els(c, 't').map(x => x.textContent).join(''),
    storage: 'native'
  });
  return ns;
}
function readRawBook(base64, year) {
  const w = open(base64),
    index = w.sheets.find(s => s.name === 'DD Index');
  if (index) {
    const info = w.sheets.find(s => s.name === 'DD Settings'),
      settings = {};
    if (info) for (const r of getRows(info)) {
      try {
        settings[info.get('A' + r)] = JSON.parse(info.get('B' + r));
      } catch {}
    }
    if (settings.year && Number(settings.year) !== Number(year)) throw Error(`This workbook belongs to ${settings.year}. Select that year before linking it.`);
    if (!settings.inspectionLedger) {
      const parts = Object.keys(settings).filter(k => /^inspectionLedgerPart\d+$/.test(k)).sort((a, b) => Number(a.replace('inspectionLedgerPart', '')) - Number(b.replace('inspectionLedgerPart', '')));
      if (parts.length) settings.inspectionLedger = JSON.parse(parts.map(k => settings[k]).join(''));
    }
    const records = [];
    for (const r of getRows(index)) {
      const id = index.get('A' + r);
      if (!id) continue;
      const sheet = index.get('F' + r),
        s = w.sheets.find(s => s.name === sheet);
      if (!s) throw Error('A linked worksheet is missing: ' + sheet);
      const ac = index.get('G' + r),
        dc = index.get('H' + r),
        mc = index.get('I' + r),
        lc = index.get('J' + r);
      records.push({
        id,
        month: index.get('B' + r),
        kind: index.get('C' + r),
        category: index.get('D' + r),
        subCategory: index.get('E' + r),
        sheet,
        amountCell: ac,
        descriptionCell: dc,
        milesCell: mc,
        locationCell: lc,
        state: index.get('K' + r) || 'recorded',
        scope: index.get('L' + r) || 'business',
        percent: index.get('M' + r) === '' ? null : Number(index.get('M' + r)),
        recurringType: index.get('N' + r) || 'fixed',
        householdCategoryId: index.get('O' + r) || '',
        householdSubId: index.get('P' + r) || '',
        transactionDate: index.get('Q' + r) || '',
        amount: cellVal(s, ac),
        description: s.get(dc) || index.get('E' + r) || '',
        miles: cellVal(s, mc),
        location: lc ? s.get(lc) : ''
      });
    }
    const native = notesFrom(w),
      notes = [],
      notetab = w.sheets.find(s => s.name === 'DD Notes');
    if (notetab) for (const r of getRows(notetab)) {
      const id = notetab.get('A' + r);
      if (!id) continue;
      const n = {
        id,
        sheet: notetab.get('B' + r),
        cell: notetab.get('C' + r),
        recordId: notetab.get('D' + r) || undefined,
        storage: notetab.get('E' + r),
        text: notetab.get('F' + r)
      };
      if (n.storage === 'native') n.text = native.find(x => x.id === id)?.text || '';
      if (n.storage === 'inline') n.text = w.sheets.find(s => s.name === n.sheet)?.get(n.cell) || '';
      notes.push(n);
    }
    for (const n of native) if (n.text && !notes.some(x => x.id === n.id)) {
      const e = records.find(e => e.sheet === n.sheet && (n.cell === e.amountCell || n.cell === e.descriptionCell || n.cell === e.locationCell));
      notes.push({
        ...n,
        recordId: e?.id
      });
    }
    const bankHistory = [],
      bankSheet = w.sheets.find(s => s.name === 'DD Bank');
    if (bankSheet) for (const r of getRows(bankSheet)) {
      const key = bankSheet.get('A' + r);
      if (!key) continue;
      bankHistory.push({
        key,
        date: bankSheet.get('B' + r),
        type: bankSheet.get('C' + r),
        description: bankSheet.get('D' + r),
        category: bankSheet.get('E' + r),
        amount: Number(bankSheet.get('F' + r)),
        balance: bankSheet.get('G' + r) === '' ? null : Number(bankSheet.get('G' + r)),
        note: bankSheet.get('H' + r),
        action: bankSheet.get('I' + r),
        recordId: bankSheet.get('J' + r),
        reason: bankSheet.get('K' + r),
        saved: bankSheet.get('L' + r),
        file: bankSheet.get('M' + r),
        signature: bankSheet.get('N' + r)
      });
    }
    const transfers = [],
      transferSheet = w.sheets.find(s => s.name === 'DD Transfers');
    if (transferSheet) for (const r of getRows(transferSheet)) {
      if (transferSheet.get('A' + r)) transfers.push({
        id: transferSheet.get('A' + r),
        date: transferSheet.get('B' + r),
        amount: Number(transferSheet.get('C' + r)),
        from: transferSheet.get('D' + r),
        to: transferSheet.get('E' + r),
        scope: transferSheet.get('F' + r) || 'personal',
        note: transferSheet.get('G' + r) || '',
        sourceId: transferSheet.get('H' + r) || '',
        originalAmount: transferSheet.get('I' + r) === '' ? null : Number(transferSheet.get('I' + r)),
        originalDescription: transferSheet.get('J' + r) || ''
      });
    }
    return initializeHousehold({
      year: Number(year),
      records,
      notes,
      bankHistory,
      transfers,
      inspectionLedger: settings.inspectionLedger,
      householdCategories: settings.householdCategories,
      incomeSources: settings.incomeSources,
      categories: settings.categories || baseCategories.map(name => ({
        name,
        subs: name === 'Residence' ? ['Electric', 'Water', 'Sewer', 'Internet', 'Phone', 'Insurance', 'Housing', 'Other'] : [],
        role: name === 'Recurring Expenses' ? 'recurring' : name === 'Residence' ? 'residence' : 'expense'
      })),
      summaryRefs: settings.summaryRefs || {},
      converted: true
    });
  }
  const legacy = legacyImport(base64, String(year));
  const records = legacy.records.map(e => ({
    ...e,
    state: Number(year) > new Date().getFullYear() || Number(year) === new Date().getFullYear() && months.indexOf(e.month) >= new Date().getMonth() && e.category === 'Recurring Expenses' ? 'planned' : 'recorded',
    scope: 'business',
    percent: null,
    recurringType: 'fixed',
    isNew: false
  }));
  const registry = baseCategories.map(name => ({
    name,
    subs: name === 'Residence' ? ['Electric', 'Water', 'Sewer', 'Internet', 'Phone', 'Insurance', 'Housing', 'Other'] : [],
    role: name === 'Recurring Expenses' ? 'recurring' : name === 'Residence' ? 'residence' : 'expense'
  }));
  for (const s of w.sheets.filter(s => months.includes(s.name))) {
    let cat = '';
    for (const r of getRows(s)) {
      const b = s.get('B' + r);
      if (baseCategories.includes(b)) cat = b;
      const sub = s.get('C' + r);
      if (sub && cat) {
        const c = registry.find(c => c.name === cat);
        if (c && !c.subs.includes(sub)) c.subs.push(sub);
      }
      if (cat === 'Recurring Expenses' && sub && !records.some(e => e.sheet === s.name && e.amountCell === 'E' + r)) {
        records.push({
          id: s.name + '!E' + r,
          month: s.name,
          kind: 'expense',
          category: cat,
          subCategory: sub,
          description: s.get('D' + r) || sub,
          amount: cellVal(s, 'E' + r),
          miles: null,
          location: '',
          sheet: s.name,
          amountCell: 'E' + r,
          descriptionCell: 'D' + r,
          state: Number(year) < new Date().getFullYear() ? 'recorded' : 'planned',
          scope: 'business',
          percent: null,
          recurringType: 'variable'
        });
      }
    }
  }
  const nativeIds = new Set(notesFrom(w).map(n => n.id));
  const notes = legacy.notes.map(n => ({
    ...n,
    storage: nativeIds.has(n.id) ? 'native' : 'app'
  }));
  for (const e of records.filter(e => e.kind === 'inspection')) {
    const s = w.sheets.find(s => s.name === e.sheet),
      r = cellnum(e.amountCell);
    for (const col of ['L', 'M', 'N']) {
      const value = s.get(col + r);
      if (value) notes.push({
        id: 'inline-' + e.sheet + '!' + col + r,
        sheet: e.sheet,
        cell: col + r,
        recordId: e.id,
        text: value,
        storage: 'inline'
      });
    }
  }
  return initializeHousehold({
    year: Number(year),
    records,
    notes,
    categories: registry,
    summaryRefs: {},
    converted: false
  });
}
function appendSheet(w, name, rows, widths = []) {
  let s = w.sheets.find(s => s.name === name);
  const doc = xml(`<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData/></worksheet>`);
  rows.forEach((r, i) => r.forEach((v, j) => setCell(doc, String.fromCharCode(65 + j) + (i + 1), v)));
  if (s) {
    s.doc = doc;
    return s;
  }
  const max = Math.max(0, ...w.sheets.map(s => Number(s.path.match(/sheet(\d+)/)?.[1] || 0))) + 1,
    path = `xl/worksheets/sheet${max}.xml`,
    id = 'rIdDDB' + max;
  const sh = w.wb.createElementNS(NS, 'sheet');
  sh.setAttribute('name', name);
  sh.setAttribute('sheetId', String(Math.max(0, ...els(w.wb, 'sheet').map(x => Number(attr(x, 'sheetId')))) + 1));
  sh.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'r:id', id);
  els(w.wb, 'sheets')[0].appendChild(sh);
  const rel = w.rel.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
  rel.setAttribute('Id', id);
  rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet');
  rel.setAttribute('Target', 'worksheets/sheet' + max + '.xml');
  w.rel.documentElement.appendChild(rel);
  const ct = w.read('[Content_Types].xml'),
    ov = ct.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types', 'Override');
  ov.setAttribute('PartName', '/' + path);
  ov.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
  ct.documentElement.appendChild(ov);
  w.files['[Content_Types].xml'] = strToU8(new XMLSerializer().serializeToString(ct));
  s = {
    name,
    path,
    doc,
    cells: new Map(),
    get: () => ''
  };
  w.sheets.push(s);
  return s;
}
function formula(s, ref, f, value) {
  setCell(s.doc, ref, f, true);
  const c = getCell(s.doc, ref);
  const v = s.doc.createElementNS(NS, 'v');
  v.textContent = String(Math.round(value * 100) / 100);
  c.appendChild(v);
}
function refsFormula(rows, key = 'amountCell') {
  const refs = rows.map(e => e[key]).filter(Boolean);
  return refs.length ? 'SUM(' + refs.join(',') + ')' : '0';
}
function validate(data) {
  validateLedger(data);
  const transferIds = new Set();
  for (const t of data.transfers || []) {
    validateTransfer(t, data.year);
    if (transferIds.has(t.id)) throw Error('Duplicate transfer ID.');
    transferIds.add(t.id);
  }
  const ids = new Set();
  for (const e of data.records) {
    if (ids.has(e.id)) throw Error('Duplicate entry IDs were found. Reload the workbook.');
    ids.add(e.id);
    if (!months.includes(e.month)) throw Error('Invalid entry month.');
    if (e.transactionDate) {
      const d = new Date(e.transactionDate + 'T12:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.transactionDate) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== e.transactionDate || d.getUTCFullYear() !== data.year || d.getUTCMonth() !== months.indexOf(e.month)) throw Error('Entry date must be within ' + e.month + ' ' + data.year + '.');
    }
    for (const key of ['amount', 'miles', 'percent']) if (e[key] !== null && e[key] !== undefined && !Number.isFinite(e[key])) throw Error('Use a valid number for ' + key);
    if (e.percent !== null && (e.percent < 0 || e.percent > 100)) throw Error('Business-use percentage must be between 0 and 100.');
    if (e.miles !== null && e.miles < 0) throw Error('Miles cannot be negative.');
    if (!['planned', 'recorded'].includes(e.state)) throw Error('Choose planned or recorded for the entry.');
  }
  for (const n of data.notes) if (n.text.length > 30000) throw Error('A note is too long for Excel. Keep it under 30,000 characters.');
}
export function writeBook(base64, input) {
  const data = initializeHousehold(structuredClone(input));
  validate(data);
  const w = open(base64),
    before = attach(readRawBook(base64, data.year), input.inspectionLedger),
    used = {};
  for (const m of months) {
    const s = w.sheets.find(s => s.name === m);
    if (!s) throw Error('Worksheet missing: ' + m);
    used[m] = Math.max(3, ...els(s.doc, 'row').map(x => Number(attr(x, 'r'))));
  }
  // Removing an entry clears its original input cells without shifting other references.
  for (const old of before.records) {
    const cur = data.records.find(e => e.id === old.id);
    if (!cur || cur.month !== old.month) {
      const s = w.sheets.find(s => s.name === old.sheet);
      if (s) for (const c of [old.amountCell, old.descriptionCell, old.milesCell, old.locationCell]) if (c) setCell(s.doc, c, null);
      if (cur) {
        cur.amountCell = null;
        cur.descriptionCell = null;
        cur.milesCell = null;
        cur.locationCell = null;
        cur.sheet = cur.month;
      }
    }
  }
  for (const e of data.records) {
    let s = w.sheets.find(s => s.name === e.sheet);
    if (!e.amountCell || e.sheet === 'Monthly Expenses' || e.isNew) {
      s = w.sheets.find(s => s.name === e.month);
      const row = ++used[e.month];
      e.sheet = e.month;
      e.amountCell = (e.kind === 'inspection' ? 'J' : 'E') + row;
      e.descriptionCell = (e.kind === 'inspection' ? 'O' : 'D') + row;
      if (e.kind === 'inspection') {
        e.milesCell = 'I' + row;
        e.locationCell = 'K' + row;
      } else {
        e.milesCell = '';
        e.locationCell = '';
      }
      e.isNew = false;
    }
    if (!e.descriptionCell) e.descriptionCell = (e.kind === 'inspection' ? 'O' : 'D') + cellnum(e.amountCell);
    setCell(s.doc, e.amountCell, e.amount);
    setCell(s.doc, e.descriptionCell, e.description);
    if (e.kind !== 'inspection') {
      setCell(s.doc, 'B' + cellnum(e.amountCell), e.category);
      setCell(s.doc, 'C' + cellnum(e.amountCell), e.subCategory || '');
    } else {
      if (e.milesCell) setCell(s.doc, e.milesCell, e.miles);
      if (e.locationCell) setCell(s.doc, e.locationCell, e.location);
    }
  }
  // Keep native Excel comments in their original cells. New notes have explicit cell links in DD Notes.
  for (const s of w.sheets) if (s.comments) for (const c of els(s.comments, 'comment')) {
    const id = s.name + '!' + attr(c, 'ref'),
      n = data.notes.find(n => n.id === id);
    const old = before.notes.find(n => n.id === id);
    if (n || old) {
      const t = els(c, 'text')[0];
      while (t.firstChild) t.removeChild(t.firstChild);
      const el = s.comments.createElementNS(NS, 't');
      el.setAttribute('xml:space', 'preserve');
      el.textContent = n?.text || '';
      t.appendChild(el);
    }
  }
  for (const n of data.notes) {
    if (n.storage === 'inline') {
      const s = w.sheets.find(s => s.name === n.sheet);
      if (s) setCell(s.doc, n.cell, n.text);
    }
    if (n.storage !== 'native' && n.storage !== 'inline' && n.recordId) {
      const e = data.records.find(e => e.id === n.recordId);
      if (e) {
        n.sheet = e.sheet;
        n.cell = e.amountCell;
      }
    }
  }
  for (const old of before.notes.filter(n => n.storage === 'inline' && !data.notes.some(x => x.id === n.id))) {
    const s = w.sheets.find(s => s.name === old.sheet);
    if (s) setCell(s.doc, old.cell, null);
  }
  const il = inspectionLedger(data);
  const incomeSheet = appendSheet(w, 'DD Income', [['Event ID', 'Inspection ID', 'Customer / inspection', 'Date', 'Type', 'Positive amount', 'Signed income', 'Note', 'Paid By'], ...il.events.map(e => [e.id, e.jobId, jobLabel(data, e.jobId), e.date, e.type, e.amount, e.type === 'refund' ? -e.amount : e.amount, e.note || '', e.type === 'payment' ? e.paidBy || '' : ''])], [38, 38, 50, 18, 18, 22, 22, 70, 35]);
  il.events.forEach((e, i) => formula(incomeSheet, 'G' + (i + 2), `IF(E${i + 2}="refund",-F${i + 2},F${i + 2})`, e.type === 'refund' ? -e.amount : e.amount));
  const visits = allVisits(data);
  appendSheet(w, 'DD Visits', [['Visit ID', 'Job ID', 'Date', 'Purpose', 'Outcome', 'Vehicle', 'Actual miles', 'Charge treatment', 'Quoted fee (not income)', 'Notes'], ...visits.map(v => [v.id, v.jobId, v.date, v.purpose, v.outcome, v.vehicle, v.miles, v.charge, v.quotedFee, v.note])], [40, 40, 18, 25, 25, 18, 18, 22, 24, 80]);
  const summaries = {
    ...data.summaryRefs
  };
  for (const m of months) {
    const s = w.sheets.find(s => s.name === m),
      rr = data.records.filter(e => e.month === m),
      actual = rr.filter(e => e.kind === 'expense' && e.scope === 'business' && e.state === 'recorded'),
      planned = rr.filter(e => e.kind === 'expense' && e.scope === 'business' && e.state === 'planned'),
      ins = incomeRecords(data).filter(e => e.month === m && e.kind === 'inspection' && e.state === 'recorded'),
      travels = travelRecords(data).filter(e => e.month === m);
    const incomeFormula = ins.length ? 'SUM(' + ins.map(e => `'${e.sheet}'!${e.amountCell}`).join(',') + ')' : '0';
    const milesValue = travels.reduce((s, e) => s + (e.miles || 0), 0);
    const mileageRefs = travels.map(e => e.milesCell ? `'${e.sheet}'!${e.milesCell}` : null).filter(Boolean);
    const mileageFormula = mileageRefs.length ? 'SUM(' + mileageRefs.join(',') + ')' : '0';
    let sr = summaries[m];
    if (!sr) {
      sr = {
        actual: 'G' + ++used[m],
        planned: 'G' + ++used[m],
        sales: 'J' + ++used[m],
        miles: 'I' + used[m]
      };
      summaries[m] = sr;
    }
    setCell(s.doc, 'F' + cellnum(sr.actual), 'Recorded business expenses');
    formula(s, sr.actual, refsFormula(actual), sum(actual));
    setCell(s.doc, 'F' + cellnum(sr.planned), 'Planned business expenses');
    formula(s, sr.planned, refsFormula(planned), sum(planned));
    formula(s, sr.sales, incomeFormula, sum(ins));
    formula(s, sr.miles, mileageFormula, milesValue);
    // Refresh familiar original category subtotals and inspection totals as well.
    let cat = '';
    for (const r of els(s.doc, 'row')) {
      const rn = attr(r, 'r'),
        b = s.get('B' + rn);
      if (baseCategories.includes(b)) cat = b;
      const g = s.cells.get('G' + rn);
      if (g && els(g, 'f').length && 'G' + rn !== sr.actual && 'G' + rn !== sr.planned) {
        const matches = actual.filter(e => e.category === cat);
        formula(s, 'G' + rn, refsFormula(matches), sum(matches));
      }
      for (const [col, rs, key] of [['J', ins, 'amountCell'], ['I', ins, 'milesCell']]) {
        const c = s.cells.get(col + rn);
        if (c && els(c, 'f').length) formula(s, col + rn, key === 'milesCell' ? mileageFormula : incomeFormula, key === 'milesCell' ? milesValue : sum(ins));
      }
    }
    const ms = w.sheets.find(s => s.name === 'Monthly Expenses');
    if (ms) {
      const i = months.indexOf(m),
        r = 3 + Math.floor(i / 4) * 12,
        col = ['C', 'H', 'M', 'R'][i % 4];
      const cats = ['Fuel', 'Food', 'Lodging', 'Office Supplies', 'Office Expenses', 'Recurring Expenses', 'Vehicle Maintenance'];
      for (let j = 0; j < cats.length; j++) {
        const matches = actual.filter(e => e.category === cats[j]);
        const f = matches.length ? 'SUM(' + matches.map(e => `'${m}'!${e.amountCell}`).join(',') + ')' : '0';
        formula(ms, col + (r + j), f, sum(matches));
      }
      const other = actual.filter(e => !cats.includes(e.category));
      setCell(ms.doc, ['B', 'G', 'L', 'Q'][i % 4] + (r + 7), 'Other categories');
      formula(ms, col + (r + 7), other.length ? 'SUM(' + other.map(e => `'${m}'!${e.amountCell}`).join(',') + ')' : '0', sum(other));
      formula(ms, col + (r + 8), `'${m}'!${sr.actual}`, sum(actual));
      formula(ms, col + (r + 9), `'${m}'!${sr.sales}`, sum(ins));
    }
    const projection = w.sheets.find(s => s.name === 'Projections');
    if (projection) {
      const i = months.indexOf(m),
        has = ins.some(e => e.amount !== null);
      if (has) formula(projection, 'E' + (i + 4), `'${m}'!${sr.sales}`, sum(ins));else setCell(projection.doc, 'E' + (i + 4), null);
    }
  }
  appendSheet(w, 'DD Index', [['Entry ID', 'Month', 'Kind', 'Category', 'Subcategory', 'Sheet', 'Amount cell', 'Description cell', 'Miles cell', 'Location cell', 'Recorded or planned', 'Business or residence', 'Business percent', 'Recurring type', 'Household category ID', 'Household subcategory ID', 'Transaction date'], ...data.records.map(e => [e.id, e.month, e.kind, e.category, e.subCategory || '', e.sheet, e.amountCell || '', e.descriptionCell || '', e.milesCell || '', e.locationCell || '', e.state, e.scope, e.percent ?? null, e.recurringType || 'fixed', e.householdCategoryId || '', e.householdSubId || '', e.transactionDate || ''])], [36, 16, 15, 25, 25, 18, 18, 20, 18, 18, 20, 23, 18, 18]);
  appendSheet(w, 'DD Notes', [['Note ID', 'Original sheet', 'Cell', 'Entry ID', 'Storage', 'Note (additional app notes)'], ...data.notes.map(n => [n.id, n.sheet, n.cell, n.recordId || '', n.storage || 'app', n.storage === 'native' || n.storage === 'inline' ? '' : n.text])], [36, 23, 14, 36, 16, 100]);
  if (data.bankHistory?.length || w.sheets.some(s => s.name === 'DD Bank')) appendSheet(w, 'DD Bank', [['Bank key', 'Date', 'Type', 'Description', 'Bank category', 'Signed bank amount', 'Balance', 'Bank note', 'Review action', 'Linked entry ID', 'Exclusion reason', 'Saved at', 'Source file', 'Match signature'], ...(data.bankHistory || []).map(h => [h.key, h.date, h.type, h.description, h.category, h.amount, h.balance, h.note, h.action, h.recordId, h.reason, h.saved, h.file, h.signature])], [45, 15, 22, 60, 24, 20, 20, 80, 18, 36, 50, 28, 50, 45]);
  if (data.transfers?.length || w.sheets.some(s => s.name === 'DD Transfers')) appendSheet(w, 'DD Transfers', [['Transfer ID', 'Date', 'Amount moved (not income/expense)', 'From account', 'To account', 'Area', 'Notes', 'Converted entry ID', 'Original signed amount', 'Original description'], ...(data.transfers || []).map(t => [t.id, t.date, t.amount, t.from, t.to, t.scope, t.note || '', t.sourceId || '', t.originalAmount ?? null, t.originalDescription || ''])], [38, 18, 28, 30, 30, 18, 90, 38, 25, 60]);
  appendSheet(w, 'DD Inspections', [['Job ID', 'Origin year', 'Overall status', 'Visit count', 'Total actual miles', 'Notes', 'Entry type', 'Travel description', 'Travel purpose', 'Travel review'], ...Object.entries(il.jobs).map(([id, j]) => [id, j.ownerYear, j.status, (j.visits || []).length, (j.visits || []).reduce((s, v) => s + (v.miles || 0), 0), j.reason || '', j.entryType || 'inspection', j.travelDescription || '', j.travelPurpose || '', j.travelReview || ''])], [38, 18, 25, 18, 22, 90, 22, 40, 60, 24]);
  appendSheet(w, 'DD Settlements', [['ID', 'Date', 'Bank amount', 'Review status', 'Reference', 'Note', 'Event selections'], ...il.payouts.map(p => [p.id, p.date, p.amount, p.status, p.reference, p.note, JSON.stringify(p.items)])], [38, 18, 22, 18, 35, 70, 90]);
  appendSheet(w, 'DD Settings', [['Setting', 'Value'], ['schema', '2'], ['year', JSON.stringify(data.year)], ['categories', JSON.stringify(data.categories)], ['householdCategories', JSON.stringify(data.householdCategories)], ['incomeSources', JSON.stringify(data.incomeSources)], ['summaryRefs', JSON.stringify(summaries)], ...JSON.stringify(inspectionLedger(data)).match(/[\s\S]{1,12000}/g).map((part, i) => ['inspectionLedgerPart' + i, JSON.stringify(part)])], [22, 100]);
  // A readable ledger makes status and residence amounts visible in Excel too; formulas link to the monthly input cells.
  const ledger = appendSheet(w, 'Entry Overview', [['Month', 'Category', 'Description', 'Recorded or planned', 'Scope', 'Full amount', 'Business use (%)', 'Business portion', 'Household category', 'Household subcategory', 'Transaction date'], ...data.records.filter(e => e.kind !== 'inspection').map(e => [e.month, e.category, e.description, e.state, e.scope, null, e.percent === null ? null : e.percent, null, (e.kind === 'income' ? data.incomeSources : data.householdCategories)?.find(c => c.id === e.householdCategoryId)?.name || '', (e.kind === 'income' ? data.incomeSources : data.householdCategories)?.find(c => c.id === e.householdCategoryId)?.subs.find(c => c.id === e.householdSubId)?.name || '', e.transactionDate || ''])], [16, 25, 55, 22, 18, 18, 20, 20]);
  data.records.filter(e => e.kind !== 'inspection').forEach((e, i) => {
    const r = i + 2;
    formula(ledger, 'F' + r, `'${e.sheet}'!${e.amountCell}`, e.amount || 0);
    if (e.scope === 'residence' && e.percent !== null) formula(ledger, 'H' + r, `F${r}*G${r}/100`, (e.amount || 0) * e.percent / 100);
  });
  const serialize = new XMLSerializer();
  for (const s of w.sheets) {
    const rows = els(s.doc, 'row');
    const dim = els(s.doc, 'dimension')[0];
    if (dim) {
      const cols = els(s.doc, 'c').map(c => attr(c, 'r').replace(/\d/g, ''));
      const maxCol = cols.sort((a, b) => a.length - b.length || a.localeCompare(b)).at(-1) || 'A';
      dim.setAttribute('ref', 'A1:' + maxCol + Math.max(1, ...rows.map(r => Number(attr(r, 'r')))));
    }
    w.files[s.path] = strToU8(serialize.serializeToString(s.doc));
    if (s.comments) w.files[s.commentPath] = strToU8(serialize.serializeToString(s.comments));
  }
  let calc = els(w.wb, 'calcPr')[0];
  if (!calc) {
    calc = w.wb.createElementNS(NS, 'calcPr');
    w.wb.documentElement.appendChild(calc);
  }
  calc.setAttribute('fullCalcOnLoad', '1');
  calc.setAttribute('forceFullCalc', '1');
  calc.setAttribute('calcMode', 'auto');
  delete w.files['xl/calcChain.xml'];
  els(w.rel, 'Relationship').filter(x => attr(x, 'Type').endsWith('/calcChain')).forEach(x => x.parentNode.removeChild(x));
  const ct = w.read('[Content_Types].xml');
  els(ct, 'Override').filter(x => attr(x, 'PartName') === '/xl/calcChain.xml').forEach(x => x.parentNode.removeChild(x));
  w.files['[Content_Types].xml'] = strToU8(serialize.serializeToString(ct));
  w.files['xl/workbook.xml'] = strToU8(serialize.serializeToString(w.wb));
  w.files['xl/_rels/workbook.xml.rels'] = strToU8(serialize.serializeToString(w.rel));
  return encode(zipSync(w.files, {
    level: 6
  }));
}
export function blankBook(year, source = null) {
  const files = {},
    names = ['Projections', 'Monthly Expenses', ...months],
    esc = s => s.replace(/&/g, '&amp;');
  files['[Content_Types].xml'] = strToU8(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((n, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  files['_rels/.rels'] = strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  files['xl/workbook.xml'] = strToU8(`<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  files['xl/_rels/workbook.xml.rels'] = strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((n, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`);
  names.forEach((n, i) => {
    const d = xml(`<worksheet xmlns="${NS}"><cols><col min="2" max="3" width="25" customWidth="1"/><col min="4" max="4" width="50" customWidth="1"/><col min="5" max="5" width="18" customWidth="1"/><col min="6" max="7" width="28" customWidth="1"/><col min="9" max="11" width="22" customWidth="1"/></cols><sheetData/></worksheet>`);
    setCell(d, 'B2', n);
    if (months.includes(n)) {
      ['Category', 'Subcategory', 'Description', 'Amount'].forEach((v, j) => setCell(d, String.fromCharCode(66 + j) + '3', v));
      setCell(d, 'I3', 'Miles Driven');
      setCell(d, 'J3', 'Sale Amount');
      setCell(d, 'K3', 'Location');
    }
    if (n === 'Monthly Expenses') months.forEach((m, j) => {
      const col = ['B', 'G', 'L', 'Q'][j % 4],
        r = 2 + Math.floor(j / 4) * 12;
      setCell(d, col + r, m);
      ['Fuel', 'Food', 'Lodging', 'Supplies', 'Expenses', 'Recurring Expenses', 'Maintenance', '', 'Subtotal', 'Sales'].forEach((v, k) => setCell(d, col + (r + k + 1), v));
    });
    if (n === 'Projections') {
      setCell(d, 'B3', 'Month');
      setCell(d, 'E3', year + ' Sales');
      months.forEach((m, j) => setCell(d, 'B' + (j + 4), m));
    }
    files['xl/worksheets/sheet' + (i + 1) + '.xml'] = strToU8(new XMLSerializer().serializeToString(d));
  });
  const b64 = encode(zipSync(files)),
    d = readBook(b64, year);
  d.records = [];
  d.categories = source ? structuredClone(source.categories) : baseCategories.map(name => ({
    name,
    subs: name === 'Residence' ? ['Electric', 'Water', 'Sewer', 'Internet', 'Phone', 'Insurance', 'Housing', 'Other'] : [],
    role: name === 'Recurring Expenses' ? 'recurring' : name === 'Residence' ? 'residence' : 'expense'
  }));
  if (source) {
    const recurring = source.records.filter(e => e.scope !== 'residence' && (e.category === 'Recurring Expenses' || source.categories.find(c => c.name === e.category)?.role === 'recurring'));
    d.householdCategories = structuredClone(source.householdCategories);
    d.incomeSources = structuredClone(source.incomeSources);
    const residence = [];
    const templates = [recurring, residence].flatMap(group => {
      const lastMonth = months.slice().reverse().find(m => group.some(e => e.month === m));
      return group.filter(e => e.month === lastMonth);
    });
    for (const month of months) for (const e of templates) {
      d.records.push({
        ...e,
        id: crypto.randomUUID(),
        month,
        state: 'planned',
        amount: e.recurringType === 'variable' ? null : e.amount,
        isNew: true,
        sheet: month,
        amountCell: null,
        descriptionCell: null,
        milesCell: null,
        locationCell: null
      });
    }
    for (const def of (d.incomeSources || []).filter(c => c.recurring)) {
      const samples = source.records.filter(e => e.kind === 'income' && e.householdCategoryId === def.id).sort((a, b) => months.indexOf(b.month) - months.indexOf(a.month));
      if (samples.length) for (const month of def.months) {
        const e = samples[0];
        d.records.push({
          ...e,
          id: crypto.randomUUID(),
          month,
          sheet: month,
          state: 'planned',
          isNew: true,
          transactionDate: '',
          amountCell: null,
          descriptionCell: null,
          milesCell: null,
          locationCell: null
        });
      }
    }
  }
  return writeBook(b64, d);
}
export { appendSheet };
export function readBook(base64, year, raw = false) {
  const b = readRawBook(base64, year);
  return raw ? b : attach(b);
}
