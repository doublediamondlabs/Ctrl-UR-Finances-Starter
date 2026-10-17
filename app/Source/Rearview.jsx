import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { emptyRearview, rearviewStats } from './rearview.js';
const number = n => n.toLocaleString('en-US', {
  maximumFractionDigits: 1
});
function Photo({
  photo
}) {
  return photo ? <figure><img src={photo.image} alt={photo.caption || 'Yearbook photo'} />{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure> : null;
}
export function Recap({
  year,
  data,
  stats,
  modules = {
    business: true,
    inspections: true
  }
}) {
  return <div className="rearview-recap"><div className="rearview-cover"><p className="rearview-kicker">YEAR IN THE REARVIEW · {year}</p><h1>{data.title || 'A year worth remembering'}</h1>{data.intro && <p className="rearview-prose">{data.intro}</p>}<Photo photo={data.cover} /></div>{modules.business && <div className="rearview-highlights">{[...(modules.inspections ? [[stats.inspections, 'Inspections with activity'], [number(stats.miles), 'Recorded inspection miles']] : []), [stats.active, 'Months with business activity']].map(([n, label]) => <div key={label}><strong>{n}</strong><span>{label}</span></div>)}</div>}{modules.business && modules.inspections && <p className="hint">Based on recorded work for {year}, as of {new Date().toLocaleDateString()}. Inspections count once annually; return visits can appear in multiple months. Scheduled visits are excluded. Older recorded workbook entries are included. Other business travel is excluded from inspection miles.{stats.missingMiles > 0 && ` ${stats.missingMiles} trip(s) have missing mileage.`}{stats.undated > 0 && ` ${stats.undated} completed or partial visit(s) lack dates and are excluded from inspection counts.`}</p>}<div className="rearview-month-grid">{stats.months.map((m, i) => {
        const memory = data.months[i];
        if ((!modules.inspections || !m.inspections && !m.miles) && !memory.note && !memory.photos.length) return null;
        return <section className="rearview-memory" key={m.name}><h2>{m.name}</h2>{modules.inspections && <p className="rearview-month-stats">{m.inspections} inspections with activity · {number(m.miles)} recorded miles</p>}{memory.note && <p className="rearview-prose">{memory.note}</p>}<div className="rearview-photos">{memory.photos.map((p, i) => <Photo key={i} photo={p} />)}</div></section>;
      })}</div>{data.outlook && <section className="rearview-memory"><h2>Looking ahead</h2><p className="rearview-prose">{data.outlook}</p></section>}</div>;
}
export default function Rearview({
  book,
  api,
  onDirty,
  modules = {
    business: true,
    inspections: true
  }
}) {
  const [packet, setPacket] = useState(null),
    [draft, setDraft] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [preview, setPreview] = useState(false);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(packet?.data || emptyRearview()),
    stats = rearviewStats(book);
  async function load() {
    setBusy(true);
    setError('');
    try {
      const r = await api('rearview?year=' + book.year);
      setPacket(r);
      setDraft(r.data || emptyRearview());
      setMessage('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      document.body.classList.remove('printing-rearview');
    };
  }, [book.year]);
  useEffect(() => {
    onDirty(dirty || busy);
    return () => onDirty(false);
  }, [dirty, busy]);
  function change(next) {
    setDraft(next);
    setMessage('');
  }
  function month(i, value) {
    change({
      ...draft,
      months: draft.months.map((m, j) => i === j ? {
        ...m,
        ...value
      } : m)
    });
  }
  async function upload(file, i) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw Error('Choose a PNG, JPEG or WebP photo under 15 MB.');
      const image = await createImageBitmap(file),
        scale = Math.min(1, 1200 / Math.max(image.width, image.height)),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      let encoded = canvas.toDataURL('image/jpeg', .8);
      if (encoded.length > 600000) encoded = canvas.toDataURL('image/jpeg', .55);
      if (encoded.length > 600000) throw Error('Try a smaller photo.');
      const photo = {
        image: encoded,
        caption: ''
      };
      if (i === null) change({
        ...draft,
        cover: photo
      });else month(i, {
        photos: [...draft.months[i].photos, photo]
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function photoEditor(p, index, i) {
    return <div className="rearview-photo-editor" key={index}><Photo photo={p} /><label>Caption<input maxLength={300} value={p.caption} onChange={e => i === null ? change({
          ...draft,
          cover: {
            ...p,
            caption: e.target.value
          }
        }) : month(i, {
          photos: draft.months[i].photos.map((x, j) => j === index ? {
            ...x,
            caption: e.target.value
          } : x)
        })} /></label><button onClick={() => i === null ? change({
        ...draft,
        cover: null
      }) : month(i, {
        photos: draft.months[i].photos.filter((_, j) => j !== index)
      })}>Remove Photo</button></div>;
  }
  function picker(i) {
    return <label className="rearview-upload">{i === null ? 'Choose cover photo' : 'Add photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
        upload(e.target.files[0], i);
        e.target.value = '';
      }} /></label>;
  }
  return <section className="panel rearview"><div className="rearview-actions"><button disabled={busy || !draft} onClick={() => setPreview(!preview)}>{preview ? 'Edit Memories' : 'Preview Yearbook'}</button><button disabled={busy || !draft || dirty} onClick={() => {
        document.body.classList.add('printing-rearview');
        const done = () => {
          document.body.classList.remove('printing-rearview');
          window.removeEventListener('afterprint', done);
        };
        window.addEventListener('afterprint', done);
        window.print();
      }}>Print / Save as PDF</button><button disabled={busy} onClick={() => {
        if (!dirty || confirm('Discard unsaved memories and reload the saved yearbook?')) load();
      }}>Reload Saved Memories</button></div><p className="hint">Photos and memories stay offline and are included in app backups. Add up to two photos per month. Save before printing. The printable recap contains no financial amounts or customer records; review your own photos and captions before sharing.</p>{error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}{!draft ? <p>Loading yearbook…</p> : <><fieldset disabled={busy}>{preview ? <Recap year={book.year} data={draft} stats={stats} modules={modules} /> : <><h2>Your {book.year} yearbook</h2><label>Cover title<input maxLength={100} placeholder="A year worth remembering" value={draft.title} onChange={e => change({
              ...draft,
              title: e.target.value
            })} /></label><label>Opening note<textarea maxLength={2000} value={draft.intro} onChange={e => change({
              ...draft,
              intro: e.target.value
            })} /></label>{draft.cover ? photoEditor(draft.cover, 0, null) : picker(null)}{modules.business && <div className="rearview-highlights">{modules.inspections && <><div><strong>{stats.inspections}</strong><span>Inspections with activity</span></div><div><strong>{number(stats.miles)}</strong><span>Recorded inspection miles</span></div></>}<div><strong>{stats.active}</strong><span>Active business months</span></div></div>}{stats.months.map((m, i) => <details className="rearview-editor-month" key={m.name}><summary><strong>{m.name}</strong>{modules.inspections && <> · {m.inspections} inspections · {number(m.miles)} miles</>}{draft.months[i].note || draft.months[i].photos.length ? ' · Memories added' : ''}</summary><label>Memories &amp; milestones<textarea maxLength={3000} placeholder="A trip, a race, a project, or a moment worth keeping…" value={draft.months[i].note} onChange={e => month(i, {
                note: e.target.value
              })} /></label><div className="rearview-photos">{draft.months[i].photos.map((p, j) => photoEditor(p, j, i))}</div>{draft.months[i].photos.length < 2 && picker(i)}</details>)}<label>Looking ahead<textarea maxLength={2000} value={draft.outlook} onChange={e => change({
              ...draft,
              outlook: e.target.value
            })} /></label></>}<div className="rearview-actions"><button className="primary" disabled={!dirty} onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const r = await api('rearview', {
                year: book.year,
                data: draft,
                revision: packet.revision
              });
              setPacket(r);
              setMessage('Yearbook saved.');
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}>{busy ? 'Working…' : 'Save Yearbook'}</button><button disabled={!dirty} onClick={() => {
            if (confirm('Discard unsaved changes?')) {
              setDraft(packet.data || emptyRearview());
              setError('');
            }
          }}>Discard Changes</button></div></fieldset>{createPortal(<div className="rearview-printout"><Recap year={book.year} data={draft} stats={stats} modules={modules} /></div>, document.body)}</>}</section>;
}
