import React, { useState } from 'react';
export default function SidebarGroup({
  id,
  label,
  Icon,
  active,
  onOpen,
  children
}) {
  const cookie = 'dd-sidebar-group-' + id;
  const [open, setOpen] = useState(() => {
    try {
      return document.cookie.split('; ').includes(cookie + '=open');
    } catch {
      return false;
    }
  });
  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      document.cookie = cookie + '=' + (next ? 'open' : 'closed') + '; Path=/; Max-Age=31536000; SameSite=Lax';
    } catch {}
  }
  return <section className="sidebar-workspace-group"><button type="button" className={'sidebar-group-toggle' + (active ? ' active' : '')} aria-expanded={open} aria-controls={cookie} onClick={toggle}><Icon size={19} /><span>{label}</span><span aria-hidden="true">{open ? '▾' : '▸'}</span></button><div id={cookie} hidden={!open}><button type="button" className="sidebar-group-open" aria-current={active ? 'page' : undefined} onClick={onOpen}>Open {label} →</button>{children}</div></section>;
}
