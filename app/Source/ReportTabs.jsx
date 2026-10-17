import React from 'react';
export default function ReportTabs({
  id,
  label,
  items,
  value,
  onChange
}) {
  function keys(e, index) {
    let next;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;else if (e.key === 'ArrowLeft') next = (index + items.length - 1) % items.length;else if (e.key === 'Home') next = 0;else if (e.key === 'End') next = items.length - 1;else return;
    e.preventDefault();
    onChange(items[next][0]);
    document.getElementById(id + '-tab-' + items[next][0])?.focus();
  }
  return <div className="report-page-tabs" role="tablist" aria-label={label}>{items.map(([key, title, panelKey], i) => <button type="button" key={key} id={id + '-tab-' + key} role="tab" aria-selected={value === key} aria-controls={id + '-panel-' + (panelKey || key)} tabIndex={value === key ? 0 : -1} onKeyDown={e => keys(e, i)} onClick={() => onChange(key)}>{title}</button>)}</div>;
}
