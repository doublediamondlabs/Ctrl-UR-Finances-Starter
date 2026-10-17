export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const moneyTotal = rows => rows.reduce((n, r) => n + Math.round(Number(r.amount || 0) * 100), 0) / 100;
export const labelOf = e => ({
  Electric: 'Power',
  Electricity: 'Power'
})[e.subCategory] || e.subCategory || e.description || 'Other';
export function initializeHousehold(book) {
  if (!book.householdCategories) {
    const labels = [...new Set(['Rent / Mortgage', 'Utilities', 'Groceries', 'Dining out', 'Transportation', 'Insurance', 'Health', 'Subscriptions', 'Other purchases', ...book.records.filter(e => e.scope === 'residence').map(labelOf)])];
    book.householdCategories = labels.map(name => ({
      id: 'home:' + name,
      name,
      months: [...MONTHS],
      subs: []
    }));
  }
  if (!book.incomeSources) {
    const labels = [...new Set(['Salary / Wages', 'Other income', ...book.records.filter(e => e.kind === 'income').map(e => e.description || 'Other income')])];
    book.incomeSources = labels.map(name => ({
      id: 'income:' + name,
      name,
      months: [...MONTHS],
      subs: []
    }));
  }
  for (const e of book.records) {
    const list = e.kind === 'income' ? book.incomeSources : e.scope === 'residence' ? book.householdCategories : null;
    if (!list) continue;
    let def = list.find(c => c.id === e.householdCategoryId);
    if (!def) {
      const name = e.kind === 'income' ? e.description || 'Other income' : labelOf(e);
      def = list.find(c => c.name === name);
      if (!def) {
        def = {
          id: (e.kind === 'income' ? 'income:' : 'home:') + name,
          name,
          months: [...MONTHS],
          subs: []
        };
        list.push(def);
      }
      e.householdCategoryId = def.id;
    }
    if (!def.months?.includes(e.month)) def.months = [...new Set([...(def.months || MONTHS), e.month])];
  }
  return book;
}
export function newTransaction(book, def, month, income = false) {
  return {
    id: crypto.randomUUID(),
    month,
    sheet: month,
    isNew: true,
    kind: income ? 'income' : 'expense',
    scope: income ? 'personal' : 'residence',
    category: income ? 'Personal income' : book.categories.find(c => c.role === 'residence')?.name || 'Residence',
    subCategory: income ? '' : def.name,
    householdCategoryId: def.id,
    householdSubId: '',
    description: def.name,
    amount: null,
    miles: null,
    location: '',
    state: 'recorded',
    percent: null,
    recurringType: income ? 'fixed' : 'variable',
    transactionDate: ''
  };
}
export function stageIncome(book, id, start, amount) {
  const next = structuredClone(book),
    def = next.incomeSources.find(c => c.id === id);
  if (!def) throw Error('Income source not found.');
  def.recurring = true;
  if (!MONTHS.includes(start)) throw Error('Choose a starting month.');
  for (const month of MONTHS.slice(MONTHS.indexOf(start))) {
    if (!def.months.includes(month)) continue;
    const rows = next.records.filter(e => e.kind === 'income' && e.householdCategoryId === id && e.month === month);
    if (rows.some(e => e.state === 'recorded')) continue;
    if (rows.length > 1) throw Error('Multiple planned receipts in ' + month + '. Edit those receipts individually.');
    if (rows.length) rows[0].amount = amount;else next.records.push({
      ...newTransaction(next, def, month, true),
      amount,
      state: 'planned'
    });
  }
  return next;
}
export function parsePasted(text) {
  return text.split(/\r?\n/).filter(s => s.trim()).map((line, i) => {
    const match = line.trim().match(/^(.*?)\s*\t\s*(\(?-?\$?[\d,]+(?:\.\d{1,2})?\)?)\s*$/) || line.trim().match(/^(.*?)\s+(\(?-?\$?[\d,]+(?:\.\d{1,2})?\)?)\s*$/);
    if (!match || !match[1].trim()) throw Error('Line ' + (i + 1) + ': use a description followed by a tab or spaces and an amount.');
    let raw = match[2].replace(/[$,]/g, '');
    if (raw.startsWith('(') && raw.endsWith(')')) raw = '-' + raw.slice(1, -1);
    const amount = Number(raw);
    if (!Number.isFinite(amount)) throw Error('Line ' + (i + 1) + ': invalid amount.');
    return {
      description: match[1].trim(),
      amount: String(amount),
      note: '',
      householdSubId: '',
      transactionDate: ''
    };
  });
}
export function addTransactions(book, {
  categoryId,
  month,
  income = false,
  rows,
  replaceId = null
}) {
  const next = structuredClone(book),
    def = (income ? next.incomeSources : next.householdCategories).find(c => c.id === categoryId);
  if (!def) throw Error('Choose a category.');
  const old = replaceId ? next.records.find(e => e.id === replaceId) : null;
  if (replaceId && (!old || old.month !== month)) throw Error('The original entry is no longer in this month. Reload first.');
  if (old && next.bankHistory?.some(h => h.recordId === old.id)) throw Error('This entry is linked to a bank transaction. Keep that entry intact; add separate purchases using the bank review workflow.');
  const valid = rows.filter(r => r.description.trim() || r.amount !== '');
  if (!valid.length) throw Error('Add at least one purchase.');
  for (const r of valid) {
    if (!r.description.trim() || r.amount === '' || !Number.isFinite(Number(r.amount))) throw Error('Every row needs a description and amount.');
    if (r.householdSubId && !def.subs.some(s => s.id === r.householdSubId)) throw Error('Choose a valid subcategory.');
    if (r.transactionDate) {
      const date = new Date(r.transactionDate + 'T12:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.transactionDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== r.transactionDate || date.getUTCFullYear() !== book.year || date.getUTCMonth() !== MONTHS.indexOf(month)) throw Error('Dates must be valid and within ' + month + ' ' + book.year + '.');
    }
  }
  if (old && Math.round(moneyTotal(valid) * 100) !== Math.round(Number(old.amount || 0) * 100)) throw Error('Details must total the original ' + Number(old.amount || 0).toFixed(2) + '. Adjust the rows before replacing this entry.');
  valid.forEach((r, i) => {
    const e = old && i === 0 ? old : newTransaction(next, def, month, income);
    Object.assign(e, {
      description: r.description.trim(),
      amount: Math.round(Number(r.amount) * 100) / 100,
      householdCategoryId: def.id,
      householdSubId: r.householdSubId || '',
      transactionDate: r.transactionDate || '',
      state: old?.state || 'recorded'
    });
    if (!(old && i === 0)) next.records.push(e);
    if (r.note?.trim()) next.notes.push({
      id: crypto.randomUUID(),
      sheet: month,
      cell: e.amountCell || 'New entry',
      recordId: e.id,
      storage: 'app',
      text: r.note.trim()
    });
  });
  return next;
}
export function reorder(list, id, targetId) {
  const next = [...list],
    from = next.findIndex(c => c.id === id),
    to = next.findIndex(c => c.id === targetId);
  if (from < 0 || to < 0) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export function copyMonthEntries(book, {
  categoryId,
  income,
  sourceMonth,
  targetMonths,
  entryIds,
  keepAmounts = false,
  copyNotes = false
}) {
  const next = structuredClone(book),
    field = income ? 'incomeSources' : 'householdCategories',
    def = next[field].find(c => c.id === categoryId);
  if (!def || !MONTHS.includes(sourceMonth) || !targetMonths.length || targetMonths.some(m => !MONTHS.includes(m) || m === sourceMonth)) throw Error('Choose different destination months.');
  const selected = book.records.filter(r => entryIds.includes(r.id) && r.householdCategoryId === categoryId && r.month === sourceMonth && (income ? r.kind === 'income' : r.kind === 'expense' && r.scope === 'residence'));
  if (!selected.length) throw Error('Select entries to copy.');
  for (const month of [...new Set(targetMonths)]) {
    for (const r of selected) {
      if (book.records.some(e => e.month === month && e.householdCategoryId === categoryId && e.description.trim().toLowerCase() === r.description.trim().toLowerCase() && (e.householdSubId || '') === (r.householdSubId || ''))) throw Error(month + ' already has “' + r.description + '”. Nothing copied. Review that month first.');
      const row = {
        ...newTransaction(next, def, month, income),
        description: r.description,
        householdSubId: r.householdSubId || '',
        amount: keepAmounts ? r.amount : null,
        state: 'planned',
        transactionDate: ''
      };
      next.records.push(row);
      if (copyNotes) for (const note of book.notes.filter(n => n.recordId === r.id)) next.notes.push({
        id: crypto.randomUUID(),
        recordId: row.id,
        storage: 'app',
        sheet: month,
        cell: 'New entry',
        text: note.text
      });
    }
    if (!def.months.includes(month)) def.months.push(month);
  }
  def.months = MONTHS.filter(m => def.months.includes(m));
  return next;
}
export function moveHouseholdEntries(book, {
  income = false,
  entryIds,
  targetId,
  subId = ''
}) {
  const field = income ? 'incomeSources' : 'householdCategories',
    target = book[field]?.find(c => c.id === targetId);
  if (!target) throw Error('Choose a destination category.');
  if (subId && !target.subs.some(s => s.id === subId)) throw Error('Choose a valid destination subcategory.');
  const ids = new Set(entryIds);
  if (!ids.size) throw Error('Select entries to move.');
  const selected = book.records.filter(r => ids.has(r.id) && (income ? r.kind === 'income' : r.scope === 'residence' && r.kind === 'expense'));
  if (selected.length !== ids.size) throw Error('Some selected entries are no longer available. Close this window and select them again.');
  const next = structuredClone(book);
  for (const r of next.records.filter(r => ids.has(r.id))) {
    r.householdCategoryId = target.id;
    r.householdSubId = subId;
    if (!income) r.subCategory = target.name;
  }
  const dest = next[field].find(c => c.id === target.id);
  dest.months = MONTHS.filter(m => dest.months.includes(m) || selected.some(r => r.month === m));
  return next;
}
