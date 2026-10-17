import React from 'react';
import PeriodDisclosure from './PeriodDisclosure.jsx';
export default function BusinessActivityNav({
  active,
  section,
  busy,
  onOpen
}) {
  return <PeriodDisclosure id="business-activity" label="Business Activity & Mileage" subject="Report"><div className="business-activity-nav" role="group" aria-label="Business activity reports">{[['mileage', 'Mileage'], ['inspections', 'Inspections'], ['rv', 'RV Breakdown'], ['dealers', 'Inspection Locations']].map(([key, label]) => <button key={key} disabled={busy} className={active && section === key ? 'active' : ''} aria-current={active && section === key ? 'page' : undefined} onClick={() => onOpen(key)}>{label}</button>)}</div></PeriodDisclosure>;
}
