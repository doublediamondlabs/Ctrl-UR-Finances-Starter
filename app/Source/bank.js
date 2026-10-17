import { ledger } from './inspectionIncome.js';
export const bankMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function csvRows(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [],
    field = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === '"' && !field.trim() && !closed) {
      field = '';
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field);
      field = '';
      closed = false;
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
      }
    } else {
      if (closed && !/\s/.test(c)) throw Error('Unexpected text after a quoted CSV field.');
      field += c;
    }
  }
  if (quoted) throw Error('CSV contains an unfinished quoted field.');
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
function cents(value, label) {
  const s = value.trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(s)) throw Error('Invalid ' + label + ': expected a number with at most two decimal places.');
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e12) throw Error('Amount outside the supported range.');
  return n;
}
export function parseBanterra(text) {
  if (text.length > 5e6) throw Error('CSV is too large (maximum 5 MB).');
  const rows = csvRows(text),
    expected = ['Date', 'Type', 'Description', 'Category', 'Amount', 'Balance', 'Note'];
  if (!rows.length || rows[0].map(s => s.trim()).join('|') !== expected.join('|')) throw Error('Expected Banterra columns: Date, Type, Description, Category, Amount, Balance, Note.');
  if (rows.length > 10001) throw Error('Maximum 10,000 transactions per import.');
  const seen = new Set();
  return rows.slice(1).map((values, i) => {
    if (values.length !== 7) throw Error('CSV row ' + (i + 2) + ' must have 7 columns.');
    if (values.some(v => v.length > 5000)) throw Error('CSV row ' + (i + 2) + ' contains an oversized field.');
    const [date, type, description, category, amount, balance, note] = values.map(s => s.trim()),
      m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
    if (!m) throw Error('Invalid date on CSV row ' + (i + 2));
    const year = Number(m[3]),
      month = Number(m[1]),
      day = Number(m[2]),
      d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) throw Error('Invalid date on CSV row ' + (i + 2));
    if (!description || !type) throw Error('Missing description or type on CSV row ' + (i + 2));
    const amountCents = cents(amount, 'amount'),
      balanceCents = balance === '' ? null : cents(balance, 'balance'),
      iso = `${m[3]}-${m[1]}-${m[2]}`,
      signature = JSON.stringify(['Banterra business', iso, description.replace(/\s+/g, ' ').toLowerCase(), amountCents]),
      key = JSON.stringify([signature, balanceCents]),
      duplicateInFile = seen.has(key);
    seen.add(key);
    return {
      key,
      signature,
      date: iso,
      year,
      month: bankMonths[month - 1],
      type,
      description,
      category,
      amount: amountCents / 100,
      balance: balanceCents === null ? null : balanceCents / 100,
      note,
      pending: type.toLowerCase() === 'pending',
      duplicateInFile,
      row: i + 2
    };
  });
}
export function rowStatus(row, book) {
  if (row.year !== Number(book.year)) return 'Other year';
  if (row.pending) return 'Pending';
  if (row.duplicateInFile) return 'Repeated in file';
  const prior = (book.bankHistory || []).find(h => h.key === row.key);
  if (prior) return prior.action === 'exclude' ? 'Excluded' : book.records.some(e => e.id === prior.recordId) ? 'Already imported' : 'Linked entry removed';
  return 'Needs review';
}
export function candidates(row, book) {
  const linked = new Set((book.bankHistory || []).map(h => h.recordId).filter(Boolean));
  return book.records.filter(e => e.kind !== 'income' && !ledger(book).jobs[e.id] && !ledger(book).retired.some(r => r.recordId === e.id) && !linked.has(e.id) && e.month === row.month && e.amount !== null && Math.round((e.kind === 'inspection' ? e.amount : -e.amount) * 100) === Math.round(row.amount * 100));
}
export function applyBankReview(book, rows, choices, sourceFile) {
  const next = structuredClone(book);
  next.bankHistory = next.bankHistory || [];
  let count = 0;
  for (const row of rows) {
    if (row.duplicateInFile) continue;
    const c = choices[row.key];
    if (!c || !c.action) continue;
    if (rowStatus(row, next) !== 'Needs review') throw Error('This transaction is not eligible: ' + row.description);
    const similar = next.bankHistory.some(h => h.signature === row.signature);
    if (similar && !c.allowSimilar) throw Error('Review the possible duplicate and confirm it is a separate transaction.');
    let recordId = '';
    if (c.action === 'exclude') {
      if (!c.reason?.trim()) throw Error('Choose an exclusion reason.');
    } else if (c.action === 'match') {
      const e = next.records.find(e => e.id === c.recordId);
      if (!e || !candidates(row, next).some(x => x.id === e.id)) throw Error('Matching entry is unavailable or has a different month/amount.');
      e.state = 'recorded';
      recordId = e.id;
    } else if (['expense', 'inspection'].includes(c.action)) {
      const cat = next.categories.find(x => x.name === c.category);
      if (c.action === 'expense' && !cat) throw Error('Choose an expense category.');
      if (!c.description?.trim()) throw Error('Enter a description.');
      const scope = c.action === 'inspection' ? 'business' : c.scope || 'business';
      if (!['business', 'residence'].includes(scope)) throw Error('Choose business or household scope.');
      recordId = crypto.randomUUID();
      next.records.push({
        id: recordId,
        month: row.month,
        kind: c.action,
        category: c.action === 'inspection' ? 'Inspection' : c.category,
        subCategory: c.subCategory?.trim() || '',
        description: c.description.trim(),
        amount: c.action === 'inspection' ? row.amount : -row.amount,
        miles: null,
        location: '',
        sheet: row.month,
        isNew: true,
        state: 'recorded',
        scope,
        percent: null,
        recurringType: 'variable'
      });
      if (cat && c.subCategory?.trim() && !cat.subs.includes(c.subCategory.trim())) cat.subs.push(c.subCategory.trim());
    } else throw Error('Choose a supported action.');
    if (recordId) {
      const note = `Banterra business · ${row.date}\n${row.description}\nBank amount: ${row.amount.toFixed(2)}\nType: ${row.type}${row.category ? '\nBank category: ' + row.category : ''}${row.note ? '\nBank note: ' + row.note : ''}`;
      next.notes.push({
        id: crypto.randomUUID(),
        sheet: row.month,
        cell: 'New entry',
        recordId,
        storage: 'app',
        text: note
      });
    }
    next.bankHistory.push({
      ...row,
      action: c.action,
      recordId,
      reason: c.reason || '',
      saved: new Date().toISOString(),
      file: sourceFile
    });
    count++;
  }
  if (Object.keys(ledger(book).jobs).length && Object.values(choices).some(c => c.action === 'inspection')) throw Error('Record customer payments in Income & refunds and processor deposits in Bank reconciliation. A bank deposit must not be imported as another inspection sale.');
  if (!count) throw Error('Choose at least one transaction action before saving.');
  return next;
}
