import React, { useState, useEffect } from 'react';
import { normalizeOrder } from './SidebarNav.jsx';
export const groups = [['reports', 'Reports & Planning', ['rearview', 'summary', 'compare', 'recurring', 'year_setup']], ['settings', 'Settings & Setup', ['edition', 'preferences', 'move_setup', 'categories', 'business_defaults', 'bank', 'debts']], ['files', 'Files, Backups & Help', ['locations', 'recovery', 'links', 'help']]];
function browserId() {
  const key = 'cuf-tools-browser';
  let id = document.cookie.split('; ').find(v => v.startsWith(key + '='))?.slice(key.length + 1);
  if (!/^[0-9a-f-]{36}$/.test(id || '')) {
    id = crypto.randomUUID();
    document.cookie = key + '=' + id + '; Max-Age=31536000; Path=/; SameSite=Strict';
  }
  if (!document.cookie.includes(key + '=' + id)) throw Error('Allow local cookies to remember separate shortcuts for this browser.');
  return id;
}
export default function ToolsNav({
  items,
  order,
  active,
  onSelect,
  ready,
  api
}) {
  const [layout, setLayout] = useState({}),
    [editing, setEditing] = useState(false),
    [open, setOpen] = useState({}),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [client, setClient] = useState(''),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    try {
      const id = browserId();
      setClient(id);
      api('tool-layout?client=' + id).then(r => {
        if (alive) {
          setLayout(r.layout);
          setLoaded(true);
          setError('');
        }
      }).catch(e => {
        if (alive) setError(e.message);
      });
    } catch (e) {
      setError(e.message);
    }
    return () => {
      alive = false;
    };
  }, [reload]);
  const allowed = items.map(i => i[0]),
    pins = (Array.isArray(layout.pins) ? layout.pins : []).filter((k, i, a) => allowed.includes(k) && a.indexOf(k) === i),
    ordered = normalizeOrder(layout.order || order, items);
  async function save(next) {
    setSaving(true);
    try {
      const r = await api('tool-layout', {
        client,
        layout: {
          pins: next.pins || [],
          order: next.order || []
        },
        previous: layout
      });
      setLayout(r.layout);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  function pin(key) {
    save({
      ...layout,
      pins: (layout.pins || []).includes(key) ? (layout.pins || []).filter(k => k !== key) : [...(layout.pins || []), key]
    });
  }
  function move(key, keys, delta, pinned) {
    const next = [...keys],
      i = next.indexOf(key);
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    if (pinned) save({
      ...layout,
      pins: next
    });else {
      const positions = ordered.map((k, i) => keys.includes(k) ? i : -1).filter(i => i >= 0),
        all = [...ordered];
      positions.forEach((pos, i) => all[pos] = next[i]);
      save({
        ...layout,
        order: all
      });
    }
  }
  function rows(keys, pinned = false) {
    return keys.map((key, i) => {
      const [, Icon, label] = items.find(x => x[0] === key);
      return <div className="tool-nav-row" key={key}><button className={'tool-link ' + (active === key ? 'active' : '')} aria-current={active === key ? 'page' : undefined} onClick={() => onSelect(key)}><Icon size={18} /><span>{label}</span></button>{editing && <div className="tool-customize-row"><button disabled={saving} onClick={() => pin(key)} aria-label={(pinned ? 'Unpin ' : 'Pin ') + label}>{pinned ? 'Put back in group' : 'Pin to Quick Access'}</button><button disabled={saving || i === 0} aria-label={'Move ' + label + ' up'} onClick={() => move(key, keys, -1, pinned)}>↑</button><button disabled={saving || i === keys.length - 1} aria-label={'Move ' + label + ' down'} onClick={() => move(key, keys, 1, pinned)}>↓</button></div>}</div>;
    });
  }
  return <div className="sidebar-navigation grouped-tools"><div className="nav-heading"><p className="nav-label">TOOLS & SETTINGS</p><button className="nav-arrange" disabled={!ready || !loaded || saving} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Customize'}</button></div>{editing && <p className="nav-arrange-hint">Pin tools above the groups, put them back, or use the arrows to reorder. Choices save for this browser and stay available after restarting the app.</p>}<nav aria-label="Tools navigation">{pins.length > 0 && <section className="tool-quick-access" aria-label="Quick Access"><h3>Quick Access</h3>{rows(pins, true)}</section>}{groups.map(([id, label, members]) => {
        const keys = ordered.filter(k => members.includes(k) && !pins.includes(k)),
          expanded = editing || !!open[id];
        return <section className="tool-nav-group" key={id}><button className={'tool-group-heading ' + (members.includes(active) && !pins.includes(active) ? 'contains-active' : '')} aria-expanded={expanded} aria-controls={'tools-' + id} onClick={() => setOpen({
            ...open,
            [id]: !open[id]
          })} disabled={editing}><span aria-hidden="true">{expanded ? '▾' : '▸'}</span><strong>{label}</strong></button>{expanded && <div id={'tools-' + id} className="tool-group-items">{rows(keys)}{!keys.length && <p className="nav-arrange-hint">All items are in Quick Access.</p>}</div>}</section>;
      })}</nav>{error && <p className="nav-arrange-error" role="alert">{error} <button onClick={() => setReload(reload + 1)}>Reload Shortcuts</button></p>}</div>;
}
