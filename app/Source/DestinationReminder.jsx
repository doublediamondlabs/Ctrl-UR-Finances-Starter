import React, { useState } from 'react';
export default function DestinationReminder({
  saved,
  destination,
  pending,
  onChange
}) {
  const [editing, setEditing] = useState(false);
  if (!saved) return null;
  const text = pending ? destination?.reminder || '' : saved.reminder || '';
  return <section className="destination-reminder" aria-label="Destination reminder"><strong>Remember This Next Time</strong><p className="hint">{saved.name}</p>{editing ? <label>Reminder for future visits<textarea maxLength={1000} value={text} onChange={e => onChange(e.target.value)} /></label> : <p className="destination-reminder-text">{text || 'No reminder saved for this location.'}</p>}<button type="button" onClick={() => setEditing(!editing)}>{editing ? 'Done Editing' : text ? 'Edit reminder' : 'Add reminder'}</button>{pending && <p className="hint" role="status">Reminder change is pending. Save the inspection to keep it for future visits. An empty reminder clears it.</p>}</section>;
}
