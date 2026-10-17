import React, { useState, useEffect } from 'react';
export const initialEditions = {
  visible: false,
  active: 'my-edition',
  items: [{
    id: 'my-edition',
    title: 'Your Next Chapter',
    label: 'EDITION',
    dedication: '',
    reference: '',
    color: '#e6cc93',
    art: 'trail',
    image: ''
  }]
};
export function Tribute({
  settings = initialEditions,
  preview = false
}) {
  const e = settings.items.find(e => e.id === settings.active);
  if (!e || !settings.visible && !preview) return null;
  return <div className="loop-edition"><div className="loop-edition-heading">{e.art === 'image' && e.image ? <img className="loop-mark" src={e.image} alt="Edition artwork" /> : e.art === 'none' ? null : <svg viewBox="0 0 80 64" className="loop-mark" role="img" aria-label={e.art === 'orion' ? 'Orion constellation' : 'A looping woodland trail beneath a sunrise'}>{e.art === 'orion' ? <g stroke={e.color} fill={e.color}><path d="M23 6 56 10 47 30 61 58 19 54 33 34Z M33 34 40 32 47 30" fill="none" opacity=".4" />{[[23, 6], [56, 10], [47, 30], [61, 58], [19, 54], [33, 34], [40, 32]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" />)}</g> : <><path d="M31 24a10 10 0 0 1 20 0" fill={e.color} /><path d="M41 6v4M24 11l3 3M58 11l-3 3M19 23h4M59 23h4" fill="none" stroke={e.color} strokeWidth="2" strokeLinecap="round" /><path d="M7 29c15-5 48-5 66 0" fill="none" stroke="#719786" strokeWidth="2" /><path d="M24 32c-17 5-21 16-8 22 13 6 41 5 49-4 8-9-4-16-17-15-12 1-22 7-18 11 3 3 12 3 18 0" fill="none" stroke="#c5ab83" strokeWidth="3" strokeLinecap="round" /><path d="m15 17-6 11h12Z m49 4-5 10h10Z" fill="#81aa91" /><path d="M15 28v6M64 31v5" stroke="#81aa91" strokeWidth="2" /></>}</svg>}<div><strong style={{
          color: e.color
        }}>{e.title}</strong><span>{e.label}</span></div></div>{e.dedication && <p className="loop-dedication">{e.dedication}</p>}{e.reference && <p className="loop-reference" style={{
      whiteSpace: 'pre-line'
    }}>{e.reference}</p>}</div>;
}
export default function EditionSettings({
  value,
  onSave,
  onDirty
}) {
  const [draft, setDraft] = useState(() => structuredClone(value)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [reading, setReading] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value),
    e = draft.items.find(x => x.id === draft.active);
  useEffect(() => {
    onDirty(dirty || reading);
    return () => onDirty(false);
  }, [dirty, reading]);
  function change(next) {
    setDraft(next);
    setMessage('');
  }
  function field(k, v) {
    change({
      ...draft,
      items: draft.items.map(x => x.id === e.id ? {
        ...x,
        [k]: v
      } : x)
    });
  }
  async function upload(file) {
    if (!file) return;
    setError('');
    setReading(true);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw Error('Choose a PNG, JPEG or WebP image under 8 MB.');
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = canvas.toDataURL('image/png');
      if (image.length > 350000) throw Error('This image is too detailed. Try a simpler or smaller image.');
      change({
        ...draft,
        items: draft.items.map(x => x.id === e.id ? {
          ...x,
          art: 'image',
          image
        } : x)
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
    }
  }
  return <section className="panel edition-settings"><h2>Edition &amp; Tribute</h2><p className="hint">Create and keep editions here, then choose which one appears in the sidebar. Save to apply your changes for both users; other open windows show them after refreshing.</p><fieldset disabled={saving || reading}><label className="check-label"><input type="checkbox" checked={draft.visible} onChange={ev => change({
          ...draft,
          visible: ev.target.checked
        })} />Show tribute in sidebar</label><label>Selected edition<select value={draft.active} onChange={ev => change({
          ...draft,
          active: ev.target.value
        })}>{draft.items.map(x => <option key={x.id} value={x.id}>{x.title || 'Untitled edition'}</option>)}</select></label><div className="edition-actions"><button disabled={draft.items.length >= 20} onClick={() => {
          const item = {
            ...initialEditions.items[0],
            id: crypto.randomUUID(),
            title: 'New Edition',
            dedication: '',
            reference: ''
          };
          change({
            ...draft,
            active: item.id,
            items: [...draft.items, item]
          });
        }}>New Edition</button><button disabled={draft.items.length >= 20} onClick={() => {
          const item = {
            ...e,
            id: crypto.randomUUID(),
            title: (e.title + ' copy').slice(0, 80)
          };
          change({
            ...draft,
            active: item.id,
            items: [...draft.items, item]
          });
        }}>Duplicate</button><button disabled={draft.items.length === 1} onClick={() => {
          if (confirm('Remove this saved edition? This takes effect when you save.')) {
            const items = draft.items.filter(x => x.id !== e.id);
            change({
              ...draft,
              items,
              active: items[0].id
            });
          }
        }}>Remove Edition</button></div><div className="edition-layout"><div>{[['title', 'Title', 80], ['label', 'Edition label (optional)', 40], ['dedication', 'Dedication (optional)', 400], ['reference', 'Location / date / reference (optional)', 200]].map(([key, label, max]) => <label key={key}>{label}{key === 'dedication' || key === 'reference' ? <textarea maxLength={max} value={e[key]} onChange={ev => field(key, ev.target.value)} /> : <input maxLength={max} value={e[key]} onChange={ev => field(key, ev.target.value)} />}</label>)}<label>Accent color<input type="color" value={e.color} onChange={ev => field('color', ev.target.value)} /></label><label>Artwork<select value={e.art} onChange={ev => field('art', ev.target.value)}><option value="trail">Looping trail &amp; sunrise</option><option value="orion">Orion constellation</option><option value="none">No artwork</option><option value="image">Uploaded image</option></select></label><label>Upload artwork (PNG, JPEG or WebP)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={ev => {
              upload(ev.target.files[0]);
              ev.target.value = '';
            }} /></label>{reading && <p>Preparing artwork…</p>}{e.image && <button onClick={() => change({
            ...draft,
            items: draft.items.map(x => x.id === e.id ? {
              ...x,
              image: '',
              art: x.art === 'image' ? 'none' : x.art
            } : x)
          })}>Remove Uploaded Image</button>}</div><div><h3>Sidebar preview</h3><div className="edition-preview"><Tribute settings={draft} preview /></div>{!draft.visible && <p className="hint">Preview only. The saved sidebar tribute will be hidden.</p>}</div></div><div className="edition-actions"><button className="primary" disabled={!dirty || !e.title.trim() || draft.items.some(x => !x.title.trim() || x.art === 'image' && !x.image)} onClick={async () => {
          setSaving(true);
          setError('');
          try {
            await onSave(draft);
            setMessage('Edition saved.');
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}>{saving ? 'Saving…' : 'Save Editions'}</button><button disabled={!dirty} onClick={() => {
          setDraft(structuredClone(value));
          setError('');
          setMessage('Changes discarded.');
        }}>Discard Changes</button></div></fieldset>{error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}</section>;
}
