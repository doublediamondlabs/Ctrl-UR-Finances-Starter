export function customerContacts(p = {}) {
  return p.customers?.length ? p.customers : [{
    name: p.customerName || '',
    phones: p.customerPhone ? [{
      value: p.customerPhone,
      label: '',
      preferred: true
    }] : [],
    emails: p.customerEmail ? [{
      value: p.customerEmail,
      label: '',
      preferred: true
    }] : []
  }];
}
const preferred = rows => (rows.find(r => r.preferred) || rows[0])?.value || '';
export function withCustomers(profile, customers) {
  return {
    ...profile,
    customers,
    customerName: customers[0]?.name || '',
    customerPhone: preferred(customers[0]?.phones || []),
    customerEmail: preferred(customers[0]?.emails || [])
  };
}
export const customerNames = p => customerContacts(p).map(c => c.name).filter(Boolean).join(' & ');
export function validateCustomers(p) {
  if (p.customers === undefined) return;
  if (!Array.isArray(p.customers) || !p.customers.length || p.customers.length > 20) throw Error('Use 1–20 customers per inspection.');
  for (const c of p.customers) {
    if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 200) throw Error('Enter a name for each customer (up to 200 characters).');
    for (const kind of ['phones', 'emails']) {
      const rows = c[kind];
      if (!Array.isArray(rows) || rows.length > 20) throw Error('Use up to 20 phone numbers or emails per customer.');
      if (rows.filter(r => r?.preferred).length > 1) throw Error('Choose only one preferred phone and email per customer.');
      for (const r of rows) {
        if (!r || typeof r.value !== 'string' || !r.value.trim() || r.value.length > (kind === 'phones' ? 100 : 254) || typeof r.label !== 'string' || r.label.length > 50 || typeof r.preferred !== 'boolean') throw Error('Complete or remove blank contact rows. Keep labels to 50 characters.');
        if (kind === 'emails' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.value.trim())) throw Error('Enter a valid email address.');
      }
    }
  }
  const synced = withCustomers(p, p.customers);
  if (['customerName', 'customerPhone', 'customerEmail'].some(k => (p[k] || '') !== synced[k])) throw Error('Customer summary is out of sync. Reopen the customer details and save again.');
}
