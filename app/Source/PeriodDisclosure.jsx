import React, { useState } from 'react';
export default function PeriodDisclosure({
  id,
  label,
  children,
  subject = "Year / Month"
}) {
  const key = 'dd-period-' + id;
  const [open, setOpen] = useState(() => {
    try {
      return document.cookie.split('; ').includes(key + '=open');
    } catch {
      return false;
    }
  });
  return <section className="period-disclosure"><button type="button" className="period-disclosure-toggle" aria-expanded={open} aria-controls={key} onClick={() => {
      const next = !open;
      setOpen(next);
      try {
        document.cookie = key + '=' + (next ? 'open' : 'closed') + '; Path=/; Max-Age=31536000; SameSite=Lax';
      } catch {}
    }}>{label} <span>{open ? 'Hide ' + subject + ' ▴' : 'Choose ' + subject + ' ▾'}</span></button><div id={key} hidden={!open}>{children}</div></section>;
}
