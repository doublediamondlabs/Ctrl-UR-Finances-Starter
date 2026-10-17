import { states } from './inspectionDetails.js';
export const destinationKey = name => name.trim().replace(/\s+/g, ' ').toLowerCase();
export function validateDestinations(items) {
  if (!Array.isArray(items) || items.length > 500) throw Error('Save at most 500 destinations.');
  const ids = new Set(),
    names = new Set();
  return items.map(d => {
    const item = {
      id: d.id,
      name: (d.name || '').trim(),
      address: (d.address || '').trim(),
      notes: (d.notes || '').trim(),
      miles: d.miles,
      ...Object.fromEntries(['city', 'state', 'locationType', 'dealerName', 'reminder', 'zip'].filter(k => d[k] !== undefined).map(k => [k, (d[k] || '').trim()]))
    };
    if (typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id)) throw Error('Destination IDs must be unique.');
    if (!item.name || item.name.length > 150 || names.has(destinationKey(item.name))) throw Error('Give each destination a unique short name, including its city if needed.');
    if (d.zip !== undefined && (typeof d.zip !== 'string' || d.zip.length > 10)) throw Error('Keep ZIP code to 10 characters or fewer.');
    if (d.reminder !== undefined && (typeof d.reminder !== 'string' || d.reminder.length > 1000)) throw Error('Keep destination reminders to 1,000 characters.');
    if (item.address.length > 500 || item.notes.length > 1000) throw Error('Destination address or notes are too long.');
    if (typeof item.miles !== 'number' || !Number.isFinite(item.miles) || item.miles < 0 || item.miles > 100000) throw Error('Enter valid round-trip mileage for each saved destination.');
    if ((item.city || '').length > 120 || (item.dealerName || '').length > 200 || item.state && !states.includes(item.state) || item.locationType && !['dealer', 'private'].includes(item.locationType)) throw Error('Check the saved destination city, state and location type.');
    ids.add(item.id);
    names.add(destinationKey(item.name));
    return item;
  });
}
export function destinationChanges(items, visits) {
  let next = structuredClone(items);
  const changes = [],
    reminders = new Map();
  for (const v of visits || []) {
    if (!v.destinationSave && !v.destinationReminderSave) continue;
    const d = v.destination;
    if (!d?.name?.trim()) throw Error('Enter a destination short name, or uncheck Save for future trips.');
    const i = next.findIndex(x => x.id === d.id);
    if ((v.destinationSave === 'update' || v.destinationReminderSave) && i < 0) throw Error('This saved destination was removed. Choose New destination to save it again.');
    if (v.destinationSave) {
      const value = {
        ...d,
        miles: v.miles
      };
      if (i >= 0) {
        value.reminder = next[i].reminder || '';
        next[i] = value;
      } else next.push(value);
      changes.push(d.name);
    }
    if (v.destinationReminderSave) {
      const text = d.reminder || '';
      if (reminders.has(d.id) && reminders.get(d.id) !== text) throw Error('This destination has different pending reminders in its visits. Make them match before saving.');
      reminders.set(d.id, text);
      changes.push(d.name);
    }
  }
  for (const [id, reminder] of reminders) {
    next = next.map(d => d.id === id ? {
      ...d,
      reminder
    } : d);
  }
  return {
    items: validateDestinations(next),
    changes
  };
}
