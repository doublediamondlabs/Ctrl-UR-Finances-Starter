import SidebarGroup from './SidebarGroup.jsx';
import React, { useState, useRef } from 'react';
export function normalizeOrder(order, items) {
  const allowed = items.map(i => i[0]);
  return [...new Set([...(Array.isArray(order) ? order : []).filter(k => allowed.includes(k)), ...allowed])];
}
export default function SidebarNav({
  items,
  order,
  active,
  onSelect,
  onSave,
  ready,
  title = 'LOCAL WORKSPACE',
  navLabel = 'Workspace navigation',
  renderBelow,
  collapsibleKeys = []
}) {
  const [draft, setDraft] = useState(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    drag = useRef(null);
  const current = normalizeOrder(order, items),
    shown = draft || current;
  function move(key, target) {
    if (saving || key === target) return;
    setDraft(prev => {
      const next = [...prev],
        from = next.indexOf(key),
        to = next.indexOf(target);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, key);
      return next;
    });
  }
  async function save() {
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return <div className="sidebar-navigation"><div className="nav-heading"><p className="nav-label">{title}</p>{draft === null && <button className="nav-arrange" disabled={!ready} onClick={() => {
        setError('');
        setDraft(current);
      }}>Arrange</button>}</div>
 {draft !== null && <p className="nav-arrange-hint">Drag rows or use the arrows. Choose Save order when finished.</p>}
 <nav aria-label={navLabel}>{shown.map((key, index) => {
        const [, Icon, label] = items.find(i => i[0] === key);
        return draft !== null ? <div className="nav-arrange-row" key={key} draggable={!saving} onDragStart={e => {
          drag.current = key;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', key);
        }} onDragEnd={() => drag.current = null} onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }} onDrop={e => {
          e.preventDefault();
          if (drag.current) move(drag.current, key);
          drag.current = null;
        }}><span className="nav-arrange-name"><span aria-hidden="true">⠿</span><Icon size={17} />{label}</span><button disabled={saving || index === 0} aria-label={'Move ' + label + ' up'} onClick={() => move(key, shown[index - 1])}>↑</button><button disabled={saving || index === shown.length - 1} aria-label={'Move ' + label + ' down'} onClick={() => move(key, shown[index + 1])}>↓</button></div> : collapsibleKeys.includes(key) ? <SidebarGroup key={key} id={key} label={label} Icon={Icon} active={active === key} onOpen={() => onSelect(key)}>{renderBelow?.(key)}</SidebarGroup> : <React.Fragment key={key}><button className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => onSelect(key)}><Icon size={19} />{label}</button>{renderBelow?.(key)}</React.Fragment>;
      })}</nav>
 {draft !== null && <div className="nav-arrange-actions"><button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Order"}</button><button disabled={saving} onClick={() => {
        setDraft(null);
        setError('');
      }}>Cancel</button><button disabled={saving} onClick={() => setDraft(items.map(i => i[0]))}>Reset Order</button></div>}
 {error && <p className="nav-arrange-error" role="alert">{error}</p>}
 </div>;
}
