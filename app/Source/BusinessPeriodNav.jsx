import React from 'react';
import PeriodDisclosure from './PeriodDisclosure.jsx';
import { MONTHS } from './inspectionIncome.js';
export default function BusinessPeriodNav({
  year,
  month,
  links,
  busy,
  onOpen
}) {
  const years = [...new Set([2024, 2025, 2026, year, ...Object.keys(links).map(Number)])].sort((a, b) => a - b);
  return <PeriodDisclosure id="sidebar" label={MONTHS[month] + ' ' + year}><div className="business-period-nav" role="group" aria-label="Business year and month"><div className="business-period-fields"><label>Year<select aria-label="Business year" disabled={busy} value={year} onChange={e => onOpen(Number(e.target.value), 0)}>{years.map(y => <option value={y} key={y}>{y}{links[y] ? '' : ' · Not linked'}</option>)}</select></label><label>Month<select aria-label="Business month" disabled={busy} value={month} onChange={e => onOpen(year, Number(e.target.value))}>{MONTHS.map((m, i) => <option value={i} key={m}>{m}</option>)}</select></label></div><button disabled={busy} className="open-business-period" onClick={() => onOpen(year, month)}>Open {MONTHS[month]} {year} →</button></div></PeriodDisclosure>;
}
