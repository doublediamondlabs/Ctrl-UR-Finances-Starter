import { MONTHS, newTransaction } from './household.js';
const norm = s => String(s || '').trim().toLowerCase();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function prepareYear(source, target, {
  replacePlanned = false,
  keepAmounts = false,
  stageBusiness = true,
  stageIncome = true
} = {}) {
  if (!source || !target || Number(target.year) <= Number(source.year)) throw Error('Choose a destination year after the source year.');
  const next = structuredClone(target),
    changes = [],
    added = [],
    removed = [],
    protectedRows = [],
    skipped = [];
  const noteIds = new Set(next.notes.filter(n => n.recordId).map(n => n.recordId));
  const bankIds = new Set((next.bankHistory || []).map(h => h.recordId));
  if (replacePlanned) {
    next.records = next.records.filter(r => {
      if (r.state !== 'planned') return true;
      if (noteIds.has(r.id) || bankIds.has(r.id)) {
        protectedRows.push(r);
        return true;
      }
      removed.push(r);
      return false;
    });
  }
  const mapDef = {
      incomeSources: new Map(),
      householdCategories: new Map()
    },
    mapSub = new Map();
  for (const field of ['householdCategories', 'incomeSources']) {
    const old = next[field] || [],
      out = [],
      seen = new Set();
    for (const src of source[field] || []) {
      const matches = old.filter(x => x.id === src.id || norm(x.name) === norm(src.name));
      if (matches.length > 1) throw Error('Ambiguous category match for ' + src.name + '. Rename the conflicting destination category before refreshing.');
      const dest = matches[0];
      const id = dest?.id || src.id;
      mapDef[field].set(src.id, id);
      const subs = [],
        subSeen = new Set();
      for (const ss of src.subs || []) {
        const mm = (dest?.subs || []).filter(x => x.id === ss.id || norm(x.name) === norm(ss.name));
        if (mm.length > 1) throw Error('Ambiguous subcategory: ' + ss.name);
        const ds = mm[0],
          sub = {
            ...ss,
            id: ds?.id || ss.id
          };
        subs.push(sub);
        subSeen.add(sub.id);
        mapSub.set(src.id + ':' + ss.id, sub.id);
      }
      subs.push(...(dest?.subs || []).filter(s => !subSeen.has(s.id)));
      const used = next.records.filter(r => r.householdCategoryId === id).map(r => r.month),
        months = MONTHS.filter(m => (src.months || MONTHS).includes(m) || used.includes(m));
      const result = {
        ...dest,
        ...structuredClone(src),
        id,
        months,
        subs
      };
      if (!dest || !same(dest, result)) changes.push({
        area: field === 'incomeSources' ? 'Income source' : 'Housing category',
        name: src.name,
        action: dest ? 'Refresh setup' : 'Add',
        detail: months.join(', ') + '; subcategories: ' + (subs.map(s => s.name).join(', ') || 'none')
      });
      out.push(result);
      seen.add(id);
    }
    out.push(...old.filter(c => !seen.has(c.id)));
    if (!same(old.map(c => c.id), out.map(c => c.id))) changes.push({
      area: field === 'incomeSources' ? 'Income sources' : 'Housing categories',
      name: 'Order',
      action: 'Align with source',
      detail: 'Destination-only categories remain at the end.'
    });
    next[field] = out;
  }
  const oldCats = next.categories,
    catMap = new Map(),
    outCats = [];
  for (const c of source.categories) {
    const dest = oldCats.find(x => norm(x.name) === norm(c.name));
    const merged = {
      ...dest,
      ...structuredClone(c),
      name: dest?.name || c.name,
      subs: [...new Set([...(c.subs || []), ...(dest?.subs || [])])]
    };
    catMap.set(c.name, merged.name);
    outCats.push(merged);
    if (!dest || !same(dest, merged)) changes.push({
      area: 'Business category',
      name: merged.name,
      action: dest ? 'Refresh setup' : 'Add',
      detail: 'Subcategories: ' + merged.subs.join(', ')
    });
  }
  outCats.push(...oldCats.filter(c => !outCats.some(x => norm(x.name) === norm(c.name))));
  if (!same(oldCats.map(c => c.name), outCats.map(c => c.name))) changes.push({
    area: 'Business categories',
    name: 'Order',
    action: 'Align with source',
    detail: 'Destination-only categories remain at the end.'
  });
  next.categories = outCats;
  const latest = rows => [...rows].sort((a, b) => (a.state === 'recorded' ? 0 : 1) - (b.state === 'recorded' ? 0 : 1) || MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month))[0];
  const business = source.records.filter(r => r.kind === 'expense' && r.scope === 'business' && source.categories.find(c => c.name === r.category)?.role === 'recurring');
  const groups = new Map();
  for (const r of business) {
    const k = JSON.stringify([r.category, r.subCategory, r.description]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  if (stageBusiness) for (const rows of groups.values()) {
    const sample = latest(rows);
    for (const month of MONTHS) {
      const category = catMap.get(sample.category) || sample.category;
      const existing = next.records.some(r => r.month === month && r.kind === 'expense' && r.scope === 'business' && r.category === category && norm(r.subCategory) === norm(sample.subCategory) && norm(r.description) === norm(sample.description));
      if (existing) {
        skipped.push(month + ' · ' + sample.description);
        continue;
      }
      const row = {
        ...sample,
        id: crypto.randomUUID(),
        category,
        month,
        sheet: month,
        state: 'planned',
        amount: keepAmounts && sample.recurringType !== 'variable' ? sample.amount : null,
        transactionDate: '',
        isNew: true,
        amountCell: null,
        descriptionCell: null,
        milesCell: null,
        locationCell: null,
        miles: null,
        location: ''
      };
      next.records.push(row);
      added.push(row);
    }
  }
  if (stageIncome) for (const src of (source.incomeSources || []).filter(c => c.recurring)) {
    const samples = source.records.filter(r => r.kind === 'income' && r.householdCategoryId === src.id);
    if (!samples.length) continue;
    const picked = latest(samples);
    const templateMonth = samples.filter(r => r.month === picked.month && r.state === picked.state),
      dest = next.incomeSources.find(c => c.id === mapDef.incomeSources.get(src.id));
    for (const month of dest.months) {
      if (next.records.some(r => r.month === month && r.kind === 'income' && r.householdCategoryId === dest.id)) {
        skipped.push(month + ' · ' + src.name);
        continue;
      }
      for (const sample of templateMonth) {
        const row = {
          ...newTransaction(next, dest, month, true),
          description: sample.description,
          householdSubId: mapSub.get(src.id + ':' + sample.householdSubId) || '',
          state: 'planned',
          amount: keepAmounts && sample.recurringType !== 'variable' ? sample.amount : null,
          recurringType: sample.recurringType || 'fixed'
        };
        next.records.push(row);
        added.push(row);
      }
    }
  }
  return {
    book: next,
    changes,
    added,
    removed,
    protectedRows,
    skipped,
    recordedKept: target.records.filter(r => r.state === 'recorded').length
  };
}
