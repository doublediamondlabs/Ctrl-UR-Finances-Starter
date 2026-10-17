import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const categories = ['Fuel', 'Food', 'Lodging', 'Vehicle Maintenance', 'Office Expenses', 'Office Supplies', 'Recurring Expenses'];
export type Note = {
  id: string;
  sheet: string;
  cell: string;
  text: string;
  recordId?: string;
};
export type Entry = {
  id: string;
  month: string;
  kind: 'expense' | 'inspection';
  category: string;
  description: string;
  amount: number | null;
  miles: number | null;
  location: string;
  sheet: string;
  amountCell?: string;
  descriptionCell?: string;
  milesCell?: string;
  locationCell?: string;
  subCategory?: string;
  isNew?: boolean;
};
export type Book = {
  name: string;
  records: Entry[];
  notes: Note[];
};
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml = (s: string) => {
  const d = new DOMParser().parseFromString(s, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('The workbook contains invalid XML.');
  return d;
};
const els = (p: Document | Element, n: string) => Array.from(p.getElementsByTagNameNS('*', n));
const first = (p: Document | Element, n: string) => els(p, n)[0];
const text = (p: Document | Element, n: string) => first(p, n)?.textContent || '';
const attr = (p: Element, n: string) => p.getAttribute(n) || '';
const norm = (s: string) => {
  const a: string[] = [];
  s.split('/').forEach(x => {
    if (x === '..') a.pop();else if (x && x !== '.') a.push(x);
  });
  return a.join('/');
};
const relationPath = (p: string) => p.replace(/([^/]+)$/, '_rels/$1.rels');
const resolve = (p: string, t: string) => t.startsWith('/') ? t.slice(1) : norm(p.replace(/[^/]+$/, '') + t);
const decode = (b: string) => Uint8Array.from(atob(b), c => c.charCodeAt(0));
export function encode(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 16384) s += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(s);
}
function open(base64: string) {
  const files = unzipSync(decode(base64));
  const read = (p: string) => files[p] ? xml(strFromU8(files[p])) : null;
  const wb = read('xl/workbook.xml');
  if (!wb) throw new Error('Please choose an .xlsx workbook.');
  const rel = read('xl/_rels/workbook.xml.rels')!;
  const strings = read('xl/sharedStrings.xml');
  const ss = strings ? els(strings, 'si').map(x => els(x, 't').map(y => y.textContent).join('')) : [];
  const sheets = els(wb, 'sheet').map(s => {
    const id = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const r = els(rel, 'Relationship').find(x => attr(x, 'Id') === id)!;
    const path = resolve('xl/workbook.xml', attr(r, 'Target'));
    const doc = read(path)!;
    const cells = new Map(els(doc, 'c').map(c => [attr(c, 'r'), c]));
    const get = (ref: string) => {
      const c = cells.get(ref);
      if (!c) return '';
      if (attr(c, 't') === 's') return ss[Number(text(c, 'v'))] || '';
      if (attr(c, 't') === 'inlineStr') return els(c, 't').map(x => x.textContent).join('');
      return text(c, 'v');
    };
    const rs = read(relationPath(path));
    const cr = rs && els(rs, 'Relationship').find(x => attr(x, 'Type').endsWith('/comments'));
    const commentPath = cr ? resolve(path, attr(cr, 'Target')) : '';
    return {
      name: attr(s, 'name'),
      path,
      doc,
      cells,
      get,
      commentPath,
      comments: commentPath ? read(commentPath) : null
    };
  });
  return {
    files,
    read,
    wb,
    rel,
    sheets
  };
}
export function importBook(base64: string, name: string): Book {
  const w = open(base64);
  if (!w.sheets.some(s => s.name === 'Monthly Expenses') || !months.every(m => w.sheets.some(s => s.name === m))) throw new Error('This app expects the Monthly Expenses sheet and January–December tabs from your expense workbook.');
  const records: Entry[] = [];
  const notes: Note[] = [];
  for (const s of w.sheets) {
    if (s.comments) for (const c of els(s.comments, 'comment')) notes.push({
      id: s.name + '!' + attr(c, 'ref'),
      sheet: s.name,
      cell: attr(c, 'ref'),
      text: els(c, 't').map(t => t.textContent).join('')
    });
  }
  for (const month of months) {
    const s = w.sheets.find(s => s.name === month)!;
    let category = '';
    const rows = els(s.doc, 'row');
    const inspectionStart = rows.find(r => s.get('I' + attr(r, 'r')) === 'Miles Driven');
    const begin = Number(inspectionStart?.getAttribute('r') || 3) + 1;
    const end = Number(rows.find(r => s.get('I' + attr(r, 'r')) === 'Total Miles')?.getAttribute('r') || begin);
    for (const row of rows) {
      const r = Number(attr(row, 'r'));
      const b = s.get('B' + r);
      if (categories.includes(b)) category = b;
      const a = s.get('E' + r);
      const sub = s.get('C' + r);
      const d = s.get('D' + r);
      const rowNotes = notes.filter(n => n.sheet === month && Number(n.cell.replace(/\D/g, '')) === r && /^[CDE]/.test(n.cell));
      if (category && (a !== '' || d || rowNotes.length) && !s.cells.get('E' + r)?.getElementsByTagNameNS('*', 'f').length) {
        const id = month + '!E' + r;
        records.push({
          id,
          month,
          kind: 'expense',
          category,
          description: d || sub || category,
          subCategory: sub,
          amount: a !== '' ? Number(a) : null,
          miles: null,
          location: '',
          sheet: month,
          amountCell: 'E' + r,
          descriptionCell: 'D' + r
        });
        rowNotes.forEach(n => n.recordId = id);
      }
      if (r >= begin && r < end) {
        const a = s.get('J' + r),
          mi = s.get('I' + r),
          loc = s.get('K' + r);
        const nn = notes.filter(n => n.sheet === month && Number(n.cell.replace(/\D/g, '')) === r && /^[I-N]/.test(n.cell));
        if (a !== '' || mi !== '' || loc || nn.length) {
          const id = month + '!J' + r;
          records.push({
            id,
            month,
            kind: 'inspection',
            category: 'Inspection',
            description: 'Inspection / travel',
            amount: a !== '' ? Number(a) : null,
            miles: mi !== '' ? Number(mi) : null,
            location: loc,
            sheet: month,
            amountCell: 'J' + r,
            milesCell: 'I' + r,
            locationCell: 'K' + r
          });
          nn.forEach(n => n.recordId = id);
        }
      }
    }
    const ms = w.sheets.find(s => s.name === 'Monthly Expenses')!;
    const i = months.indexOf(month);
    const row = 3 + Math.floor(i / 4) * 12;
    const cols = [['C', 'D'], ['H', 'I'], ['M', 'N'], ['R', 'S']][i % 4];
    for (let j = 0; j < 3; j++) {
      const ref = cols[0] + (row + j);
      const noteRef = cols[1] + (row + j);
      const id = 'Monthly Expenses!' + ref;
      records.push({
        id,
        month,
        kind: 'expense',
        category: categories[j],
        description: categories[j] + ' monthly total',
        amount: ms.get(ref) === '' ? null : Number(ms.get(ref)),
        miles: null,
        location: '',
        sheet: ms.name,
        amountCell: ref,
        descriptionCell: noteRef
      });
      notes.filter(n => n.sheet === ms.name && [ref, noteRef].includes(n.cell)).forEach(n => n.recordId = id);
    }
  }
  const app = w.sheets.find(s => s.name === 'App Entries');
  if (app) for (const row of els(app.doc, 'row')) {
    const r = Number(attr(row, 'r'));
    if (r < 2) continue;
    const id = app.get('A' + r);
    if (!id) continue;
    const e: Entry = {
      id,
      month: app.get('B' + r),
      kind: app.get('C' + r) as Entry['kind'],
      category: app.get('D' + r),
      description: app.get('E' + r),
      amount: app.get('F' + r) === '' ? null : Number(app.get('F' + r)),
      miles: app.get('G' + r) === '' ? null : Number(app.get('G' + r)),
      location: app.get('H' + r),
      sheet: 'App Entries',
      isNew: true
    };
    records.push(e);
  }
  const an = w.sheets.find(s => s.name === 'App Notes');
  if (an) for (const row of els(an.doc, 'row')) {
    const r = Number(attr(row, 'r'));
    if (r < 2) continue;
    const id = an.get('A' + r);
    if (!id) continue;
    const note = {
      id,
      sheet: an.get('B' + r),
      cell: an.get('C' + r),
      recordId: an.get('D' + r) || undefined,
      text: an.get('E' + r)
    };
    const idx = notes.findIndex(n => n.id === id);
    if (idx >= 0) notes[idx] = note;else notes.push(note);
  }
  return {
    name,
    records,
    notes
  };
}
// Each parsed document gets its own lookup; sheet replacements use new documents.
const cellLookups = new WeakMap<Document, {
  cells: Map<string, Element>;
  rows: Map<string, Element>;
  data: Element;
  lastRow: number;
}>();
function lookup(doc: Document) {
  let cache = cellLookups.get(doc);
  if (!cache) {
    let data = first(doc, 'sheetData');
    if (!data) {
      data = doc.createElementNS(NS, 'sheetData');
      doc.documentElement.appendChild(data);
    }
    const rows = els(data, 'row');
    cache = {
      cells: new Map(els(data, 'c').map(c => [attr(c, 'r'), c])),
      rows: new Map(rows.map(r => [attr(r, 'r'), r])),
      data,
      lastRow: Math.max(0, ...rows.map(r => Number(attr(r, 'r'))))
    };
    cellLookups.set(doc, cache);
  }
  return cache;
}
export function getCell(doc: Document, ref: string) {
  return lookup(doc).cells.get(ref);
}
function setCell(doc: Document, ref: string, value: string | number | null, formula = false) {
  const cache = lookup(doc);
  let cell = cache.cells.get(ref);
  if (!cell) {
    const rn = ref.replace(/\D/g, '');
    let row = cache.rows.get(rn);
    if (!row) {
      row = doc.createElementNS(NS, 'row');
      row.setAttribute('r', rn);
      if (Number(rn) > cache.lastRow) cache.data.appendChild(row);else {
        const next = els(cache.data, 'row').find(x => Number(attr(x, 'r')) > Number(rn));
        cache.data.insertBefore(row, next || null);
      }
      cache.lastRow = Math.max(cache.lastRow, Number(rn));
      cache.rows.set(rn, row);
    }
    cell = doc.createElementNS(NS, 'c');
    cell.setAttribute('r', ref);
    const col = (r: string) => r.replace(/\d/g, '').split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
    const next = els(row, 'c').find(c => col(attr(c, 'r')) > col(ref));
    row.insertBefore(cell, next || null);
    cache.cells.set(ref, cell);
  }
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute('t');
  if (value === null || value === '') return;
  if (formula) {
    const f = doc.createElementNS(NS, 'f');
    f.textContent = String(value);
    cell.appendChild(f);
  } else if (typeof value === 'number') {
    const v = doc.createElementNS(NS, 'v');
    v.textContent = String(value);
    cell.appendChild(v);
  } else {
    cell.setAttribute('t', 'inlineStr');
    const is = doc.createElementNS(NS, 'is'),
      t = doc.createElementNS(NS, 't');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = value;
    is.appendChild(t);
    cell.appendChild(is);
  }
}
export function exportBook(base64: string, data: Book): Uint8Array {
  const w = open(base64);
  for (const e of data.records.filter(e => !e.isNew)) {
    const s = w.sheets.find(s => s.name === e.sheet)!;
    if (e.amountCell) setCell(s.doc, e.amountCell, e.amount);
    if (e.descriptionCell && e.sheet !== 'Monthly Expenses') setCell(s.doc, e.descriptionCell, e.description);
    if (e.milesCell) setCell(s.doc, e.milesCell, e.miles);
    if (e.locationCell) setCell(s.doc, e.locationCell, e.location);
  }
  for (const s of w.sheets) if (s.comments) for (const c of els(s.comments, 'comment')) {
    const n = data.notes.find(n => n.id === s.name + '!' + attr(c, 'ref'));
    if (n) {
      const t = first(c, 'text');
      if (t) {
        while (t.firstChild) t.removeChild(t.firstChild);
        const el = s.comments.createElementNS(NS, 't');
        el.setAttribute('xml:space', 'preserve');
        el.textContent = n.text;
        t.appendChild(el);
      }
    }
  }
  const serializer = new XMLSerializer();
  const save = (p: string, d: Document) => w.files[p] = strToU8(serializer.serializeToString(d));
  const sheet = (name: string, rows: (string | number | null)[][]) => {
    let s = w.sheets.find(s => s.name === name);
    const d = xml('<worksheet xmlns="' + NS + '"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="4" width="24" customWidth="1"/><col min="5" max="5" width="65" customWidth="1"/><col min="6" max="8" width="20" customWidth="1"/></cols><sheetData/></worksheet>');
    rows.forEach((row, i) => row.forEach((v, j) => setCell(d, String.fromCharCode(65 + j) + (i + 1), v)));
    if (s) {
      s.doc = d;
      return;
    }
    const num = Math.max(...w.sheets.map(s => Number(s.path.match(/sheet(\d+)/)?.[1] || 0))) + 1;
    const path = 'xl/worksheets/sheet' + num + '.xml';
    const id = 'rIdDD' + num;
    const e = w.wb.createElementNS(NS, 'sheet');
    e.setAttribute('name', name);
    e.setAttribute('sheetId', String(Math.max(...els(w.wb, 'sheet').map(x => Number(attr(x, 'sheetId')))) + 1));
    e.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'r:id', id);
    first(w.wb, 'sheets').appendChild(e);
    const rr = w.rel.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
    rr.setAttribute('Id', id);
    rr.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet');
    rr.setAttribute('Target', 'worksheets/sheet' + num + '.xml');
    w.rel.documentElement.appendChild(rr);
    const ct = w.read('[Content_Types].xml')!;
    const ov = ct.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types', 'Override');
    ov.setAttribute('PartName', '/' + path);
    ov.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
    ct.documentElement.appendChild(ov);
    save('[Content_Types].xml', ct);
    w.sheets.push({
      name,
      path,
      doc: d
    } as typeof w.sheets[number]);
  };
  const added = data.records.filter(e => e.isNew);
  sheet('App Entries', [['ID', 'Month', 'Type', 'Category', 'Description', 'Amount', 'Miles', 'Location'], ...added.map(e => [e.id, e.month, e.kind, e.category, e.description, e.amount, e.miles, e.location])]);
  sheet('App Notes', [['ID', 'Sheet', 'Cell', 'Record ID', 'Note'], ...data.notes.filter(n => !w.sheets.some(s => s.comments && els(s.comments, 'comment').some(c => n.id === s.name + '!' + attr(c, 'ref')))).map(n => [n.id, n.sheet, n.cell, n.recordId || '', n.text])]);
  // Rebuild the additive term instead of accumulating it on repeated exports.
  const suffix = /\+SUMIFS\('App Entries'![\s\S]*$/;
  const addTerm = (doc: Document, ref: string, month: string, cat: string, col = 'F') => {
    const c = els(doc, 'c').find(c => attr(c, 'r') === ref);
    const f = c && text(c, 'f');
    if (f) setCell(doc, ref, f.replace(suffix, '') + `+SUMIFS('App Entries'!$${col}$2:$${col}$10000,'App Entries'!$B$2:$B$10000,"${month}",'App Entries'!$D$2:$D$10000,"${cat}")`, true);
  };
  for (const month of months) {
    const s = w.sheets.find(s => s.name === month)!;
    let cat = '';
    for (const r of els(s.doc, 'row')) {
      const rn = attr(r, 'r');
      const b = s.get('B' + rn);
      if (categories.includes(b)) cat = b;
      const g = 'G' + rn;
      if (s.cells.get(g) && text(s.cells.get(g)!, 'f')) addTerm(s.doc, g, month, cat);
      if (s.cells.get('J' + rn) && text(s.cells.get('J' + rn)!, 'f')) addTerm(s.doc, 'J' + rn, month, 'Inspection');
      if (s.cells.get('I' + rn) && text(s.cells.get('I' + rn)!, 'f')) addTerm(s.doc, 'I' + rn, month, 'Inspection', 'G');
    }
    const ms = w.sheets.find(s => s.name === 'Monthly Expenses')!;
    const i = months.indexOf(month),
      rn = 3 + Math.floor(i / 4) * 12,
      col = ['C', 'H', 'M', 'R'][i % 4];
    for (let j = 0; j < 3; j++) {
      const ref = col + (rn + j);
      const e = data.records.find(e => e.id === 'Monthly Expenses!' + ref)!;
      const extras = added.filter(e => e.month === month && e.category === categories[j]).reduce((a, e) => a + (e.amount || 0), 0);
      setCell(ms.doc, ref, extras ? (e.amount ?? 0) + extras : e.amount);
    }
  }
  // Aggregate travel entries are folded into their existing monthly cells; omit them from App Entries to avoid double counting on re-import.
  sheet('App Entries', [['ID', 'Month', 'Type', 'Category', 'Description', 'Amount', 'Miles', 'Location'], ...added.filter(e => !['Fuel', 'Food', 'Lodging'].includes(e.category)).map(e => [e.id, e.month, e.kind, e.category, e.description, e.amount, e.miles, e.location])]);
  // Preserve the detail of added travel entries in notes on the monthly aggregate.
  for (const e of added.filter(e => ['Fuel', 'Food', 'Lodging'].includes(e.category))) {
    const target = data.records.find(x => x.month === e.month && x.category === e.category && !x.isNew)!;
    const note = {
      id: 'travel-' + e.id,
      sheet: target.sheet,
      cell: target.amountCell!,
      recordId: target.id,
      text: e.description + ': ' + (e.amount ?? 0) + '\n' + data.notes.filter(n => n.recordId === e.id).map(n => n.text).join('\n')
    };
    const existing = data.notes.find(n => n.id === note.id);
    if (!existing) data = {
      ...data,
      notes: [...data.notes, note]
    };
  }
  sheet('App Notes', [['ID', 'Sheet', 'Cell', 'Record ID', 'Note'], ...data.notes.filter(n => !w.sheets.some(s => s.comments && els(s.comments, 'comment').some(c => n.id === s.name + '!' + attr(c, 'ref')))).map(n => [n.id, n.sheet, n.cell, n.recordId || '', n.text])]);
  for (const s of w.sheets) {
    save(s.path, s.doc);
    if (s.comments) save(s.commentPath, s.comments);
  }
  let calc = first(w.wb, 'calcPr');
  if (!calc) {
    calc = w.wb.createElementNS(NS, 'calcPr');
    w.wb.documentElement.appendChild(calc);
  }
  calc.setAttribute('fullCalcOnLoad', '1');
  calc.setAttribute('forceFullCalc', '1');
  calc.setAttribute('calcMode', 'auto');
  save('xl/workbook.xml', w.wb);
  save('xl/_rels/workbook.xml.rels', w.rel);
  delete w.files['xl/calcChain.xml'];
  const ct = w.read('[Content_Types].xml')!;
  els(ct, 'Override').filter(x => attr(x, 'PartName') === '/xl/calcChain.xml').forEach(x => x.parentNode?.removeChild(x));
  save('[Content_Types].xml', ct);
  els(w.rel, 'Relationship').filter(x => attr(x, 'Type').endsWith('/calcChain')).forEach(x => x.parentNode?.removeChild(x));
  save('xl/_rels/workbook.xml.rels', w.rel);
  return zipSync(w.files, {
    level: 6
  });
}
export { open, setCell, els, attr, text, NS, xml };
