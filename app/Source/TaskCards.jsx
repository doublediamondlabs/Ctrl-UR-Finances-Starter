import React, { useState } from 'react';
import { GripVertical, ArrowUp, ArrowDown, Pencil, Trash2, CalendarDays, Copy } from 'lucide-react';
import { Cue, when, deadlineStatus } from './Overview.jsx';
export const taskColors = {
  slate: '#64748b',
  blue: '#2563eb',
  teal: '#0f766e',
  green: '#398044',
  amber: '#b77910',
  rose: '#be4565',
  purple: '#8054b2'
};
export function orderedTasks(items) {
  const custom = items.some(i => !i.completed && Number.isInteger(i.rank));
  return [...items].sort((a, b) => Number(!!a.completed) - Number(!!b.completed) || (!a.completed && custom ? (a.rank ?? 9999) - (b.rank ?? 9999) : 0) || a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
}
export function moveTask(items, id, target) {
  const open = orderedTasks(items).filter(i => !i.completed),
    from = open.findIndex(i => i.id === id),
    to = open.findIndex(i => i.id === target);
  if (from < 0 || to < 0 || from === to) return items;
  open.splice(to, 0, open.splice(from, 1)[0]);
  const ranks = new Map(open.map((i, n) => [i.id, n]));
  return items.map(i => i.completed ? i : {
    ...i,
    rank: ranks.get(i.id)
  });
}
export function dateOrder(items) {
  return items.map(i => {
    if (i.completed) return i;
    const {
      rank,
      ...rest
    } = i;
    return rest;
  });
}
export function TaskColorPicker({
  value,
  onChange
}) {
  return <div className="task-color-picker"><strong>Card accent color</strong><div role="group" aria-label="Card accent color">{Object.entries(taskColors).map(([name, color]) => <button key={name} type="button" title={name} aria-label={name + ' accent'} aria-pressed={value === name} onClick={() => onChange(name)} style={{
        '--task-accent': color
      }}><span />{name}</button>)}</div><small>Choose your own meaning. Due-date status stays separate from card color.</small></div>;
}
export function TaskCards({
  items,
  display,
  busy,
  today,
  onEdit,
  onCopy,
  onSave
}) {
  const [drag, setDrag] = useState(null);
  const open = orderedTasks(items).filter(i => !i.completed),
    custom = open.some(i => Number.isInteger(i.rank));
  const saveMove = (id, target) => {
    setDrag(null);
    const next = moveTask(items, id, target);
    if (next !== items) onSave(next);
  };
  return <><div className="task-toolbar"><span>{custom ? 'Custom order' : 'Due-date order'} · {open.length} open tasks</span><button disabled={busy || !custom} onClick={() => onSave(dateOrder(items))}>Sort By Due Date</button></div><div className="task-card-grid">{display.map(i => {
        const status = deadlineStatus(i, today),
          index = open.findIndex(t => t.id === i.id);
        return <article key={i.id} className={'task-card' + (drag === i.id ? ' is-dragging' : '')} style={{
          '--task-accent': taskColors[i.color] || taskColors.slate
        }} onDragOver={e => {
          if (drag && !i.completed && !busy) e.preventDefault();
        }} onDrop={e => {
          e.preventDefault();
          if (drag && !i.completed && !busy) saveMove(drag, i.id);
        }}><div className="task-card-heading"><h3>{i.title}</h3>{!i.completed && <button className="task-icon drag-handle" draggable={!busy} disabled={busy} title="Drag to reorder; or use the move buttons below" aria-label={'Drag ' + i.title + ' to reorder'} onDragStart={e => {
              setDrag(i.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', i.id);
            }} onDragEnd={() => setDrag(null)}><GripVertical size={18} /></button>}</div><span className="task-area">{i.area}</span><p className="task-due"><CalendarDays size={16} />{i.completed ? 'Completed ' : 'Due '}<strong>{when(i.completed || i.due)}</strong></p><Cue state={status.state}>{status.label}</Cue>{i.note && <details><summary>Notes</summary><p className="preserve-lines">{i.note}</p></details>}<details className="task-audit"><summary>Dates &amp; recurrence</summary><small>Status as of {when(today)}<br />Last updated {when(i.updated)}<br />{i.repeat === 'monthly' ? 'Repeats monthly after completion' : i.repeat === 'annual' ? 'Repeats annually after completion' : 'One-time task'}</small></details><div className="task-card-controls"><button className="task-icon" disabled={busy} title="Copy task — choose a new due date before saving" aria-label={'Copy ' + i.title} onClick={() => onCopy(i)}><Copy size={16} /></button>{!i.completed && <><button className="task-icon" disabled={busy || index === 0} title="Move earlier" aria-label={'Move ' + i.title + ' earlier'} onClick={() => saveMove(i.id, open[index - 1].id)}><ArrowUp size={17} /></button><button className="task-icon" disabled={busy || index === open.length - 1} title="Move later" aria-label={'Move ' + i.title + ' later'} onClick={() => saveMove(i.id, open[index + 1].id)}><ArrowDown size={17} /></button><button className="task-edit" disabled={busy} title="Edit or mark complete" onClick={() => onEdit(i)}><Pencil size={15} />Edit / Complete</button><button className="task-icon" disabled={busy} title="Remove task" aria-label={'Remove ' + i.title} onClick={() => {
                if (confirm('Remove “' + i.title + '”?')) onSave(items.filter(r => r.id !== i.id));
              }}><Trash2 size={16} /></button></>}</div></article>;
      })}</div></>;
}
