import React from 'react';
import { customerContacts, withCustomers } from './customerContacts.js';
export default function CustomerContacts({
  profile,
  onChange
}) {
  const people = customerContacts(profile);
  const save = next => onChange(withCustomers(profile, next));
  const person = (i, patch) => save(people.map((c, n) => n === i ? {
    ...c,
    ...patch
  } : c));
  function methods(c, i, kind, label) {
    const rows = c[kind] || [];
    return <section><h4>{label}</h4>{rows.map((r, j) => <div className="customer-contact-row" key={j}><label>{kind === 'phones' ? 'Phone number' : 'Email address'}<input type={kind === 'phones' ? 'tel' : 'email'} required maxLength={kind === 'phones' ? 100 : 254} data-detail={i === 0 && j === 0 && kind === 'phones' ? 'customerPhone' : undefined} value={r.value} onChange={e => person(i, {
            [kind]: rows.map((x, n) => n === j ? {
              ...x,
              value: e.target.value
            } : x)
          })} /></label><label>Label (optional)<input maxLength={50} placeholder={kind === 'phones' ? 'Mobile, Home, Work' : 'Personal, Work'} value={r.label} onChange={e => person(i, {
            [kind]: rows.map((x, n) => n === j ? {
              ...x,
              label: e.target.value
            } : x)
          })} /></label><button type="button" aria-pressed={r.preferred} onClick={() => person(i, {
          [kind]: rows.map((x, n) => ({
            ...x,
            preferred: n === j
          }))
        })}>{r.preferred ? 'Preferred' : 'Make Preferred'}</button><button type="button" aria-label={'Remove ' + (kind === 'phones' ? 'phone' : 'email') + ' ' + (j + 1) + ' for ' + (c.name || 'customer')} onClick={() => {
          const next = rows.filter((_, n) => n !== j);
          if (r.preferred && next.length) next[0] = {
            ...next[0],
            preferred: true
          };
          person(i, {
            [kind]: next
          });
        }}>Remove</button></div>)}<button type="button" disabled={rows.length >= 20} onClick={() => person(i, {
        [kind]: [...rows, {
          value: '',
          label: '',
          preferred: rows.length === 0
        }]
      })}>Add {kind === 'phones' ? 'Phone Number' : 'Email Address'}</button></section>;
  }
  return <section className="customer-contacts"><p className="hint">One inspection can have several customers. Add phone numbers and email addresses to the person they belong to; contact methods are optional. The first customer remains the primary contact.</p>{people.map((c, i) => <section className="customer-contact-card" key={i}><div className="section-title"><h4>{i === 0 ? 'Primary Customer' : 'Additional Customer ' + i}</h4>{i > 0 && <button type="button" onClick={() => {
          if (window.confirm('Remove this customer and their contact details from this inspection?')) save(people.filter((_, n) => n !== i));
        }}>Remove Customer</button>}</div><label>Customer name<input required maxLength={200} data-detail={i === 0 ? 'customerName' : undefined} value={c.name} onChange={e => person(i, {
          name: e.target.value
        })} /></label>{methods(c, i, 'phones', 'Phone Numbers')}{methods(c, i, 'emails', 'Email Addresses')}</section>)}<button type="button" disabled={people.length >= 20} onClick={() => save([...people, {
      name: '',
      phones: [],
      emails: []
    }])}>Add Another Customer</button></section>;
}
